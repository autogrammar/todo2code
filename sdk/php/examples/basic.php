#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Usage test for the todo2code PHP SDK.
 *
 * Start the server first:
 *   node dist/src/interfaces/a2a.js
 *
 * Then run:
 *   php sdk/php/examples/basic.php
 */

// Minimal PSR-4 autoloader so the example runs without `composer install`.
spl_autoload_register(static function (string $class): void {
    if (!str_starts_with($class, 'Todo2Code\\')) {
        return;
    }
    $relative = str_replace('\\', '/', substr($class, strlen('Todo2Code\\')));
    $file = __DIR__ . '/../src/' . $relative . '.php';
    if (is_file($file)) {
        require_once $file;
    }
});

use Todo2Code\Client;
use Todo2Code\Error;

$baseUrl = getenv('T2C_A2A_URL') ?: 'http://localhost:8787';
$token = getenv('T2C_A2A_TOKEN') ?: null;
$root = getenv('T2C_EXAMPLE_ROOT') ?: 'examples/backend';

try {
    $client = new Client($baseUrl, $token);

    echo 'health: ' . json_encode($client->health(), JSON_UNESCAPED_SLASHES) . PHP_EOL;

    $card = $client->agentCard();
    $skills = array_map(static fn (array $skill): string => $skill['id'], $card['skills'] ?? []);
    echo 'agent skills: ' . implode(', ', $skills) . PHP_EOL;

    // 1. Deterministic extraction -> graph -> diagnostics.
    $ast = $client->extractAst($root);
    $markdown = $client->extractMarkdown($root);
    $records = array_merge($ast['records'] ?? [], $markdown['records'] ?? []);
    printf("extracted %d records from %s%s", count($records), $root, PHP_EOL);

    $graph = $client->link($records);
    echo 'graph fingerprint: ' . substr((string) ($graph['fingerprint'] ?? ''), 0, 16) . PHP_EOL;
    echo 'records by source: ' . json_encode($graph['stats']['bySource'] ?? []) . PHP_EOL;

    $report = $client->diagnose($graph);
    echo 'diagnostics: ' . json_encode($report['counts'] ?? []) . PHP_EOL;
    foreach (array_slice($report['diagnostics'] ?? [], 0, 3) as $diagnostic) {
        printf("  - [%s] %s: %s%s", $diagnostic['severity'], $diagnostic['code'], $diagnostic['title'], PHP_EOL);
    }

    // 2. Intent-vs-reality view.
    $reality = $client->reality($graph, $report, ['gapsOnly' => true, 'includeSvg' => true]);
    echo 'reality svg bytes: ' . strlen((string) ($reality['svg'] ?? '')) . PHP_EOL;

    // 3. Git diff rendered as SVG.
    $diff = $client->diffGit(['root' => $root, 'revision' => 'HEAD', 'includeSvg' => true]);
    printf(
        "git diff files: %d, svg bytes: %d%s",
        count($diff['diffs'] ?? []),
        strlen((string) ($diff['svg'] ?? '')),
        PHP_EOL
    );

    // 4. Optional origin/main -> local filesystem Intent comparison.
    if (getenv('T2C_COMPARE_WORKSPACE') === '1') {
        $comparison = $client->compareWorkspace([
            'root' => $root,
            'base' => getenv('T2C_COMPARE_BASE') ?: 'origin/main',
        ]);
        echo 'workspace trend: ' . ($comparison['trend']['direction'] ?? 'unknown') . PHP_EOL;
    }

    echo 'OK' . PHP_EOL;
    exit(0);
} catch (Error $error) {
    fwrite(STDERR, sprintf("example failed: %s (code %d)%s", $error->getMessage(), $error->getCode(), PHP_EOL));
    exit(1);
}
