<?php

declare(strict_types=1);

namespace Todo2Code;

/**
 * Client for the todo2code A2A v1.0 endpoint.
 *
 * Uses only the PHP standard library (streams + json), matching the project's
 * dependency-free posture. Every action goes through `SendMessage`; `call()`
 * unwraps the first JSON artifact so callers work with plain arrays.
 */
final class Client
{
    public const A2A_VERSION = '1.0';

    public const ACTIONS = [
        'extract_nl',
        'extract_git',
        'extract_ast',
        'extract_markdown',
        'extract_docs',
        'link',
        'diagnose',
        'summarize',
        'diff',
        'diff_files',
        'diff_git',
        'reality',
        'compare_workspace',
        'pipeline',
    ];

    private string $baseUrl;

    private ?string $token;

    private float $timeout;

    private int $counter = 0;

    public function __construct(
        string $baseUrl = 'http://localhost:8787',
        ?string $token = null,
        float $timeout = 120.0
    ) {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->token = $token !== null && $token !== '' ? $token : null;
        $this->timeout = $timeout;
    }

    /** @return array<string,mixed> */
    public function health(): array
    {
        return $this->get('/healthz');
    }

    /** @return array<string,mixed> */
    public function agentCard(): array
    {
        return $this->get('/.well-known/agent-card.json');
    }

    /**
     * Runs one action and returns the raw A2A task.
     *
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public function send(string $action, array $input = []): array
    {
        if (!in_array($action, self::ACTIONS, true)) {
            throw new \InvalidArgumentException(
                sprintf('Unknown action "%s"; expected one of %s', $action, implode(', ', self::ACTIONS))
            );
        }

        $message = [
            'messageId' => $this->nextId('msg'),
            'role' => 'ROLE_USER',
            'parts' => [[
                'data' => ['action' => $action, 'input' => (object) $input],
                'mediaType' => 'application/json',
            ]],
        ];

        $result = $this->rpc('SendMessage', ['message' => $message]);

        // SendMessage wraps the task as {"task": ...}; GetTask returns it bare.
        return isset($result['task']) && is_array($result['task']) ? $result['task'] : $result;
    }

    /**
     * Runs one action and unwraps the first JSON artifact.
     *
     * @param array<string,mixed> $input
     * @return mixed
     */
    public function call(string $action, array $input = [])
    {
        $task = $this->send($action, $input);
        $state = $task['status']['state'] ?? 'UNKNOWN';

        if ($state !== 'TASK_STATE_COMPLETED') {
            $detail = '';
            foreach ($task['status']['message']['parts'] ?? [] as $part) {
                $detail .= $part['text'] ?? '';
            }
            throw new Error(
                sprintf('Task %s ended in %s%s', $task['id'] ?? '?', $state, $detail !== '' ? ': ' . $detail : ''),
                -32000
            );
        }

        foreach ($task['artifacts'] ?? [] as $artifact) {
            foreach ($artifact['parts'] ?? [] as $part) {
                if (array_key_exists('data', $part)) {
                    return $part['data'];
                }
            }
        }

        throw new Error(sprintf('Task %s returned no JSON artifact', $task['id'] ?? '?'), -32001);
    }

    /**
     * Performs one JSON-RPC call and returns the raw result.
     *
     * @param array<string,mixed> $params
     * @return array<string,mixed>
     */
    public function rpc(string $method, array $params)
    {
        $body = json_encode([
            'jsonrpc' => '2.0',
            'id' => $this->nextId('req'),
            'method' => $method,
            'params' => (object) $params,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        $payload = $this->request('POST', '/a2a', $body);

        if (isset($payload['error']) && $payload['error'] !== null) {
            throw new Error(
                (string) ($payload['error']['message'] ?? 'unknown error'),
                (int) ($payload['error']['code'] ?? -32000),
                $payload['error']['data'] ?? null
            );
        }

        return $payload['result'] ?? [];
    }

    // -- convenience wrappers -------------------------------------------------

    /** @return array<string,mixed> */
    public function extractAst(string $root = '.'): array
    {
        return $this->call('extract_ast', ['root' => $root]);
    }

    /** @return array<string,mixed> */
    public function extractNl(string $file, string $root = '.', ?string $nlMode = null): array
    {
        $input = ['file' => $file, 'root' => $root];
        if ($nlMode !== null) {
            $input['nlMode'] = $nlMode;
        }
        return $this->call('extract_nl', $input);
    }

    /**
     * @param array<int,string>|null $patterns
     * @param array<int,string>|null $excludes
     * @return array<string,mixed>
     */
    public function extractDocs(string $root = '.', ?array $patterns = null, ?array $excludes = null): array
    {
        $input = ['root' => $root];
        if ($patterns !== null) {
            $input['patterns'] = $patterns;
        }
        if ($excludes !== null) {
            $input['excludes'] = $excludes;
        }
        return $this->call('extract_docs', $input);
    }

    /** @return array<string,mixed> */
    public function extractMarkdown(string $root = '.', ?string $markdownMode = null): array
    {
        $input = ['root' => $root];
        if ($markdownMode !== null) {
            $input['markdownMode'] = $markdownMode;
        }
        return $this->call('extract_markdown', $input);
    }

    /** @return array<string,mixed> */
    public function extractGit(string $root = '.', int $count = 10): array
    {
        return $this->call('extract_git', ['root' => $root, 'count' => $count]);
    }

    /**
     * @param array<int,mixed> $records
     * @return array<string,mixed>
     */
    public function link(array $records): array
    {
        return $this->call('link', ['records' => $records]);
    }

    /**
     * @param array<string,mixed> $graph
     * @return array<string,mixed>
     */
    public function diagnose(array $graph): array
    {
        return $this->call('diagnose', ['graph' => $graph]);
    }

    /**
     * @param array<string,mixed> $graph
     * @param array<string,mixed>|null $diagnostics
     * @param array<string,mixed> $options
     * @return array<string,mixed>
     */
    public function reality(array $graph, ?array $diagnostics = null, array $options = []): array
    {
        $input = ['graph' => $graph] + $options;
        if ($diagnostics !== null) {
            $input['diagnostics'] = $diagnostics;
        }

        return $this->call('reality', $input);
    }

    /**
     * @param array<string,mixed> $options
     * @return array<string,mixed>
     */
    public function diffGit(array $options = []): array
    {
        return $this->call('diff_git', $options);
    }

    /**
     * @param array<string,mixed> $options
     * @return array<string,mixed>
     */
    public function diffFiles(string $before, string $after, array $options = []): array
    {
        return $this->call('diff_files', ['before' => $before, 'after' => $after] + $options);
    }

    /**
     * @param array<string,mixed> $before
     * @param array<string,mixed> $after
     * @return array<string,mixed>
     */
    public function diffGraphs(array $before, array $after, bool $includeSvg = true): array
    {
        return $this->call('diff', [
            'beforeGraph' => $before,
            'afterGraph' => $after,
            'includeSvg' => $includeSvg,
        ]);
    }

    /**
     * @param array<string,mixed> $options
     * @return array<string,mixed>
     */
    public function compareWorkspace(array $options = []): array
    {
        return $this->call('compare_workspace', $options);
    }

    /**
     * @param array<string,mixed> $options
     * @return array<string,mixed>
     */
    public function pipeline(array $options = []): array
    {
        return $this->call('pipeline', $options);
    }

    // -- transport ------------------------------------------------------------

    /** @return array<string,mixed> */
    private function get(string $path): array
    {
        return $this->request('GET', $path, null);
    }

    /**
     * @return array<string,mixed>
     */
    private function request(string $method, string $path, ?string $body): array
    {
        $headers = [
            'Accept: application/json',
            'A2A-Version: ' . self::A2A_VERSION,
        ];
        if ($body !== null) {
            $headers[] = 'Content-Type: application/json';
        }
        if ($this->token !== null) {
            $headers[] = 'Authorization: Bearer ' . $this->token;
        }

        $context = stream_context_create([
            'http' => [
                'method' => $method,
                'header' => implode("\r\n", $headers),
                'content' => $body ?? '',
                'timeout' => $this->timeout,
                // Read the body on 4xx/5xx instead of throwing, so JSON-RPC
                // error payloads reach the caller intact.
                'ignore_errors' => true,
            ],
        ]);

        $raw = @file_get_contents($this->baseUrl . $path, false, $context);
        if ($raw === false) {
            throw new Error(sprintf('Connection to %s%s failed', $this->baseUrl, $path), -32003);
        }

        $status = $this->statusFromHeaders($http_response_header ?? []);

        try {
            $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new Error(
                sprintf('Invalid JSON from %s%s (HTTP %d): %s', $this->baseUrl, $path, $status, substr($raw, 0, 200)),
                $status
            );
        }

        if (!is_array($decoded)) {
            throw new Error(sprintf('Expected JSON object from %s%s', $this->baseUrl, $path), $status);
        }

        if ($status >= 400 && !isset($decoded['error'])) {
            throw new Error(sprintf('HTTP %d from %s%s', $status, $this->baseUrl, $path), $status);
        }

        return $decoded;
    }

    /** @param array<int,string> $headers */
    private function statusFromHeaders(array $headers): int
    {
        foreach ($headers as $header) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $header, $matches) === 1) {
                return (int) $matches[1];
            }
        }

        return 0;
    }

    private function nextId(string $prefix): string
    {
        $this->counter++;

        return sprintf('%s-%d-%d', $prefix, (int) (microtime(true) * 1000), $this->counter);
    }
}
