// Deterministic Go AST facts for todo2code. Uses only the Go standard library.
//
// Emits the same JSON envelope as python/ast_extract.py so the TypeScript
// extractor can treat every language adapter identically:
//
//	{"facts": [...], "warnings": [...]}
//
// Run standalone (no module required):
//
//	go run golang/ast_extract.go <root> --max-file-bytes 524288
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

var ignoredDirs = map[string]bool{
	".git": true, "node_modules": true, "dist": true, "build": true,
	"coverage": true, ".intent": true, "vendor": true, "testdata": true,
}

// Fact mirrors the PythonFact interface consumed by src/extractors/ast.ts.
type Fact struct {
	Path        string         `json:"path"`
	LineStart   int            `json:"lineStart"`
	LineEnd     int            `json:"lineEnd"`
	Kind        string         `json:"kind"`
	Action      string         `json:"action"`
	Object      string         `json:"object"`
	Symbol      *string        `json:"symbol"`
	Subject     *string        `json:"subject"`
	Excerpt     string         `json:"excerpt"`
	ContentHash string         `json:"contentHash"`
	Metadata    map[string]any `json:"metadata"`
}

type output struct {
	Facts    []Fact   `json:"facts"`
	Warnings []string `json:"warnings"`
}

func main() {
	root := "."
	maxFileBytes := int64(524288)

	args := os.Args[1:]
	for index := 0; index < len(args); index++ {
		switch args[index] {
		case "--max-file-bytes":
			if index+1 < len(args) {
				if parsed, err := strconv.ParseInt(args[index+1], 10, 64); err == nil {
					maxFileBytes = parsed
				}
				index++
			}
		default:
			if !strings.HasPrefix(args[index], "-") {
				root = args[index]
			}
		}
	}

	result := output{Facts: []Fact{}, Warnings: []string{}}
	files, err := collectGoFiles(root)
	if err != nil {
		result.Warnings = append(result.Warnings, fmt.Sprintf("walk failed: %v", err))
		emit(result)
		return
	}

	for _, file := range files {
		info, err := os.Stat(file)
		if err != nil {
			result.Warnings = append(result.Warnings, fmt.Sprintf("%s: %v", file, err))
			continue
		}
		if info.Size() > maxFileBytes {
			relative, _ := filepath.Rel(root, file)
			result.Warnings = append(result.Warnings,
				fmt.Sprintf("%s: skipped, %d bytes exceeds limit %d", toSlash(relative), info.Size(), maxFileBytes))
			continue
		}

		source, err := os.ReadFile(file)
		if err != nil {
			result.Warnings = append(result.Warnings, fmt.Sprintf("%s: %v", file, err))
			continue
		}
		relative, err := filepath.Rel(root, file)
		if err != nil {
			relative = file
		}
		facts, warning := parseFile(toSlash(relative), source)
		if warning != "" {
			result.Warnings = append(result.Warnings, warning)
			continue
		}
		result.Facts = append(result.Facts, facts...)
	}

	emit(result)
}

func emit(result output) {
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(result); err != nil {
		fmt.Fprintf(os.Stderr, "encode failed: %v\n", err)
		os.Exit(1)
	}
}

func collectGoFiles(root string) ([]string, error) {
	var files []string
	err := filepath.Walk(root, func(current string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip unreadable entries rather than aborting the walk.
		}
		if info.IsDir() {
			if ignoredDirs[info.Name()] || (strings.HasPrefix(info.Name(), ".") && info.Name() != "." && current != root) {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasSuffix(info.Name(), ".go") {
			files = append(files, current)
		}
		return nil
	})
	sort.Strings(files)
	return files, err
}

func parseFile(relative string, source []byte) ([]Fact, string) {
	fileSet := token.NewFileSet()
	parsed, err := parser.ParseFile(fileSet, relative, source, parser.ParseComments)
	if err != nil {
		return nil, fmt.Sprintf("%s: parse error: %v", relative, err)
	}

	lines := strings.Split(string(source), "\n")
	collector := &factCollector{relative: relative, fileSet: fileSet, lines: lines}

	collector.add(parsed.Name, "go_package_fact", "declare", parsed.Name.Name,
		strPtr(parsed.Name.Name), nil, map[string]any{"package": parsed.Name.Name})

	for _, importSpec := range parsed.Imports {
		importPath, err := strconv.Unquote(importSpec.Path.Value)
		if err != nil {
			importPath = importSpec.Path.Value
		}
		metadata := map[string]any{"package": parsed.Name.Name}
		if importSpec.Name != nil {
			metadata["alias"] = importSpec.Name.Name
		}
		collector.add(importSpec, "go_import_fact", "depend_on", importPath, nil, nil, metadata)
	}

	for _, declaration := range parsed.Decls {
		collector.visitDecl(declaration, parsed.Name.Name)
	}

	return collector.facts, ""
}

type factCollector struct {
	relative string
	fileSet  *token.FileSet
	lines    []string
	facts    []Fact
}

func (c *factCollector) position(node ast.Node) (int, int) {
	start := c.fileSet.Position(node.Pos()).Line
	end := c.fileSet.Position(node.End()).Line
	if start < 1 {
		start = 1
	}
	if end < start {
		end = start
	}
	return start, end
}

func (c *factCollector) excerpt(start, end int) string {
	if start > len(c.lines) {
		return ""
	}
	if end > len(c.lines) {
		end = len(c.lines)
	}
	text := strings.Join(c.lines[start-1:end], "\n")
	if len(text) > 2000 {
		text = text[:2000]
	}
	return text
}

func (c *factCollector) add(node ast.Node, kind, action, object string, symbol, subject *string, metadata map[string]any) {
	start, end := c.position(node)
	excerpt := c.excerpt(start, end)
	sum := sha256.Sum256([]byte(excerpt))
	if metadata == nil {
		metadata = map[string]any{}
	}
	c.facts = append(c.facts, Fact{
		Path:        c.relative,
		LineStart:   start,
		LineEnd:     end,
		Kind:        kind,
		Action:      action,
		Object:      object,
		Symbol:      symbol,
		Subject:     subject,
		Excerpt:     excerpt,
		ContentHash: hex.EncodeToString(sum[:]),
		Metadata:    metadata,
	})
}

func (c *factCollector) visitDecl(declaration ast.Decl, packageName string) {
	switch node := declaration.(type) {
	case *ast.FuncDecl:
		c.visitFunc(node, packageName)
	case *ast.GenDecl:
		c.visitGenDecl(node, packageName)
	}
}

func (c *factCollector) visitFunc(node *ast.FuncDecl, packageName string) {
	name := node.Name.Name
	metadata := map[string]any{
		"package":  packageName,
		"exported": node.Name.IsExported(),
		"kind":     "function",
	}

	// A method carries its receiver type, which is what makes `Store.Enqueue`
	// resolvable from a TODO or commit message.
	var subject *string
	if node.Recv != nil && len(node.Recv.List) > 0 {
		receiver := typeName(node.Recv.List[0].Type)
		if receiver != "" {
			metadata["kind"] = "method"
			metadata["receiver"] = receiver
			name = receiver + "." + name
			subject = strPtr(receiver)
		}
	}
	if node.Type.Params != nil {
		metadata["parameters"] = len(node.Type.Params.List)
	}

	c.add(node, "go_symbol_fact", "declare", name, strPtr(name), subject, metadata)

	if node.Body != nil {
		c.visitCalls(node.Body, name, packageName)
	}
}

func (c *factCollector) visitGenDecl(node *ast.GenDecl, packageName string) {
	for _, spec := range node.Specs {
		switch value := spec.(type) {
		case *ast.TypeSpec:
			metadata := map[string]any{
				"package":  packageName,
				"exported": value.Name.IsExported(),
				"kind":     declaredTypeKind(value.Type),
			}
			c.add(value, "go_symbol_fact", "declare", value.Name.Name, strPtr(value.Name.Name), nil, metadata)
		case *ast.ValueSpec:
			for _, name := range value.Names {
				if name.Name == "_" {
					continue
				}
				kind := "var"
				if node.Tok == token.CONST {
					kind = "const"
				}
				metadata := map[string]any{
					"package":  packageName,
					"exported": name.IsExported(),
					"kind":     kind,
				}
				c.add(name, "go_symbol_fact", "declare", name.Name, strPtr(name.Name), nil, metadata)
			}
		}
	}
}

func (c *factCollector) visitCalls(body *ast.BlockStmt, scope, packageName string) {
	ast.Inspect(body, func(node ast.Node) bool {
		call, ok := node.(*ast.CallExpr)
		if !ok {
			return true
		}
		callee := typeName(call.Fun)
		if callee == "" {
			return true
		}
		c.add(call, "go_call_fact", "call", callee, strPtr(scope), nil, map[string]any{
			"callee":  callee,
			"package": packageName,
		})
		return true
	})
}

// typeName renders the dotted name of an expression, which covers identifiers,
// selectors, pointers, generics and the common composite forms.
func typeName(expr ast.Expr) string {
	switch node := expr.(type) {
	case *ast.Ident:
		return node.Name
	case *ast.SelectorExpr:
		left := typeName(node.X)
		if left == "" {
			return node.Sel.Name
		}
		return left + "." + node.Sel.Name
	case *ast.StarExpr:
		return typeName(node.X)
	case *ast.IndexExpr:
		return typeName(node.X)
	case *ast.IndexListExpr:
		return typeName(node.X)
	case *ast.ParenExpr:
		return typeName(node.X)
	case *ast.ArrayType:
		return typeName(node.Elt)
	case *ast.Ellipsis:
		return typeName(node.Elt)
	default:
		return ""
	}
}

func declaredTypeKind(expr ast.Expr) string {
	switch expr.(type) {
	case *ast.StructType:
		return "struct"
	case *ast.InterfaceType:
		return "interface"
	case *ast.FuncType:
		return "func_type"
	default:
		return "type"
	}
}

func strPtr(value string) *string {
	return &value
}

func toSlash(value string) string {
	return filepath.ToSlash(value)
}
