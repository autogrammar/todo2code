# Iteration 01: exact file-update bookkeeping

## Result

Keep the change. An exact `Update <file>` row no longer creates an
implementation-gap or unlinked-record diagnostic. Additional wording keeps the
record actionable.

| Repository | Graph | Changelog before → after | Unlinked before → after |
| --- | --- | ---: | ---: |
| semcod/code2llm | unchanged | 955 → 650 | 1,312 → 1,219 |
| semcod/domd | unchanged | 99 → 99 | 772 → 772 |
| semcod/pactfix | unchanged | 48 → 48 | 217 → 217 |
| semcod/code2logic | unchanged | 120 → 109 | 1,503 → 1,492 |
| semcod/code2docs | unchanged | 269 → 127 | 455 → 418 |
| semcod/redup | unchanged | 269 → 184 | 703 → 661 |
| subactor/platform | unchanged | 93 → 89 | 766 → 761 |

Across the corpus:

- `CHANGELOG_WITHOUT_IMPLEMENTATION`: 1,853 → 1,306 (`-547`);
- `UNLINKED_RECORD`: 5,728 → 5,540 (`-188`);
- all diagnostics: 16,280 → 15,545 (`-735`);
- graph fingerprints: unchanged in 7/7 repositories.

`domd` and `pactfix` contained no selected file-only rows and therefore remained
unchanged. Gold v2 stayed perfect before the full validation phase.

## Precision boundaries

Suppressed:

- `Update src/runtime.ts`
- `Update README.md`
- `update debug/.cache/state.pkl`

Retained:

- `Update src/runtime.ts to reject invalid tokens`
- `Updated authentication in src/runtime.ts`
- `Update support for Dockerfile parsing`
- `Added Jenkinsfile support for deployment pipelines`

Machine-readable run IDs, fingerprints and deltas are in
[`iteration-01.json`](iteration-01.json).
