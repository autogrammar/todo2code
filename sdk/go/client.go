package todo2code

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync/atomic"
	"time"
)

// Client talks to a todo2code A2A server.
type Client struct {
	BaseURL    string
	Token      string
	HTTPClient *http.Client

	counter atomic.Uint64
}

// New returns a client for baseURL. Pass an empty token when the server runs
// without T2C_A2A_TOKEN.
func New(baseURL, token string) *Client {
	if baseURL == "" {
		baseURL = "http://localhost:8787"
	}
	return &Client{
		BaseURL:    strings.TrimRight(baseURL, "/"),
		Token:      token,
		HTTPClient: &http.Client{Timeout: 120 * time.Second},
	}
}

type rpcRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID      string `json:"id"`
	Method  string `json:"method"`
	Params  any    `json:"params"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      any             `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *struct {
		Code    int             `json:"code"`
		Message string          `json:"message"`
		Data    json.RawMessage `json:"data"`
	} `json:"error"`
}

func (c *Client) nextID(prefix string) string {
	return fmt.Sprintf("%s-%d-%d", prefix, time.Now().UnixMilli(), c.counter.Add(1))
}

func (c *Client) setHeaders(request *http.Request, hasBody bool) {
	request.Header.Set("Accept", "application/json")
	request.Header.Set("A2A-Version", A2AVersion)
	if hasBody {
		request.Header.Set("Content-Type", "application/json")
	}
	if c.Token != "" {
		request.Header.Set("Authorization", "Bearer "+c.Token)
	}
}

// RPC performs one JSON-RPC call and returns the raw result.
func (c *Client) RPC(ctx context.Context, method string, params any) (json.RawMessage, error) {
	body, err := json.Marshal(rpcRequest{JSONRPC: "2.0", ID: c.nextID("req"), Method: method, Params: params})
	if err != nil {
		return nil, fmt.Errorf("todo2code: encode request: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/a2a", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("todo2code: build request: %w", err)
	}
	c.setHeaders(request, true)

	response, err := c.HTTPClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("todo2code: send request: %w", err)
	}
	defer response.Body.Close()

	var payload rpcResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("todo2code: decode response (HTTP %d): %w", response.StatusCode, err)
	}
	if payload.Error != nil {
		return nil, &Error{Code: payload.Error.Code, Message: payload.Error.Message, Data: payload.Error.Data}
	}
	if response.StatusCode >= 400 {
		return nil, &Error{Code: response.StatusCode, Message: "HTTP " + response.Status}
	}
	return payload.Result, nil
}

// Send runs one action and returns the resulting A2A task.
func (c *Client) Send(ctx context.Context, action string, input map[string]any) (*Task, error) {
	if input == nil {
		input = map[string]any{}
	}
	data, err := json.Marshal(map[string]any{"action": action, "input": input})
	if err != nil {
		return nil, fmt.Errorf("todo2code: encode input: %w", err)
	}
	params := map[string]any{
		"message": Message{
			MessageID: c.nextID("msg"),
			Role:      "ROLE_USER",
			Parts:     []Part{{Data: data, MediaType: "application/json"}},
		},
	}
	raw, err := c.RPC(ctx, "SendMessage", params)
	if err != nil {
		return nil, err
	}
	return unwrapTask(raw)
}

// unwrapTask accepts both A2A result shapes: SendMessage wraps the task as
// {"task": …}, while GetTask and CancelTask return it bare.
func unwrapTask(raw json.RawMessage) (*Task, error) {
	var wrapper struct {
		Task *Task `json:"task"`
	}
	if err := json.Unmarshal(raw, &wrapper); err == nil && wrapper.Task != nil {
		return wrapper.Task, nil
	}
	var task Task
	if err := json.Unmarshal(raw, &task); err != nil {
		return nil, fmt.Errorf("todo2code: decode task: %w", err)
	}
	return &task, nil
}

// Call runs one action and unmarshals the first JSON artifact into out.
func (c *Client) Call(ctx context.Context, action string, input map[string]any, out any) error {
	task, err := c.Send(ctx, action, input)
	if err != nil {
		return err
	}
	if task.Status.State != "TASK_STATE_COMPLETED" {
		detail := ""
		if task.Status.Message != nil {
			for _, part := range task.Status.Message.Parts {
				detail += part.Text
			}
		}
		return &Error{Code: -32000, Message: fmt.Sprintf("task %s ended in %s: %s", task.ID, task.Status.State, detail)}
	}
	for _, artifact := range task.Artifacts {
		for _, part := range artifact.Parts {
			if len(part.Data) == 0 {
				continue
			}
			if out == nil {
				return nil
			}
			return json.Unmarshal(part.Data, out)
		}
	}
	return &Error{Code: -32001, Message: "task " + task.ID + " returned no JSON artifact"}
}

// Health returns the server liveness payload.
func (c *Client) Health(ctx context.Context) (map[string]any, error) {
	return c.getJSON(ctx, "/healthz")
}

// AgentCard returns the advertised A2A agent card.
func (c *Client) AgentCard(ctx context.Context) (map[string]any, error) {
	return c.getJSON(ctx, "/.well-known/agent-card.json")
}

func (c *Client) getJSON(ctx context.Context, path string) (map[string]any, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+path, nil)
	if err != nil {
		return nil, fmt.Errorf("todo2code: build request: %w", err)
	}
	c.setHeaders(request, false)
	response, err := c.HTTPClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("todo2code: send request: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode >= 400 {
		return nil, &Error{Code: response.StatusCode, Message: "HTTP " + response.Status}
	}
	payload := map[string]any{}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("todo2code: decode %s: %w", path, err)
	}
	return payload, nil
}
