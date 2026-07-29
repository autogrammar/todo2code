SHELL := /bin/bash
.DEFAULT_GOAL := help

NPM ?= npm
NODE ?= node
PYTHON ?= python3
ROOT ?= .
TASK ?= TASK.md
TODO ?= TODO.md
CHANGELOG ?= CHANGELOG.md
DOCS ?= README.md,docs/**/*.md,project/**/*.md
OUT ?= .intent
PACKAGE ?= todo2code.zip
PYTHON_WHEEL_DIR ?= .intent-packages/python

.PHONY: help setup install install-tf build check test verify verify-no-llm verify-modules smoke doctor mcp-probe a2a-probe protocol-smoke validate demo pipeline compare-workspace mcp a2a docker-build docker-up docker-down python-wheel package clean

help: ## Pokaż dostępne cele
	@awk 'BEGIN {FS = ":.*## "; printf "todo2code targets:\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Utwórz .env i zainstaluj zależności bez opcjonalnego TensorFlow
	@test -f .env || cp .env.example .env
	$(NPM) install --omit=optional

install: ## Zainstaluj zależności bez opcjonalnego TensorFlow
	$(NPM) install --omit=optional

install-tf: ## Zainstaluj także opcjonalny @tensorflow/tfjs-node
	$(NPM) install

build: ## Skompiluj TypeScript
	$(NPM) run build

check: ## Sprawdź typy bez emisji
	$(NPM) run check

test: build ## Uruchom testy Node
	$(NPM) test

verify-no-llm: ## Sprawdź granicę importów LLM
	$(NPM) run verify:no-llm

verify-modules: ## Sprawdź cykle importów i niezależność warstwy core
	$(NPM) run verify:modules

verify: ## Typy, granica LLM, build i testy
	$(NPM) run verify

smoke: build ## Uruchom pełny offline smoke test na tymczasowym repo Git
	bash scripts/smoke.sh

doctor: build ## Sprawdź runtime i zredagowaną konfigurację
	$(NODE) dist/src/cli.js doctor

mcp-probe: build ## Sprawdź nowoczesny i legacy profil MCP
	bash scripts/mcp-request.sh

a2a-probe: build ## Sprawdź A2A v1 przez lokalny serwer HTTP
	bash scripts/a2a-request.sh

protocol-smoke: mcp-probe a2a-probe ## Uruchom probes MCP i A2A

validate: verify smoke protocol-smoke doctor ## Pełna walidacja bez live OpenRouter i bez budowania Dockera

demo: build ## Przeanalizuj katalog examples bez OpenRouter
	$(NODE) dist/src/cli.js pipeline examples --task task.md --todo TODO.md --changelog CHANGELOG.md --docs 'docs/**/*.md' --no-docs-llm --out .intent-demo

pipeline: build ## Uruchom pipeline; parametry ROOT/TASK/TODO/CHANGELOG/DOCS/OUT
	$(NODE) dist/src/cli.js pipeline "$(ROOT)" --task "$(TASK)" --todo "$(TODO)" --changelog "$(CHANGELOG)" --docs "$(DOCS)" --out "$(OUT)"

compare-workspace: build ## Porównaj intencje origin/main z bieżącym filesystemem
	$(NODE) dist/src/cli.js compare-workspace "$(ROOT)" --base "$${BASE_REF:-origin/main}" --out "$(OUT)"

mcp: build ## Uruchom serwer MCP stdio
	$(NODE) dist/src/interfaces/mcp.js

a2a: build ## Uruchom serwer A2A
	$(NODE) dist/src/interfaces/a2a.js

docker-build: ## Zbuduj obraz Docker
	docker build -t todo2code:local .

docker-up: ## Uruchom A2A w Docker Compose (make setup najpierw)
	docker compose -f docker-compose.yml up --build -d

docker-down: ## Zatrzymaj Docker Compose
	docker compose -f docker-compose.yml down

python-wheel: build ## Zbuduj wheel SDK z lokalnym mostem do runtime TypeScript
	mkdir -p "$(PYTHON_WHEEL_DIR)"
	$(PYTHON) -m pip wheel ./sdk/python --no-deps --no-build-isolation --wheel-dir "$(PYTHON_WHEEL_DIR)"

package: validate ## Utwórz ZIP i plik SHA-256 bez sekretów i node_modules
	$(PYTHON) scripts/package.py "$(PACKAGE)"

clean: ## Usuń artefakty build/test/demo
	rm -rf dist coverage .intent-demo .intent-test *.zip
