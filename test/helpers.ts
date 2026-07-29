import type { T2CConfig } from '../src/config/env.js';

export function makeConfig(root: string): T2CConfig {
  return {
    root,
    outputDir: '.intent',
    gitCommitCount: 10,
    maxFileBytes: 524_288,
    documentConcurrency: 3,
    pythonExecutable: 'python3',
    enablePythonAst: true,
    goExecutable: 'go',
    enableGoAst: false,
    allowOutsideRoot: false,
    enableTensorFlow: false,
    tensorflowModelPath: null,
    tensorflowLabels: ['add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'unknown'],
    documentPatterns: ['README.md', 'docs/**/*.md'],
    documentExcludes: ['node_modules/**', '.git/**', 'dist/**', '.intent/**', 'TODO.md', 'CHANGELOG.md'],
    openRouter: {
      apiKey: null,
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'test/model',
      documentModel: 'test/model',
      summaryModel: 'test/model',
      siteUrl: null,
      appName: 'todo2code-test',
      timeoutMs: 5000,
      maxTokens: 2000,
      temperature: 0,
      requireStructuredOutput: true,
      responseHealing: false,
    },
    mcp: { serverName: 'todo2code-test', serverVersion: '0.1.0' },
    a2a: {
      host: '127.0.0.1',
      port: 0,
      publicUrl: 'http://127.0.0.1:0/a2a',
      token: null,
      maxBodyBytes: 1_048_576,
      taskStorePath: null,
    },
  };
}
