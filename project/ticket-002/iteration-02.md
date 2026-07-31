# Iteration 02: tracked audit references in generated-analysis isolation

## Trigger

After `HEAD` advanced to `18cc21b`, a fresh tracked-only `project.sh` run
generated `project/index.html` from the detached snapshot and then failed:

```text
project/index.html references untracked input nlp2uri.yaml
```

The generator had not read that private file. Its name was already present in
the committed ticket audit as captured `git status --short` output, and the
HTML report quoted that tracked log.

## Correction

The verifier now distinguishes:

- a reference newly introduced by generated output — still rejected;
- a filename already quoted by a tracked, non-generated source — accepted as
  tracked evidence, not proof that the untracked file was consumed.

Generated reports are excluded from the tracked-reference corpus so a stale
report cannot justify itself. Binary tracked files are also excluded.

## Red/green evidence

A focused regression first failed with 3/4 passing. After the correction all
4/4 generated-analysis tests pass, including the original hard negative that
rejects a newly introduced private input reference.

The complete tracked-only `project.sh` command then passed:

```text
{"filesChecked":18,"untrackedInputsChecked":6,"status":"ok"}
```

The final `npm run verify` passed 242 tests (241 pass, one local Java skip) and
Docker smoke passed after this change.
