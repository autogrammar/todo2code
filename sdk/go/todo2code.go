// Package todo2code provides a dependency-free Go client for the todo2code
// A2A v1.0 endpoint. Only the standard library is used.
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

// A2AVersion is the only protocol version the server accepts.
const A2AVersion = "1.0"

// Action names accepted by the todo2code runtime.
const (
	ActionExtractNL            = "extract_nl"
	ActionExtractGit           = "extract_git"
	ActionExtractAST           = "extract_ast"
	ActionExtractMarkdown      = "extract_markdown"
	ActionExtractDocs          = "extract_docs"
	ActionExtractCommunication = "extract_communication"
	ActionAnalyzeCommunication = "analyze_communication"
	ActionLink                 = "link"
	ActionDiagnose             = "diagnose"
	ActionSummarize            = "summarize"
	ActionDiff                 = "diff"
	ActionDiffFiles            = "diff_files"
	ActionDiffGit              = "diff_git"
	ActionReality              = "reality"
	ActionCompareWorkspace     = "compare_workspace"
	ActionPipeline             = "pipeline"
)

// SourceLineRange is the 1-based inclusive line span a record was taken from.
type SourceLineRange struct {
	Start int `json:"start"`
	End   int `json:"end"`
}

// IntentTarget holds the resolved targets of a statement.
type IntentTarget struct {
	Paths    []string `json:"paths"`
	Symbols  []string `json:"symbols"`
	Tickets  []string `json:"tickets"`
	Versions []string `json:"versions"`
}

// IntentStatement is the normalized intent expressed by a record.
type IntentStatement struct {
	Kind     string       `json:"kind"`
	Actor    *string      `json:"actor"`
	Action   string       `json:"action"`
	Subject  *string      `json:"subject"`
	Object   string       `json:"object"`
	Target   IntentTarget `json:"target"`
	Modality string       `json:"modality"`
	Polarity string       `json:"polarity"`
	Text     string       `json:"text"`
}

// IntentSource records exactly where a statement came from.
type IntentSource struct {
	Kind        string           `json:"kind"`
	Path        *string          `json:"path"`
	Lines       *SourceLineRange `json:"lines"`
	Revision    *string          `json:"revision"`
	Symbol      *string          `json:"symbol"`
	CommitIndex *int             `json:"commitIndex"`
	Extractor   string           `json:"extractor"`
	ContentHash string           `json:"contentHash"`
	RawExcerpt  *string          `json:"rawExcerpt"`
}

// IntentEpistemic carries the confidence and its justification.
type IntentEpistemic struct {
	Class      string   `json:"class"`
	Confidence float64  `json:"confidence"`
	Basis      []string `json:"basis"`
}

// IntentRecord is a single t2c.intent/v1 record.
type IntentRecord struct {
	SchemaVersion string          `json:"schemaVersion"`
	ID            string          `json:"id"`
	Statement     IntentStatement `json:"statement"`
	Lifecycle     struct {
		Status string `json:"status"`
	} `json:"lifecycle"`
	Source     IntentSource    `json:"source"`
	Epistemic  IntentEpistemic `json:"epistemic"`
	ObservedAt *string         `json:"observedAt"`
	Metadata   map[string]any  `json:"metadata"`
}

// IntentRelation links two records with typed, scored evidence.
type IntentRelation struct {
	ID         string   `json:"id"`
	From       string   `json:"from"`
	To         string   `json:"to"`
	Type       string   `json:"type"`
	Confidence float64  `json:"confidence"`
	Basis      []string `json:"basis"`
}

// IntentGraph is the linked t2c.graph/v1 evidence graph.
type IntentGraph struct {
	SchemaVersion string           `json:"schemaVersion"`
	GeneratedAt   string           `json:"generatedAt"`
	Fingerprint   string           `json:"fingerprint"`
	Records       []IntentRecord   `json:"records"`
	Relations     []IntentRelation `json:"relations"`
	Stats         struct {
		BySource map[string]int `json:"bySource"`
		ByAction map[string]int `json:"byAction"`
		ByStatus map[string]int `json:"byStatus"`
	} `json:"stats"`
}

// Diagnostic is one detected alignment finding.
type Diagnostic struct {
	ID              string   `json:"id"`
	Code            string   `json:"code"`
	Severity        string   `json:"severity"`
	Title           string   `json:"title"`
	Detail          string   `json:"detail"`
	RecordIDs       []string `json:"recordIds"`
	SuggestedAction string   `json:"suggestedAction"`
}

// DiagnosticReport is the t2c.diagnostics/v1 payload.
type DiagnosticReport struct {
	SchemaVersion    string         `json:"schemaVersion"`
	GeneratedAt      string         `json:"generatedAt"`
	GraphFingerprint string         `json:"graphFingerprint"`
	Diagnostics      []Diagnostic   `json:"diagnostics"`
	Counts           map[string]int `json:"counts"`
}

// ExtractionResult is what every extract_* action returns.
type ExtractionResult struct {
	Records  []IntentRecord `json:"records"`
	Warnings []string       `json:"warnings"`
	Audit    map[string]any `json:"audit,omitempty"`
}

// Part is one A2A message or artifact part.
type Part struct {
	Text      string          `json:"text,omitempty"`
	Data      json.RawMessage `json:"data,omitempty"`
	MediaType string          `json:"mediaType,omitempty"`
}

// Message is an A2A message.
type Message struct {
	MessageID string `json:"messageId"`
	Role      string `json:"role"`
	Parts     []Part `json:"parts"`
	ContextID string `json:"contextId,omitempty"`
	TaskID    string `json:"taskId,omitempty"`
}

// Artifact is one A2A task artifact.
type Artifact struct {
	ArtifactID  string `json:"artifactId"`
	Name        string `json:"name,omitempty"`
	Description string `json:"description,omitempty"`
	Parts       []Part `json:"parts"`
}

// Task is the A2A task returned by SendMessage.
type Task struct {
	ID        string `json:"id"`
	ContextID string `json:"contextId"`
	Status    struct {
		State     string   `json:"state"`
		Message   *Message `json:"message,omitempty"`
		Timestamp string   `json:"timestamp"`
	} `json:"status"`
	Artifacts []Artifact     `json:"artifacts"`
	History   []Message      `json:"history"`
	Metadata  map[string]any `json:"metadata"`
}

// Error is a JSON-RPC or transport error from the runtime.
type Error struct {
	Code    int
	Message string
	Data    json.RawMessage
}

func (e *Error) Error() string {
	return fmt.Sprintf("todo2code: %s (code %d)", e.Message, e.Code)
}

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

// ExtractAST extracts AST facts from root.
func (c *Client) ExtractAST(ctx context.Context, root string) (*ExtractionResult, error) {
	result := &ExtractionResult{}
	return result, c.Call(ctx, ActionExtractAST, map[string]any{"root": root}, result)
}

// ExtractNL converts natural language into audited Intent DSL records.
func (c *Client) ExtractNL(ctx context.Context, root, file, nlMode string) (*ExtractionResult, error) {
	result := &ExtractionResult{}
	payload := map[string]any{"root": root, "file": file}
	if nlMode != "" {
		payload["nlMode"] = nlMode
	}
	return result, c.Call(ctx, ActionExtractNL, payload, result)
}

// ExtractDocs converts documentation into audited Intent DSL records through the configured LLM.
func (c *Client) ExtractDocs(ctx context.Context, root string, patterns, excludes []string) (*ExtractionResult, error) {
	result := &ExtractionResult{}
	payload := map[string]any{"root": root}
	if patterns != nil {
		payload["patterns"] = patterns
	}
	if excludes != nil {
		payload["excludes"] = excludes
	}
	return result, c.Call(ctx, ActionExtractDocs, payload, result)
}

// ExtractMarkdown extracts TODO and CHANGELOG records from root.
func (c *Client) ExtractMarkdown(ctx context.Context, root string) (*ExtractionResult, error) {
	return c.ExtractMarkdownWithOptions(ctx, root, nil)
}

// ExtractMarkdownWithOptions extracts TODO and CHANGELOG records with optional
// markdownMode, todo and changelog action parameters.
func (c *Client) ExtractMarkdownWithOptions(ctx context.Context, root string, options map[string]any) (*ExtractionResult, error) {
	result := &ExtractionResult{}
	payload := map[string]any{"root": root}
	for key, value := range options {
		payload[key] = value
	}
	return result, c.Call(ctx, ActionExtractMarkdown, payload, result)
}

// ExtractGit extracts intent claims from the last count commits.
func (c *Client) ExtractGit(ctx context.Context, root string, count int) (*ExtractionResult, error) {
	result := &ExtractionResult{}
	return result, c.Call(ctx, ActionExtractGit, map[string]any{"root": root, "count": count}, result)
}

// Link builds the deterministic evidence graph from records.
func (c *Client) Link(ctx context.Context, records []IntentRecord) (*IntentGraph, error) {
	graph := &IntentGraph{}
	return graph, c.Call(ctx, ActionLink, map[string]any{"records": records}, graph)
}

// Diagnose runs alignment diagnostics over a graph.
func (c *Client) Diagnose(ctx context.Context, graph *IntentGraph) (*DiagnosticReport, error) {
	report := &DiagnosticReport{}
	return report, c.Call(ctx, ActionDiagnose, map[string]any{"graph": graph}, report)
}

// RealityResult is the intent-versus-reality response.
type RealityResult struct {
	View     json.RawMessage `json:"view"`
	Markdown string          `json:"markdown"`
	SVG      string          `json:"svg,omitempty"`
}

// Reality compares declared intent against observed code for one graph.
func (c *Client) Reality(ctx context.Context, graph *IntentGraph, report *DiagnosticReport, options map[string]any) (*RealityResult, error) {
	input := map[string]any{"graph": graph}
	if report != nil {
		input["diagnostics"] = report
	}
	for key, value := range options {
		input[key] = value
	}
	result := &RealityResult{}
	return result, c.Call(ctx, ActionReality, input, result)
}

// DiffResult is the file diff response shared by diff_files and diff_git.
type DiffResult struct {
	Diffs    []json.RawMessage `json:"diffs"`
	Unified  string            `json:"unified"`
	SVG      string            `json:"svg,omitempty"`
	HTML     string            `json:"html,omitempty"`
	Revision string            `json:"revision,omitempty"`
	Warnings []string          `json:"warnings,omitempty"`
}

// DiffGit renders the Git work tree or index against a revision.
func (c *Client) DiffGit(ctx context.Context, options map[string]any) (*DiffResult, error) {
	result := &DiffResult{}
	return result, c.Call(ctx, ActionDiffGit, options, result)
}

// DiffFiles renders a diff between two files under the server root.
func (c *Client) DiffFiles(ctx context.Context, before, after string, options map[string]any) (*DiffResult, error) {
	input := map[string]any{"before": before, "after": after}
	for key, value := range options {
		input[key] = value
	}
	result := &DiffResult{}
	return result, c.Call(ctx, ActionDiffFiles, input, result)
}

// CompareWorkspace compares a Git base ref with committed and uncommitted workspace intent.
func (c *Client) CompareWorkspace(ctx context.Context, options map[string]any) (map[string]any, error) {
	result := map[string]any{}
	return result, c.Call(ctx, ActionCompareWorkspace, options, &result)
}

// Pipeline runs the full todo2code pipeline on the server.
func (c *Client) Pipeline(ctx context.Context, options map[string]any) (map[string]any, error) {
	result := map[string]any{}
	return result, c.Call(ctx, ActionPipeline, options, &result)
}
