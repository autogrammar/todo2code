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

| Model | Result | Time | Tokens | Cost | Fallback |
|---|---:|---:|---:|---:|---:|
| `google/gemini-3.6-flash` (fresh baseline) | PASS 6/6 | 106,700 ms | not recorded in comparison summary | $0.342992 | no |
| `google/gemini-3-flash-preview` | PASS 6/6 | 64,064 ms | 116,604 | $0.076411 | no |
| `mistralai/codestral-2508` | PASS 6/6 | 57,129 ms | 118,920 | $0.037994 | no |
| `deepseek/deepseek-v4-pro` | FAIL | >900,000 ms | no manifest | unmeasured | no result |

Codestral was about 1.87× faster and 9.0× cheaper than the fresh Gemini 3.6
baseline. Gemini 3 Flash Preview was about 1.67× faster and 4.49× cheaper.
DeepSeek was stopped at the declared run budget rather than allowed to hang.

## Cross-repository result

The first real repository run exposed sequential Markdown batches. On
`weekly`, Codestral enriched 161 records in six requests but needed 218,741 ms.
Bounded concurrency of three preserved response/record audit order and reduced
the same run to 53,362 ms (4.1× faster), with no degradation. The previously
timeouting `nlp2uri` then completed 619 records in 20 requests in 194,750 ms,
176,797 tokens and $0.08588244. A large deterministic `algitex` scan completed
2,643 Markdown records and the full pipeline in 9.4 seconds.

## Decision

Promote `mistralai/codestral-2508` to the explicit default. Keep
`google/gemini-3-flash-preview` as the first fallback/reference candidate.
The selection is operational: contract adherence, latency and cost are
measured; semantic quality still remains bounded by runtime validators and the
offline gold suite.

The live runner now enforces its total budget by aborting provider requests;
it also refuses to reuse a failed manifest older than the current attempt.
