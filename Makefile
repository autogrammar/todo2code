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

.PHONY: help setup install install-tf build check test verify verify-no-llm verify-modules verify-env smoke doctor mcp-probe a2a-probe protocol-smoke validate live-contract-check demo demollm examples-check pipeline compare-workspace mcp a2a docker-build docker-smoke docker-up docker-down python-wheel package clean

help: ## Pokaż dostępne cele
	@awk 'BEGIN {FS = ":.*## "; printf "todo2code targets:\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Utwórz .env i zainstaluj zależności bez opcjonalnego TensorFlow
	@test -f .env || cp .env.example .env
	$(NPM) install --omit=optional

install: ## Zainstaluj zależności bez opcjonalnego TensorFlow
	$(NPM) install --omit=optional

install-tf: ## Zainstaluj izolowany opcjonalny adapter @tensorflow/tfjs-node
	$(NPM) --prefix adapters/tensorflow install

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

verify-env: ## Sprawdź kompletność i brak duplikatów kontraktu .env
	$(NPM) run verify:env

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

validate: verify smoke protocol-smoke doctor docker-smoke ## Pełna walidacja bez live OpenRouter, łącznie ze smoke obrazu Docker

live-contract-check: ## Uruchom opt-in audyt prawdziwego kontraktu OpenRouter i budżetów
	$(NPM) run live:check

demo: build ## Przeanalizuj katalog examples bez OpenRouter
	OPENROUTER_API_KEY= T2C_NL_MODE=deterministic T2C_MARKDOWN_MODE=deterministic T2C_COMMUNICATION_MODE=deterministic $(NODE) dist/src/cli.js pipeline examples --task task.md --todo TODO.md --changelog CHANGELOG.md --docs 'docs/**/*.md' --no-docs-llm --no-summary-llm --out .intent-demo
	T2C_COMMUNICATION_MODE=deterministic $(NODE) dist/src/cli.js communication examples --project-dir project --ticket DEMO-101 --out examples/.intent-communication/analysis.json --md examples/.intent-communication/analysis.md --graph examples/.intent-communication/graph.json

demollm: demo ## Zbuduj stabilny graf demo i wymuś live kontrakty OpenRouter bez fallbacku
	T2C_REQUIRE_LIVE_CHECK=1 $(NPM) run live:check

examples-check: build ## Sprawdź demo, backend/frontend i przykłady wszystkich dostępnych SDK
	bash scripts/examples-check.sh

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

docker-smoke: ## Zbuduj obraz i sprawdź healthz oraz doctor wewnątrz kontenera
	bash scripts/docker-smoke.sh

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
