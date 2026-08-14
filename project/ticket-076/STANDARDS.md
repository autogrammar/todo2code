# Standards assessment for ticket-076

This assessment records the local standards evidence inspected on 2026-08-14.
It guides the API shape but does not turn a development checkout into a
normative dependency or a trusted approval source.

## Adoption matrix

| Standard | Inspected identity | Role in ticket-076 |
| --- | --- | --- |
| `wellmanifest/new-project` | todo2code is pinned to `0.14.0`; the inspected upstream checkout is unmerged branch `ticket/078-home-adopt-placement` at `0b38f1bdf5c55cad6b54ad54ba89824a9eaeea78`, version `0.17.0` | Normative only through todo2code's existing immutable `0.14.0` governance package. Do not copy the upstream branch's unpublished `placement` field. |
| `wellmanifest/dsl` | `b7d0595c95e5abbb48ebfdbdae0bc6d43c6f82f4`, version `0.1.0-dev`, pre-stable normative draft; manifest-schema digest `sha256:34d356b76bbd483372df84bb986e15bb84e9c1f8b11b7dc9e3a6c7276c85ed13` | Design constraint: one canonical JSON representation, explicit ownership/provenance/effects, strict validation and no authority minted by a DSL or model. Ticket-076 does not yet claim manifest conformance. |
| `wellmanifest/modularity` | `1c8c94ee7e13ab95af3ab734b9548ebdfc4a7c20`, version `0.1.0-dev`, experimental | Design constraint: one-way dependencies, single exporter for the Intent contract, projections remain rebuildable, and composition does not copy semantics or transfer authority/state ownership. |
| `wellmanifest/merge` | `5776debf6aaf999f542db37d535da7c8733b82c8`, version `0.1.0-dev` | Delivery-only guidance. Analytical evidence may inform a later merge disposition but cannot merge, delete or publish this branch. No merge-decision runtime belongs in a source converter. |
| `wellmanifest/poa` | `8424a7f5c977915ee08404b8b82d63e0f5e44ea2`, version `0.1.0` | Boundary constraint: these APIs analyze and describe; they never grant or execute effects. Optional caches are rebuildable local projections, not authority or owned repository state. |
| `wellmanifest/ssot` | `5d35394af81838bedb3f21d0894363cd18779d4c`, version `0.2.0-dev`, experimental | Implementation constraint: keep existing extractors canonical, add facade re-exports only, and prove parity so logic cannot fork into `code2dsl`, `docs2dsl` or `config2dsl`. |
| `wellmanifest/env-dsl` | `0.1.0-dev`, no Git commit; all content is uncommitted and ticket-001 is `BLOCKED` | Informative only. Do not pin, import or claim conformance. Preserve its safe direction: environment values are data; do not evaluate/interpolate them, emit secrets, or treat `.env` as repository DSL evidence. |

## Applicable architecture decisions

### Canonical contract and adapter envelope

The canonical semantic unit remains one closed JSON AST record conforming to
`schemas/intent-record.schema.json` with `schemaVersion: t2c.intent/v1`.
`ExtractionResult` is an operational adapter envelope containing a collection
of those documents plus non-semantic warnings. It is not a new DSL and must not
receive a fabricated schema identity.

JSONL and future text/TOON renderings are projections. Ticket-076 neither
changes their semantics nor introduces another canonical representation.

### Module and SSOT boundaries

`code2dsl`, `docs2dsl` and `config2dsl` are repo-local facades, not new semantic
owners and not independent repositories. Each facade delegates to exactly one
existing extractor and validates the resulting records through the shared core
validator. The adapters must not import one another. The Intent record schema
and its runtime validator retain sole contract ownership.

A parity regression must compare each facade with its canonical extractor for
the same explicit root, inputs and configuration. The facade may normalize
only its public call shape and documentation-file discovery; it may not fork
parsing, provenance, warning or cache semantics.

### Effects, state and authority

The APIs never mutate the analyzed repository, execute a proposed change,
create an approval or infer authority from input. Reading files and invoking
the existing allowlisted syntax adapters are analysis operations. An enabled
AST content cache is a rebuildable projection under the configured output
directory and must remain explicitly represented by existing cache evidence.

No merge disposition, POA execution envelope, grant, receipt or SSOT decision
is accepted or produced by this ticket.

### Configuration and environment

Every facade requires an explicit `T2CConfig`; neither implementation nor
conformance tests depend on ambient environment state. This preserves the
existing deterministic no-LLM import boundary and prevents a standalone source
converter from silently loading provider credentials. The facades add no
environment evaluation, interpolation or secret output. `config2dsl` may
analyze `.env.example` through the existing structural extractor and must
continue to exclude actual `.env` secret material.

## Visible prerequisites for formal Wellmanifest adoption

Formal `wellmanifest.dsl/manifest/v1` adoption is a separate integration
workstream because it owns a new root manifest, artifact digests, command or
document vocabulary, normalized finding producers and protected conformance
commands. It cannot be smuggled into an extractor ticket.

The following local evidence also prevents pretending that one complete
standards lock exists today:

- Modularity still pins Wellmanifest DSL revision
  `550e5f441c709e15f2679c1af151352d1eba2f1e`, while the inspected SSOT lock
  pins `b7d0595c95e5abbb48ebfdbdae0bc6d43c6f82f4`.
- Modularity's standards reference still describes POA as uncommitted, while
  the inspected POA repository now has commit
  `8424a7f5c977915ee08404b8b82d63e0f5e44ea2`.
- `env-dsl` has no immutable revision and its own first implementation ticket
  is blocked.
- Todo2code's current governance contract accepts new-project intent v3 as
  pinned by `0.14.0`; it must not consume the unmerged upstream `placement`
  extension from a working tree.

Before a future integration ticket creates `dsl-manifest.json` or a modularity
workspace, it must choose and verify exact immutable revisions and SHA-256
contract digests, reconcile these stale references upstream or record them as
explicit informative mappings, and run the standards' deterministic checkers.
