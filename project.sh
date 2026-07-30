#!/usr/bin/env bash
set -euo pipefail

# Keep routine package checks quiet; this script already controls upgrades.
export PIP_DISABLE_PIP_VERSION_CHECK=1

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SEMCOD_ROOT="${SEMCOD_ROOT:-$(dirname "$PROJECT_ROOT")}"

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

for package in regix prefact vallm redup glon goal code2logic code2llm code2docs; do
    install_project_package "$package"
done

# Namespace contract: root-level files under project/ are technical analysis;
# communication lives only under recognised project/<ticket>/ directories.
# Keep this output path for compatibility with project/analysis.toon.yaml.
#$VENV/bin/code2llm ./ -f toon,evolution,code2logic,project-yaml -o ./project --no-chunk
$VENV/bin/code2llm ./ -f all -o ./project --no-chunk
#$VENV/bin/code2llm report --format all       # → all views
rm -f project/analysis.json
rm -f project/analysis.yaml

$VENV/bin/code2docs ./ --readme-only
node scripts/sync-generated-readme-metadata.mjs "$PROJECT_ROOT" "$PROJECT_ROOT/docs/README.md"
$VENV/bin/redup scan . --format toon --output ./project
#$VENV/bin/redup scan . --functions-only -f toon --output ./project
#$VENV/bin/vallm batch ./src --recursive --semantic --model qwen2.5-coder:7b
#$VENV/bin/vallm batch --parallel .
$VENV/bin/vallm batch . --recursive --format toon --output ./project
$VENV/bin/prefact -a -e "examples/**"
