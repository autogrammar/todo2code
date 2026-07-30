#!/usr/bin/env bash
set -euo pipefail

# Keep routine package checks quiet; this script already controls upgrades.
export PIP_DISABLE_PIP_VERSION_CHECK=1

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SEMCOD_ROOT="${SEMCOD_ROOT:-$(dirname "$PROJECT_ROOT")}"
ANALYSIS_SOURCE_MODE="${T2C_ANALYSIS_SOURCE:-tracked}"
APPLY_PREFACT="${T2C_APPLY_PREFACT:-0}"

VENV="$PROJECT_ROOT/venv"
PIP="$VENV/bin/pip"

cd "$PROJECT_ROOT"

if [ ! -f "$PIP" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV"
fi

install_project_package() {
    local package="$1"
    local local_package="$SEMCOD_ROOT/$package"

    if [ -f "$local_package/pyproject.toml" ]; then
        echo "Installing local $package..."
        "$PIP" install --editable "$local_package" --quiet
    else
        echo "Installing $package from PyPI..."
        "$PIP" install "$package" --upgrade --quiet
    fi
}

if [ "${T2C_SKIP_TOOL_INSTALL:-0}" != "1" ]; then
    for package in regix prefact vallm redup glon goal code2logic code2llm code2docs; do
        install_project_package "$package"
    done
fi

ANALYSIS_TEMP=""
cleanup_analysis_snapshot() {
    if [ -n "$ANALYSIS_TEMP" ] && [ -d "$ANALYSIS_TEMP" ]; then
        git worktree remove --force "$ANALYSIS_TEMP/todo2code" >/dev/null 2>&1 || true
        rm -rf -- "$ANALYSIS_TEMP"
    fi
}
trap cleanup_analysis_snapshot EXIT

case "$ANALYSIS_SOURCE_MODE" in
    tracked)
        ANALYSIS_TEMP="$(mktemp -d /tmp/t2c-analysis.XXXXXX)"
        ANALYSIS_ROOT="$ANALYSIS_TEMP/todo2code"
        git worktree add --detach "$ANALYSIS_ROOT" HEAD >/dev/null
        ;;
    workspace)
        ANALYSIS_ROOT="$PROJECT_ROOT"
        echo "WARNING: T2C_ANALYSIS_SOURCE=workspace includes uncommitted and untracked files." >&2
        ;;
    *)
        echo "T2C_ANALYSIS_SOURCE must be 'tracked' or 'workspace'" >&2
        exit 2
        ;;
esac

run_analysis_tool() {
    (cd "$ANALYSIS_ROOT" && "$@")
}

# Namespace contract: root-level files under project/ are technical analysis;
# communication lives only under recognised project/<ticket>/ directories.
# Keep this output path for compatibility with project/analysis.toon.yaml.
# By default every generator sees a detached snapshot of HEAD, never local
# untracked files or partially edited tracked files. Set
# T2C_ANALYSIS_SOURCE=workspace only for an explicitly local, unpublished run.
#$VENV/bin/code2llm ./ -f toon,evolution,code2logic,project-yaml -o ./project --no-chunk
run_analysis_tool "$VENV/bin/code2llm" ./ -f all -o ./project --no-chunk
#$VENV/bin/code2llm report --format all       # → all views
rm -f -- "$ANALYSIS_ROOT/project/analysis.json"
rm -f -- "$ANALYSIS_ROOT/project/analysis.yaml"

run_analysis_tool "$VENV/bin/code2docs" generate ./ --readme-only
node "$PROJECT_ROOT/scripts/sync-generated-readme-metadata.mjs" "$ANALYSIS_ROOT" "$ANALYSIS_ROOT/docs/README.md"
run_analysis_tool "$VENV/bin/redup" scan . --format toon --output ./project
#$VENV/bin/redup scan . --functions-only -f toon --output ./project
#$VENV/bin/vallm batch ./src --recursive --semantic --model qwen2.5-coder:7b
#$VENV/bin/vallm batch --parallel .
run_analysis_tool "$VENV/bin/vallm" batch . --recursive --format toon --output ./project

if [ "$ANALYSIS_ROOT" != "$PROJECT_ROOT" ]; then
    while IFS= read -r -d '' generated; do
        cp -- "$generated" "$PROJECT_ROOT/project/$(basename "$generated")"
    done < <(find "$ANALYSIS_ROOT/project" -maxdepth 1 -type f -print0)
    cp -- "$ANALYSIS_ROOT/docs/README.md" "$PROJECT_ROOT/docs/README.md"
fi

node scripts/verify-generated-analysis.mjs "$PROJECT_ROOT"

if [ "$APPLY_PREFACT" = "1" ]; then
    "$VENV/bin/prefact" -a -e "examples/**"
else
    echo "Skipping source refactoring; set T2C_APPLY_PREFACT=1 to apply prefact changes."
fi
