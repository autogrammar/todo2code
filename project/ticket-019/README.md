# Ticket 019: Publish the Python SDK as the root todo2code package

- **ID**: ticket-019
- **Owner**: unresolved:human
- **Status**: BACKLOG
- **Workflow state**: WAIT_FOR_APPROVAL
- **Created**: 2026-08-01

## Goal and scope

Publish the dependency-free Python SDK from the repository root as the PyPI
distribution `todo2code`. The root `pyproject.toml` becomes the single Python
package manifest, while `sdk/python/pyproject.toml` is removed. The distribution
contains only the existing `todo2code` package and `todo2code_sdk` compatibility
module; it does not embed the TypeScript runtime or the rest of the repository.

The user selected the root distribution name `todo2code`, removal of the nested
manifest and an SDK-only package. Python artifacts will coexist with the
TypeScript build under `dist/`: `python -m build` does not clean that directory,
and the Goal publish command remains restricted to
`dist/todo2code-{version}*`.

`goal.yaml` must declare the Python project type and version the root manifest.
The existing `make python-wheel` target must build from the root after removal
of the nested manifest. Tickets 018 and 035 are now DONE. Ticket-035 declared
all five publication paths as integration-owned shared contracts, so this
ticket can perform the atomic change under the `integration` workstream.

## Planned changed paths

- `pyproject.toml`: root PEP 517/PEP 621 package metadata and setuptools mapping
  to `sdk/python`.
- `goal.yaml`: add the Python strategy to the project and move versioning from
  the nested manifest to `pyproject.toml`.
- `sdk/python/pyproject.toml`: remove the superseded nested manifest.
- `sdk/python/README.md`: update root installation/build examples and artifact
  names.
- `Makefile`: make `python-wheel` build the root distribution.
- `TODO.md`, `project/TICKETS.md` and `project/ticket-019/**`: governance and
  acceptance evidence only.

## Acceptance criteria

- [x] AC-01: A human owner approves this exact scope before build metadata is
      changed.
- [ ] AC-02: `python -m build` at the repository root produces
      `todo2code-<version>.tar.gz` and `todo2code-<version>-py3-none-any.whl`
      without deleting the TypeScript contents already present in `dist/`.
- [ ] AC-03: The wheel contains only the `todo2code` package, the
      `todo2code_sdk` compatibility module and required distribution metadata;
      it does not contain repository application sources or generated TS files.
- [ ] AC-04: `sdk/python/pyproject.toml` is removed and root/local installation
      instructions use the root `pyproject.toml` without breaking
      `make python-wheel`.
- [ ] AC-05: `goal info` detects both Node.js and Python, version synchronization
      targets the root manifest, and `goal --dry-run -a` selects the bounded
      `twine upload dist/todo2code-{version}*` publication command.
- [ ] AC-06: `twine check` passes for both artifacts and a clean virtual
      environment can import `todo2code` and `todo2code_sdk` with the expected
      version and no third-party runtime dependencies.
- [ ] AC-07: Existing application verification and SDK examples remain green;
      no unrelated ticket-018 or local worktree changes are modified or
      attributed to this ticket.

## Participants

- Human participant: unresolved; no user-* file was created by this script.
- Agent participant: [ai-codex.md](ai-codex.md)

## Approval boundary

- Current state: `BACKLOG / WAIT_FOR_APPROVAL`.
- Required response from: `unresolved:human`.
- The current user instruction authorizes implementation for this session but is not trusted
  merge evidence; the repository still requires its external governance gate.
- Tickets 018 and 035 are DONE, so there is no active dependency or ownership
  conflict. This scope-update commit remains plan-only; implementation starts
  in the next commit.
