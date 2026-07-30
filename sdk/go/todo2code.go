// Package todo2code provides a dependency-free Go client for the todo2code
// A2A v1.0 endpoint. Only the standard library is used.
package todo2code

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
	ActionProposeTodo          = "propose_todo"
	ActionRenderTodo           = "render_todo"
	ActionApplyTodo            = "apply_todo"
)
