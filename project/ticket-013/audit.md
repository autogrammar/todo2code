# Ticket 013 audit

## Baseline

`google/gemini-3.6-flash`: PASS 6/6, 125,486 ms, 177,953 tokens,
$0.412363, no fallback or degradation.

## Candidate screening

| Model | Structured output | Prompt / completion per 1M | Context |
|---|---|---:|---:|
| `google/gemini-3-flash-preview` | yes | $0.50 / $3.00 | 1,048,576 |
| `mistralai/codestral-2508` | yes | $0.30 / $0.90 | 256,000 |
| `deepseek/deepseek-v4-pro` | yes | $0.435 / $0.87 | 1,048,576 |

## Live results

Pending.
