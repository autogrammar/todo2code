# Ticket 006 audit

## Retained hardening

- canonical internal response definition:
  `src/semantic/reranker-response.ts`;
- shared verdict/reason values and compatibility rule:
  `src/semantic/reranker.ts`;
- provider call uses that schema directly;
- published decision schema is checked for drift in the full test suite;
- runtime rejects unknown/missing properties, wrong scalar types, invalid IDs,
  blank strings and contradictory verdict/reason pairs without coercion;
- error diagnostics contain only the failing path and
  provider/model/response ID.

## Provider comparison

Both routes used the same six-candidate top-1 shortlist from the clean tracked
`subactor/platform` commit
`3e96573d587cb664741849ceba205bf303b9f418`.

| Requested route | Result |
|---|---|
| `qwen/qwen3.7-plus` | rejected in ticket-005: missing `decisions`, renamed `judgments`, then invalid confidence |
| `qwen/qwen3.7-flash` | rejected: `response.decisions[0] contains unknown properties: decision` |

The Flash response identity was
`Alibaba/qwen/qwen3.7-flash/gen-1785490219-noOw2NdfoPMqC6dLf7x6`.
No raw provider response is stored. No relation was materialized by either
route.

## Communication ownership follow-up

The final ticket has 13 agent records and deliberately no agent-authored human
file. Analysis raises three `AGENT_WORK_OUTSIDE_REQUEST` warnings with
`responseRequiredRole=human`, but `responseRequiredFrom=[]` because no human
participant record exists. The role is correct; the concrete routing target is
unresolved.

This must not be "fixed" by having an agent create `user-*`. A later ticket
should either route through a trusted participant/owner registry or emit an
explicit unresolved-human sentinel and migration issue.

## Gates

- `npm run verify`: 252 tests, 251 pass, 0 fail, 1 local JDK skip;
- gold v2 and v1: PASS;
- gold v2: captured reranker 6/6, zero forbidden violations, one abstention;
- examples: 227 records, 97 relations, five SDKs: PASS;
- dependency audit: 0 vulnerabilities;
- CLI, MCP, A2A and Docker smoke: PASS.
