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
	"time"

	todo2code "github.com/semcod/todo2code/sdk/go"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "example failed: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	baseURL := envOr("T2C_A2A_URL", "http://localhost:8787")
	root := envOr("T2C_EXAMPLE_ROOT", "examples/backend")

	client := todo2code.New(baseURL, os.Getenv("T2C_A2A_TOKEN"))
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	health, err := client.Health(ctx)
	if err != nil {
		return fmt.Errorf("health: %w", err)
	}
	fmt.Println("health:", health)

	// 1. Deterministic extraction -> graph -> diagnostics.
	nl, err := client.ExtractNL(ctx, root, "task.md", "deterministic")
	if err != nil {
		return fmt.Errorf("extract_nl: %w", err)
	}
	if nl.Audit["status"] != "succeeded" || nl.Audit["effectiveMode"] != "deterministic" {
		return fmt.Errorf("unexpected NL audit: %v", nl.Audit)
	}
	fmt.Println("NL audit:", nl.Audit["status"], nl.Audit["effectiveMode"])
	ast, err := client.ExtractAST(ctx, root)
	if err != nil {
		return fmt.Errorf("extract_ast: %w", err)
	}
	markdown, err := client.ExtractMarkdownWithOptions(ctx, root, map[string]any{"markdownMode": "deterministic"})
	if err != nil {
		return fmt.Errorf("extract_markdown: %w", err)
	}
	if markdown.Audit["status"] != "succeeded" {
		return fmt.Errorf("unexpected Markdown audit: %v", markdown.Audit)
	}
	fmt.Println("markdown audit:", markdown.Audit["status"], markdown.Audit["effectiveMode"])
	records := append(append(append([]todo2code.IntentRecord{}, nl.Records...), ast.Records...), markdown.Records...)
	fmt.Printf("extracted %d records from %s\n", len(records), root)

	graph, err := client.Link(ctx, records)
	if err != nil {
		return fmt.Errorf("link: %w", err)
	}
	fmt.Println("graph fingerprint:", truncate(graph.Fingerprint, 16))
	fmt.Println("records by source:", graph.Stats.BySource)

	report, err := client.Diagnose(ctx, graph)
	if err != nil {
		return fmt.Errorf("diagnose: %w", err)
	}
	fmt.Println("diagnostics:", report.Counts)
	for index, diagnostic := range report.Diagnostics {
		if index >= 3 {
			break
		}
		fmt.Printf("  - [%s] %s: %s\n", diagnostic.Severity, diagnostic.Code, diagnostic.Title)
	}

	// 2. Intent-vs-reality view.
	reality, err := client.Reality(ctx, graph, report, map[string]any{"gapsOnly": true, "includeSvg": true})
	if err != nil {
		return fmt.Errorf("reality: %w", err)
	}
	fmt.Printf("reality svg bytes: %d\n", len(reality.SVG))

	// 3. Git diff rendered as SVG.
	diff, err := client.DiffGit(ctx, map[string]any{"root": root, "revision": "HEAD", "includeSvg": true})
	if err != nil {
		return fmt.Errorf("diff_git: %w", err)
	}
	fmt.Printf("git diff files: %d, svg bytes: %d\n", len(diff.Diffs), len(diff.SVG))

	// 4. Optional origin/main -> local filesystem Intent comparison.
	if os.Getenv("T2C_COMPARE_WORKSPACE") == "1" {
		comparison, compareErr := client.CompareWorkspace(ctx, map[string]any{"root": root, "base": envOr("T2C_COMPARE_BASE", "origin/main")})
		if compareErr != nil {
			return fmt.Errorf("compare_workspace: %w", compareErr)
		}
		fmt.Println("workspace trend:", comparison["trend"])
	}

	fmt.Println("OK")
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
