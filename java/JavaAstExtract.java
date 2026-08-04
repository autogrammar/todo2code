// Deterministic Java AST facts for todo2code. Run in JDK source-file mode:
// java --add-modules jdk.compiler java/JavaAstExtract.java <root> --max-file-bytes 524288

import com.sun.source.tree.*;
import com.sun.source.util.JavacTask;
import com.sun.source.util.SourcePositions;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.Trees;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import javax.tools.*;

public final class JavaAstExtract {
  private static final Set<String> IGNORED = Set.of(
      ".git", ".intent", "node_modules", "dist", "build", "target", "coverage", "vendor");

  public static void main(String[] args) throws Exception {
    Path root = Paths.get(".").toAbsolutePath().normalize();
    long maxBytes = 524_288;
    for (int index = 0; index < args.length; index++) {
      if ("--max-file-bytes".equals(args[index]) && index + 1 < args.length) {
        maxBytes = Long.parseLong(args[++index]);
      } else if (!args[index].startsWith("-")) {
        root = Paths.get(args[index]).toAbsolutePath().normalize();
      }
    }

    List<Map<String, Object>> facts = new ArrayList<>();
    List<String> warnings = new ArrayList<>();
    JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
    if (compiler == null) {
      warnings.add("JDK compiler is unavailable; a full JDK is required for Java AST extraction");
      emit(facts, warnings);
      return;
    }

    List<Path> files = collect(root);
    for (Path file : files) {
      try {
        long size = Files.size(file);
        String relative = slash(root.relativize(file).toString());
        if (size > maxBytes) {
          warnings.add(relative + ": skipped, " + size + " bytes exceeds limit " + maxBytes);
          continue;
        }
        parseFile(compiler, root, file, facts, warnings);
      } catch (Exception error) {
        warnings.add(slash(root.relativize(file).toString()) + ": " + error.getMessage());
      }
    }
    emit(facts, warnings);
  }

  private static List<Path> collect(Path root) throws IOException {
    List<Path> output = new ArrayList<>();
    try (var paths = Files.walk(root)) {
      paths.filter(Files::isRegularFile)
          .filter(path -> path.getFileName().toString().endsWith(".java"))
          .filter(path -> !containsIgnored(root.relativize(path)))
          .forEach(output::add);
    }
    output.sort(Comparator.comparing(Path::toString));
    return output;
  }

  private static boolean containsIgnored(Path relative) {
    for (Path part : relative) if (IGNORED.contains(part.toString())) return true;
    return false;
  }

  private static void parseFile(
      JavaCompiler compiler,
      Path root,
      Path file,
      List<Map<String, Object>> facts,
      List<String> warnings) throws Exception {
    String source = Files.readString(file, StandardCharsets.UTF_8);
    String relative = slash(root.relativize(file).toString());
    DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
    try (StandardJavaFileManager manager = compiler.getStandardFileManager(diagnostics, Locale.ROOT, StandardCharsets.UTF_8)) {
      ParsedJavaCompilation parsed = parseCompilationUnits(compiler, diagnostics, manager, file);
      scanCompilationUnits(parsed, relative, source, facts);
    }
    collectFileDiagnostics(relative, diagnostics, warnings);
  }

  private static ParsedJavaCompilation parseCompilationUnits(
      JavaCompiler compiler,
      DiagnosticCollector<JavaFileObject> diagnostics,
      StandardJavaFileManager manager,
      Path file) throws IOException {
    Iterable<? extends JavaFileObject> units = manager.getJavaFileObjects(file.toFile());
    JavacTask task = (JavacTask) compiler.getTask(null, manager, diagnostics,
        List.of("-proc:none"), null, units);
    Iterable<? extends CompilationUnitTree> parsed = task.parse();
    SourcePositions positions = Trees.instance(task).getSourcePositions();
    return new ParsedJavaCompilation(parsed, positions);
  }

  private static void scanCompilationUnits(
      ParsedJavaCompilation parsed,
      String relative,
      String source,
      List<Map<String, Object>> facts) {
    for (CompilationUnitTree unit : parsed.units()) {
      new Collector(relative, source, unit, parsed.positions(), facts).scan(unit, null);
    }
  }

  private record ParsedJavaCompilation(
      Iterable<? extends CompilationUnitTree> units,
      SourcePositions positions) {
  }

  private static void collectFileDiagnostics(String relative, DiagnosticCollector<JavaFileObject> diagnostics, List<String> warnings) {
    for (Diagnostic<? extends JavaFileObject> diagnostic : diagnostics.getDiagnostics()) {
      if (diagnostic.getKind() == Diagnostic.Kind.ERROR) {
        warnings.add(relative + ":" + diagnostic.getLineNumber()
            + ": parse error: " + diagnostic.getMessage(Locale.ROOT));
      }
    }
  }

  private static final class Collector extends TreePathScanner<Void, Void> {
    private final String relative;
    private final String source;
    private final CompilationUnitTree unit;
    private final SourcePositions positions;
    private final List<Map<String, Object>> facts;
    private final Deque<String> types = new ArrayDeque<>();
    private final Deque<String> methods = new ArrayDeque<>();

    Collector(String relative, String source, CompilationUnitTree unit,
        SourcePositions positions, List<Map<String, Object>> facts) {
      this.relative = relative;
      this.source = source;
      this.unit = unit;
      this.positions = positions;
      this.facts = facts;
    }

    @Override public Void visitCompilationUnit(CompilationUnitTree node, Void unused) {
      if (node.getPackageName() != null) {
        String name = node.getPackageName().toString();
        add(node.getPackageName(), "java_package_fact", "declare", name, name, null,
            map("kind", "package"));
      }
      return super.visitCompilationUnit(node, unused);
    }

    @Override public Void visitImport(ImportTree node, Void unused) {
      add(node, "java_import_fact", "depend_on", node.getQualifiedIdentifier().toString(), null, null,
          map("static", node.isStatic()));
      return null;
    }

    @Override public Void visitClass(ClassTree node, Void unused) {
      String name = node.getSimpleName().toString();
      if (name.isEmpty()) return super.visitClass(node, unused);
      String qualified = types.isEmpty() ? name : types.peekLast() + "." + name;
      add(node, "java_type_fact", "declare", qualified, qualified, types.peekLast(), map(
          "kind", node.getKind().name().toLowerCase(Locale.ROOT),
          "modifiers", node.getModifiers().getFlags().stream().map(Object::toString).sorted().toList()));
      types.addLast(qualified);
      super.visitClass(node, unused);
      types.removeLast();
      return null;
    }

    @Override public Void visitMethod(MethodTree node, Void unused) {
      String raw = node.getName().toString();
      String name = "<init>".equals(raw) && !types.isEmpty()
          ? types.peekLast().substring(types.peekLast().lastIndexOf('.') + 1)
          : raw;
      String symbol = types.isEmpty() ? name : types.peekLast() + "." + name;
      add(node, "java_method_fact", "declare", symbol, symbol, types.peekLast(), map(
          "kind", "method", "parameterCount", node.getParameters().size(),
          "modifiers", node.getModifiers().getFlags().stream().map(Object::toString).sorted().toList()));
      methods.addLast(symbol);
      super.visitMethod(node, unused);
      methods.removeLast();
      return null;
    }

    @Override public Void visitVariable(VariableTree node, Void unused) {
      if (methods.isEmpty() && !types.isEmpty()) {
        String symbol = types.peekLast() + "." + node.getName();
        add(node, "java_field_fact", "declare", symbol, symbol, types.peekLast(), map("kind", "field"));
      }
      return super.visitVariable(node, unused);
    }

    @Override public Void visitMethodInvocation(MethodInvocationTree node, Void unused) {
      String callee = node.getMethodSelect().toString();
      add(node, "java_call_fact", "call", callee, methods.peekLast(), methods.peekLast(),
          map("callee", callee, "argumentCount", node.getArguments().size()));
      return super.visitMethodInvocation(node, unused);
    }

    @Override public Void visitNewClass(NewClassTree node, Void unused) {
      String callee = "new " + node.getIdentifier();
      add(node, "java_call_fact", "call", callee, methods.peekLast(), methods.peekLast(),
          map("callee", callee, "argumentCount", node.getArguments().size(), "constructor", true));
      return super.visitNewClass(node, unused);
    }

    private void add(Tree node, String kind, String action, String object,
        String symbol, String subject, Map<String, Object> metadata) {
      long rawStart = positions.getStartPosition(unit, node);
      long rawEnd = positions.getEndPosition(unit, node);
      int start = rawStart < 0 ? 0 : (int) Math.min(rawStart, source.length());
      int end = rawEnd < start ? start : (int) Math.min(rawEnd, source.length());
      int lineStart = rawStart < 0 ? 1 : (int) unit.getLineMap().getLineNumber(rawStart);
      int lineEnd = rawEnd < 0 ? lineStart : (int) unit.getLineMap().getLineNumber(Math.max(rawStart, rawEnd - 1));
      String excerpt = source.substring(start, Math.min(end, start + 2000));
      Map<String, Object> fact = new LinkedHashMap<>();
      fact.put("path", relative);
      fact.put("lineStart", Math.max(1, lineStart));
      fact.put("lineEnd", Math.max(lineStart, lineEnd));
      fact.put("kind", kind);
      fact.put("action", action);
      fact.put("object", object);
      fact.put("symbol", symbol);
      fact.put("subject", subject);
      fact.put("excerpt", excerpt);
      fact.put("contentHash", "");
      fact.put("metadata", metadata);
      facts.add(fact);
    }
  }

  private static Map<String, Object> map(Object... values) {
    Map<String, Object> output = new LinkedHashMap<>();
    for (int index = 0; index + 1 < values.length; index += 2) {
      output.put(String.valueOf(values[index]), values[index + 1]);
    }
    return output;
  }

  private static void emit(List<Map<String, Object>> facts, List<String> warnings) {
    System.out.println(json(map("facts", facts, "warnings", warnings)));
  }

  private static String json(Object value) {
    if (value == null) return "null";
    if (value instanceof Boolean || value instanceof Number) return value.toString();
    if (value instanceof String text) return "\"" + escape(text) + "\"";
    if (value instanceof Map<?, ?> map) {
      List<String> fields = new ArrayList<>();
      for (var entry : map.entrySet()) fields.add(json(String.valueOf(entry.getKey())) + ":" + json(entry.getValue()));
      return "{" + String.join(",", fields) + "}";
    }
    if (value instanceof Iterable<?> items) {
      List<String> encoded = new ArrayList<>();
      for (Object item : items) encoded.add(json(item));
      return "[" + String.join(",", encoded) + "]";
    }
    return json(value.toString());
  }

  private static String escape(String value) {
    StringBuilder output = new StringBuilder();
    for (int index = 0; index < value.length(); index++) {
      char character = value.charAt(index);
      switch (character) {
        case '\\' -> output.append("\\\\");
        case '"' -> output.append("\\\"");
        case '\n' -> output.append("\\n");
        case '\r' -> output.append("\\r");
        case '\t' -> output.append("\\t");
        default -> {
          if (character < 0x20) output.append(String.format("\\u%04x", (int) character));
          else output.append(character);
        }
      }
    }
    return output.toString();
  }

  private static String slash(String value) { return value.replace('\\', '/'); }
}
