// Usage test for the todo2code Go SDK.
//
// Start the server first:
//
//	node dist/src/interfaces/a2a.js
//
// Then run:
//
//	cd sdk/go && go run ./examples/basic
package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	todo2code "github.com/semcod/todo2code/sdk/go"
)

const (
	defaultA2AURL      = "http://localhost:8787"
	defaultExampleRoot = "examples/backend"
	defaultTodoFile    = "TODO.md"
	defaultPatchPath   = ".intent-sdk/go/TODO.patch"
	defaultAuditPath   = ".intent-sdk/go/TODO.patch.json"
	defaultReceiptPath = ".intent-sdk/go/TODO.patch.receipt.json"
)

type exampleContext struct {
	baseURL      string
	root         string
	compareBase  string
	compareSpace bool
}

type extractionArtifacts struct {
	recordCount  int
	graph        *todo2code.IntentGraph
	diagnostics  *todo2code.DiagnosticReport
}

type proposalArtifacts struct {
	newProposalIDs       []any
	duplicateProposalIDs []any
	patchHash            string
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "example failed: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	context := readExampleContext()
	client := todo2code.New(context.baseURL, os.Getenv("T2C_A2A_TOKEN"))

	if err := printHealth(ctx, client); err != nil {
		return err
	}

	artifacts, err := collectExtractionArtifacts(ctx, client, context.root)
	if err != nil {
		return err
	}
	printExtractionArtifacts(artifacts)
	fmt.Printf("extracted %d records from %s\n", artifacts.recordCount, context.root)

	proposal, err := runProposalFlow(ctx, client, context.root, artifacts.graph, artifacts.diagnostics)
	if err != nil {
		return err
	}
	fmt.Println("proposal ids:", joinedIDs(proposal.newProposalIDs))
	fmt.Println("duplicate ids:", joinedIDs(proposal.duplicateProposalIDs))
	fmt.Println("patch fingerprint:", truncate(proposal.patchHash, 16))

	if err := printRealityDiff(ctx, client, artifacts.graph, artifacts.diagnostics, context.root); err != nil {
		return err
	}

	if err := maybeCompareWorkspace(ctx, client, context.root, context.compareBase, context.compareSpace); err != nil {
		return err
	}
	fmt.Println("OK")
	return nil
}

func readExampleContext() exampleContext {
	return exampleContext{
		baseURL:      envOr("T2C_A2A_URL", defaultA2AURL),
		root:         envOr("T2C_EXAMPLE_ROOT", defaultExampleRoot),
		compareBase:  envOr("T2C_COMPARE_BASE", "origin/main"),
		compareSpace: envOr("T2C_COMPARE_WORKSPACE", "0") == "1",
	}
}

func printHealth(ctx context.Context, client *todo2code.Client) error {
	health, err := client.Health(ctx)
	if err != nil {
		return fmt.Errorf("health: %w", err)
	}
	fmt.Println("health:", health)
	return nil
}

func collectExtractionArtifacts(ctx context.Context, client *todo2code.Client, root string) (*extractionArtifacts, error) {
	nl, err := client.ExtractNL(ctx, root, "task.md", "deterministic")
	if err != nil {
		return nil, fmt.Errorf("extract_nl: %w", err)
	}
	if nl.Audit["status"] != "succeeded" || nl.Audit["effectiveMode"] != "deterministic" {
		return nil, fmt.Errorf("unexpected NL audit: %v", nl.Audit)
	}
	fmt.Println("NL audit:", nl.Audit["status"], nl.Audit["effectiveMode"])

	ast, err := client.ExtractAST(ctx, root)
	if err != nil {
		return nil, fmt.Errorf("extract_ast: %w", err)
	}
	markdown, err := client.ExtractMarkdownWithOptions(ctx, root, map[string]any{"markdownMode": "deterministic"})
	if err != nil {
		return nil, fmt.Errorf("extract_markdown: %w", err)
	}
	if markdown.Audit["status"] != "succeeded" {
		return nil, fmt.Errorf("unexpected Markdown audit: %v", markdown.Audit)
	}
	fmt.Println("markdown audit:", markdown.Audit["status"], markdown.Audit["effectiveMode"])

	records := append(append(append([]todo2code.IntentRecord{}, nl.Records...), ast.Records...), markdown.Records...)
	graph, err := client.Link(ctx, records)
	if err != nil {
		return nil, fmt.Errorf("link: %w", err)
	}

	report, err := client.Diagnose(ctx, graph)
	if err != nil {
		return nil, fmt.Errorf("diagnose: %w", err)
	}
	return &extractionArtifacts{
		recordCount: len(records),
		graph:       graph,
		diagnostics: report,
	}, nil
}

func printExtractionArtifacts(artifacts *extractionArtifacts) {
	fmt.Println("graph fingerprint:", truncate(artifacts.graph.Fingerprint, 16))
	fmt.Println("diagnostics:", artifacts.diagnostics.Counts)
	for index, diagnostic := range artifacts.diagnostics.Diagnostics {
		if index >= 3 {
			break
		}
		fmt.Printf("  - [%s] %s: %s\n", diagnostic.Severity, diagnostic.Code, diagnostic.Title)
	}
}

func runProposalFlow(
	ctx context.Context,
	client *todo2code.Client,
	root string,
	graph *todo2code.IntentGraph,
	diagnostics *todo2code.DiagnosticReport,
) (*proposalArtifacts, error) {
	synthesis, err := client.ProposeTodo(ctx, map[string]any{"root": root, "graph": graph, "diagnostics": diagnostics, "mode": "prefer-llm"})
	if err != nil {
		return nil, fmt.Errorf("propose_todo: %w", err)
	}

	rendered, err := client.RenderTodo(ctx, map[string]any{
		"root":        root,
		"graph":       graph,
		"diagnostics": diagnostics,
		"synthesis":   synthesis,
		"todo":        defaultTodoFile,
		"patch":       defaultPatchPath,
		"audit":       defaultAuditPath,
	})
	if err != nil {
		return nil, fmt.Errorf("render_todo: %w", err)
	}

	artifact, _ := rendered["artifact"].(map[string]any)
	patchHash, _ := artifact["renderedPatchHash"].(string)
	_, err = client.ApplyTodo(ctx, map[string]any{
		"root":          root,
		"todo":          defaultTodoFile,
		"patch":         defaultPatchPath,
		"audit":         defaultAuditPath,
		"receipt":       defaultReceiptPath,
		"actor":         "sdk-go",
		"approvalHash":  patchHash,
	})
	if err != nil {
		return nil, fmt.Errorf("apply_todo: %w", err)
	}

	validation, _ := synthesis["validation"].(map[string]any)
	proposal := &proposalArtifacts{
		patchHash: patchHash,
	}
	if validation != nil {
		proposal.newProposalIDs, _ = validation["newProposalIds"].([]any)
		proposal.duplicateProposalIDs, _ = validation["duplicateProposalIds"].([]any)
	}
	return proposal, nil
}

func printRealityDiff(
	ctx context.Context,
	client *todo2code.Client,
	graph *todo2code.IntentGraph,
	diagnostics *todo2code.DiagnosticReport,
	root string,
) error {
	reality, err := client.Reality(ctx, graph, diagnostics, map[string]any{"gapsOnly": true, "includeSvg": true})
	if err != nil {
		return fmt.Errorf("reality: %w", err)
	}
	fmt.Printf("reality svg bytes: %d\n", len(reality.SVG))

	diff, err := client.DiffGit(ctx, map[string]any{"root": root, "revision": "HEAD", "includeSvg": true})
	if err != nil {
		return fmt.Errorf("diff_git: %w", err)
	}
	fmt.Printf("git diff files: %d, svg bytes: %d\n", len(diff.Diffs), len(diff.SVG))
	return nil
}

func maybeCompareWorkspace(
	ctx context.Context,
	client *todo2code.Client,
	root string,
	compareBase string,
	compareWorkspace bool,
) error {
	if !compareWorkspace {
		return nil
	}
	comparison, err := client.CompareWorkspace(ctx, map[string]any{"root": root, "base": compareBase})
	if err != nil {
		return fmt.Errorf("compare_workspace: %w", err)
	}
	fmt.Println("workspace trend:", comparison["trend"])
	return nil
}

func envOr(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func truncate(value string, size int) string {
	if len(value) <= size {
		return value
	}
	return value[:size]
}

func joinedIDs(value any) string {
	items, _ := value.([]any)
	if len(items) == 0 {
		return "-"
	}
	values := make([]string, 0, len(items))
	for _, item := range items {
		values = append(values, fmt.Sprint(item))
	}
	return strings.Join(values, ",")
}
