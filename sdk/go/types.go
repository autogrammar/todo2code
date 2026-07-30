package todo2code

import (
	"encoding/json"
	"fmt"
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

// RealityResult is the intent-versus-reality response.
type RealityResult struct {
	View     json.RawMessage `json:"view"`
	Markdown string          `json:"markdown"`
	SVG      string          `json:"svg,omitempty"`
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

// Error is a JSON-RPC or transport error from the runtime.
type Error struct {
	Code    int
	Message string
	Data    json.RawMessage
}

func (e *Error) Error() string {
	return fmt.Sprintf("todo2code: %s (code %d)", e.Message, e.Code)
}
