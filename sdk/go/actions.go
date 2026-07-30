package todo2code

import "context"

// ExtractAST extracts AST facts from root.
func (c *Client) ExtractAST(ctx context.Context, root string) (*ExtractionResult, error) {
	result := &ExtractionResult{}
	return result, c.Call(ctx, ActionExtractAST, map[string]any{"root": root}, result)
}

// ExtractConfig extracts repository configuration and infrastructure declarations.
func (c *Client) ExtractConfig(ctx context.Context, root string) (*ExtractionResult, error) {
	result := &ExtractionResult{}
	return result, c.Call(ctx, ActionExtractConfig, map[string]any{"root": root}, result)
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

// ProposeTodo synthesizes audited grounded TODO proposals.
func (c *Client) ProposeTodo(ctx context.Context, input map[string]any) (map[string]any, error) {
	return c.callMap(ctx, ActionProposeTodo, input)
}

// RenderTodo writes a reviewable TODO patch and its JSON audit.
func (c *Client) RenderTodo(ctx context.Context, input map[string]any) (map[string]any, error) {
	return c.callMap(ctx, ActionRenderTodo, input)
}

// ApplyTodo applies one explicitly approved TODO patch and returns its receipt.
func (c *Client) ApplyTodo(ctx context.Context, input map[string]any) (map[string]any, error) {
	return c.callMap(ctx, ActionApplyTodo, input)
}

func (c *Client) callMap(ctx context.Context, action string, input map[string]any) (map[string]any, error) {
	var result map[string]any
	if err := c.Call(ctx, action, input, &result); err != nil {
		return nil, err
	}
	return result, nil
}
