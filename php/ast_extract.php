#!/usr/bin/env php
<?php
declare(strict_types=1);

/** Deterministic, dependency-free PHP syntax facts for todo2code. */

function argumentValue(array $arguments, string $name, ?string $fallback = null): ?string
{
    $index = array_search($name, $arguments, true);
    if ($index === false) return $fallback;
    return isset($arguments[$index + 1]) ? (string) $arguments[$index + 1] : $fallback;
}

function normalizedToken(mixed $token, int $line): array
{
    if (is_array($token)) return ['id' => $token[0], 'text' => $token[1], 'line' => $token[2]];
    return ['id' => null, 'text' => (string) $token, 'line' => $line];
}

function significant(array $tokens, int $index, int $direction): ?int
{
    for ($cursor = $index + $direction; isset($tokens[$cursor]); $cursor += $direction) {
        $id = $tokens[$cursor]['id'];
        if ($id === T_WHITESPACE || $id === T_COMMENT || $id === T_DOC_COMMENT) continue;
        return $cursor;
    }
    return null;
}

function qualifiedName(array $tokens, int $start): array
{
    $parts = [];
    $end = $start;
    $nameIds = array_filter([
        T_STRING,
        defined('T_NAME_QUALIFIED') ? constant('T_NAME_QUALIFIED') : null,
        defined('T_NAME_FULLY_QUALIFIED') ? constant('T_NAME_FULLY_QUALIFIED') : null,
        defined('T_NAME_RELATIVE') ? constant('T_NAME_RELATIVE') : null,
        defined('T_NS_SEPARATOR') ? constant('T_NS_SEPARATOR') : null,
    ], fn ($value) => $value !== null);
    for ($cursor = $start; isset($tokens[$cursor]); $cursor++) {
        $token = $tokens[$cursor];
        if (in_array($token['id'], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) continue;
        if (in_array($token['id'], $nameIds, true) || $token['text'] === '\\') {
            $parts[] = $token['text'];
            $end = $cursor;
            continue;
        }
        break;
    }
    return [trim(implode('', $parts), '\\'), $end];
}

function sourceExcerpt(array $lines, int $line): string
{
    return substr($lines[max(0, $line - 1)] ?? '', 0, 2000);
}

function addFact(array &$facts, string $path, array $lines, int $line, string $kind, string $action, string $object, ?string $symbol, ?string $subject, array $metadata = []): void
{
    $excerpt = sourceExcerpt($lines, $line);
    $facts[] = [
        'path' => $path,
        'lineStart' => max(1, $line),
        'lineEnd' => max(1, $line),
        'kind' => $kind,
        'action' => $action,
        'object' => $object === '' ? 'unknown' : $object,
        'symbol' => $symbol,
        'subject' => $subject,
        'excerpt' => $excerpt,
        'contentHash' => hash('sha256', $excerpt),
        'metadata' => $metadata,
    ];
}

function parseFile(string $absolutePath, string $relativePath): array
{
    $body = file_get_contents($absolutePath);
    if ($body === false) throw new RuntimeException('cannot read file');
    $lines = preg_split('/\R/u', $body) ?: [];
    $rawTokens = token_get_all($body, TOKEN_PARSE);
    $tokens = [];
    $line = 1;
    foreach ($rawTokens as $rawToken) {
        $token = normalizedToken($rawToken, $line);
        $tokens[] = $token;
        $line = $token['line'] + substr_count($token['text'], "\n");
    }

    $facts = [];
    $braceDepth = 0;
    $classAtDepth = [];
    $functionAtDepth = [];
    $pendingClass = null;
    $pendingFunction = null;
    $typeIds = [T_CLASS, T_INTERFACE, T_TRAIT];
    if (defined('T_ENUM')) $typeIds[] = constant('T_ENUM');

    foreach ($tokens as $index => $token) {
        $id = $token['id'];
        $text = $token['text'];
        $currentClass = empty($classAtDepth) ? null : end($classAtDepth);
        $currentFunction = empty($functionAtDepth) ? null : end($functionAtDepth);

        if ($text === '{') {
            $braceDepth++;
            if ($pendingClass !== null) {
                $classAtDepth[$braceDepth] = $pendingClass;
                $pendingClass = null;
            }
            if ($pendingFunction !== null) {
                $functionAtDepth[$braceDepth] = $pendingFunction;
                $pendingFunction = null;
            }
            continue;
        }
        if ($text === '}') {
            unset($classAtDepth[$braceDepth], $functionAtDepth[$braceDepth]);
            $braceDepth = max(0, $braceDepth - 1);
            continue;
        }

        if ($id === T_NAMESPACE) {
            $next = significant($tokens, $index, 1);
            if ($next !== null) {
                [$name] = qualifiedName($tokens, $next);
                if ($name !== '') addFact($facts, $relativePath, $lines, $token['line'], 'php_namespace_fact', 'declare', $name, null, null);
            }
            continue;
        }

        if ($id === T_USE && $currentFunction === null) {
            $next = significant($tokens, $index, 1);
            if ($next !== null) {
                [$name] = qualifiedName($tokens, $next);
                if ($name !== '') addFact($facts, $relativePath, $lines, $token['line'], 'php_import_fact', 'depend_on', $name, null, $currentClass);
            }
            continue;
        }

        if (in_array($id, $typeIds, true)) {
            $previous = significant($tokens, $index, -1);
            if ($id === T_CLASS && $previous !== null && $tokens[$previous]['id'] === T_DOUBLE_COLON) continue;
            $next = significant($tokens, $index, 1);
            if ($next !== null && $tokens[$next]['id'] === T_STRING) {
                $name = $tokens[$next]['text'];
                $kind = strtolower(token_name($id));
                addFact($facts, $relativePath, $lines, $token['line'], 'php_type_fact', 'declare', $name, $name, null, ['symbolKind' => $kind]);
                $pendingClass = $name;
            }
            continue;
        }

        if ($id === T_FUNCTION) {
            $next = significant($tokens, $index, 1);
            if ($next !== null && $tokens[$next]['text'] === '&') $next = significant($tokens, $next, 1);
            if ($next !== null && $tokens[$next]['id'] === T_STRING) {
                $name = $tokens[$next]['text'];
                $qualified = $currentClass ? $currentClass . '.' . $name : $name;
                addFact($facts, $relativePath, $lines, $token['line'], 'php_symbol_fact', 'declare', $qualified, $qualified, $currentClass, [
                    'symbolKind' => $currentClass ? 'method' : 'function',
                ]);
                $pendingFunction = $qualified;
            }
            continue;
        }

        if ($id === T_STRING) {
            $next = significant($tokens, $index, 1);
            if ($next === null || $tokens[$next]['text'] !== '(') continue;
            $previous = significant($tokens, $index, -1);
            if ($previous !== null && in_array($tokens[$previous]['id'], [T_FUNCTION, T_NEW], true)) continue;
            $callee = $text;
            if ($previous !== null && in_array($tokens[$previous]['id'], [T_DOUBLE_COLON, T_OBJECT_OPERATOR, T_NULLSAFE_OBJECT_OPERATOR], true)) {
                $owner = significant($tokens, $previous, -1);
                if ($owner !== null) $callee = $tokens[$owner]['text'] . '.' . $callee;
            }
            addFact($facts, $relativePath, $lines, $token['line'], 'php_call_fact', 'call', $callee, $currentFunction, $currentClass, ['callee' => $callee]);
        }
    }
    return $facts;
}

$arguments = array_slice($argv, 1);
$rootArgument = $arguments[0] ?? null;
if ($rootArgument === null) {
    fwrite(STDERR, "root argument is required\n");
    exit(2);
}
$root = realpath($rootArgument);
if ($root === false || !is_dir($root)) {
    fwrite(STDERR, "root does not exist\n");
    exit(2);
}
$maxFileBytes = (int) (argumentValue($arguments, '--max-file-bytes', '524288') ?? '524288');
$filesFrom = argumentValue($arguments, '--files-from');
$relativePaths = [];
if ($filesFrom !== null) {
    $decoded = json_decode((string) file_get_contents($filesFrom), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($decoded)) throw new RuntimeException('--files-from must contain a JSON array');
    foreach ($decoded as $value) {
        if (!is_string($value)) throw new RuntimeException('--files-from must contain path strings');
        $relativePaths[] = $value;
    }
}

$facts = [];
$warnings = [];
foreach (array_values(array_unique($relativePaths)) as $relativePath) {
    $candidate = realpath($root . DIRECTORY_SEPARATOR . $relativePath);
    $rootPrefix = rtrim($root, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    if ($candidate === false || !str_starts_with($candidate, $rootPrefix) || pathinfo($candidate, PATHINFO_EXTENSION) !== 'php' || is_link($root . DIRECTORY_SEPARATOR . $relativePath)) continue;
    try {
        if (filesize($candidate) > $maxFileBytes) {
            $warnings[] = "skipped oversized PHP file: {$relativePath}";
            continue;
        }
        array_push($facts, ...parseFile($candidate, str_replace('\\', '/', $relativePath)));
    } catch (ParseError|RuntimeException $error) {
        $warnings[] = "{$relativePath}: {$error->getMessage()}";
    }
}

usort($facts, fn (array $left, array $right) => [$left['path'], $left['lineStart'], $left['kind'], $left['object']] <=> [$right['path'], $right['lineStart'], $right['kind'], $right['object']]);
$seen = [];
$facts = array_values(array_filter($facts, function (array $fact) use (&$seen): bool {
    $identity = implode("\0", [$fact['path'], (string) $fact['lineStart'], $fact['kind'], $fact['object'], (string) ($fact['symbol'] ?? '')]);
    if (isset($seen[$identity])) return false;
    $seen[$identity] = true;
    return true;
}));
echo json_encode(['facts' => $facts, 'warnings' => $warnings], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), "\n";
