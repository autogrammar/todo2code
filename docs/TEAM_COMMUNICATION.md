# Komunikacja ludzi i agentów przez `project/<ticket>/`

Ten format jest szybkim, append-only kanałem komunikacji, który można
commitować razem z kodem. Każdy plik jest przypisany do jednego ticketu,
uczestnika oraz rodzaju wypowiedzi. `todo2code` konwertuje go do
`t2c.intent/v1` ze źródłem `agent_log`, łączy z Git i AST, a następnie tworzy
osobną analizę dla każdego człowieka i agenta.

## Minimalna struktura

```text
project/
└── WM-101/
    ├── human.tom.request.001.md
    ├── human.mateusz.decision.001.md
    ├── agent.codex.plan.001.md
    ├── agent.codex.report.002.md
    └── agent.validator.result.001.md
```

Pliki powinny być dopisywane, a nie nadpisywane. Numer na końcu nazwy ułatwia
odtworzenie kolejności, lecz to `timestamp` jest źródłem czasu w DSL.

Standard governance z `wellmanifest/new-project` jest obsługiwany równolegle:

```text
project/
└── ticket-005/
    ├── user-tom-sapletta-com.md
    ├── ai-codex.md
    ├── ai-codex-logs.txt
    ├── README.md
    ├── preprompt.md
    └── changelog.md
```

`user-*` jest uczestnikiem `human`, a `ai-*` uczestnikiem `agent`. Sufiks
nazwy pliku jest kanonizowany do małych liter, dzięki czemu `ai-Codex.md` i
`ai-codex.md` nie tworzą dwóch tożsamości. Pliki `README.md`, `preprompt.md`,
`changelog.md`, `audit.md`, `baseline.md`, `iteration-*.md` oraz
`ai-*-logs.txt` pozostają dowodami ticketu i nie są wypowiedziami uczestnika.

W plikach governance typ wypowiedzi wynika z sekcji:

| Właściciel pliku | Sekcja | Typ DSL |
|---|---|---|
| człowiek | Instructions, Assigned Instructions, Requirements, Goal, Scope | `request` |
| człowiek | Decisions, Approval | `decision` |
| agent | Understanding, Execution Plan, Scope, Guardrails, Risks | `plan` |
| agent | Actual Changes, Results, Report, Blockers | `report` |
| agent | Approval | `claim` |

Sekcje statusu, metadanych i granic własności nie stają się intencjami.
Zawinięte akapity są scalane przed konwersją, a same znaczniki Markdown i
separatory nie tworzą rekordów.

## Kontrakt pliku

```markdown
---
participant: Codex
participant-id: agent:codex
role: agent
type: report
timestamp: 2026-07-29T18:00:00+02:00
recipient: Tom
git-authors: Agent Codex, github-actions[bot]
paths: src/runtime.ts, test/runtime.test.ts
symbols: validateContract
---
Dodano walidację kontraktu dla WM-101 i uruchomiono test integracyjny.
```

Wymagane pola:

- `participant-id` — stabilne, kanoniczne ID `human:<id>` albo `agent:<id>`,
  wymagane, gdy istnieje `project/participants.json`;
- `participant` — nazwa wyświetlana; nie służy do zgadywania tożsamości;
- `role` — wyłącznie `human` albo `agent`;
- `type` — `request`, `plan`, `decision`, `message`, `report`, `result` lub
  `claim`.

Ticket jest pobierany z katalogu. `git-authors` wiąże nazwę uczestnika z
autorami commitów. `paths` i `symbols` zwiększają jakość powiązania z AST/Git.
Brak roli lub uczestnika nie jest uzupełniany przez domysł: runtime zapisuje
ostrzeżenie i problem `PARTICIPANT_IDENTITY_UNRESOLVED`.

Automatyczne skanowanie uznaje katalog za kanał komunikacji, gdy jego nazwa ma
postać ticketu, np. `WM-101`, nazwa pliku identyfikuje `human.*`/`agent.*`,
istnieje `project/participants.json` albo plik ma jawny front matter powyższego
kontraktu. Dzięki temu wygenerowane analizy typu `project/batch_1/context.md`
nie stają się przypadkowymi wypowiedziami agentów. Niestandardową nazwę
ticketu można zawsze wskazać przez `--ticket` lub jawne pole `ticket:`.

Rejestr `project/participants.json` ma kontrakt
`t2c.participant-registry/v1`:

```json
{
  "schemaVersion": "t2c.participant-registry/v1",
  "participants": [{
    "id": "agent:codex",
    "role": "agent",
    "displayName": "Codex",
    "gitAuthors": ["Agent Codex"],
    "a2aAgentIds": ["agent://codex/primary"],
    "humanAliases": []
  }]
}
```

ID oraz wszystkie zewnętrzne identyfikatory muszą być unikalne. Runtime
wyszukuje wyłącznie dokładne `participant-id`; nie przeszukuje `displayName`
ani aliasów i nie stosuje podobieństwa tekstowego. `humanAliases` służą jako
jawna mapa integracyjna, a nie jako heurystyka. Przy aktywnym rejestrze role i
autorzy Git z front matter sprzeczni z wpisem są ignorowani i raportowani.
Schemat znajduje się w `schemas/participant-registry.schema.json`.

### Migracja starszych promptów i raportów

Samo przemianowanie dowolnego `Prompt.txt` na `user-owner.md` nie wystarcza.
Plik governance bez rozpoznanej sekcji jest odrzucany z ostrzeżeniem
wskazującym właściciela treści; system nie zgaduje typu i nie ukrywa utraty
intencji.

Jeżeli cały starszy plik ma jeden typ, można użyć płaskiego front matter:

```markdown
---
type: request
---
Treść starszego promptu.
```

Analogicznie odpowiedź analityczna, która nie deklaruje wykonania, powinna mieć
`type: message`, a nie `report`. Plik mieszający polecenia, decyzje, plany i
raporty trzeba podzielić na sekcje. Przypisanie jednego typu całemu mieszanemu
dokumentowi zmienia klasę epistemiczną i może wytworzyć fałszywe claimy.

## Uruchomienie

Najkrótsza analiza z raportem Markdown, JSON i grafem dowodowym:

```bash
node /home/tom/github/semcod/todo2code/dist/src/cli.js communication . \
  --project-dir project \
  --out .intent/communication-analysis.json \
  --md .intent/communication-analysis.md \
  --graph .intent/communication.graph.json
```

Jeden ticket:

```bash
node /home/tom/github/semcod/todo2code/dist/src/cli.js communication . \
  --project-dir project --ticket WM-101 \
  --md .intent/WM-101.communication.md
```

Sam konwerter do kanonicznego DSL:

```bash
node /home/tom/github/semcod/todo2code/dist/src/cli.js extract communication \
  --root . --project-dir project \
  --out .intent/communication.intent.jsonl
```

Domyślny `T2C_COMMUNICATION_MODE=deterministic` nie wysyła komunikacji poza
runtime. Tryb `prefer-llm` wzbogaca wyłącznie semantykę i tworzy osobną,
uziemioną syntezę dla każdego uczestnika; awaria jest jawnym fallbackiem.
`require-llm` kończy etap błędem. Przykład:

```bash
node dist/src/cli.js communication . \
  --project-dir project --ticket WM-101 \
  --communication-mode prefer-llm
```

Odpowiedź modelu nie zawiera pól participant/role/ticket/source/lifecycle ani
epistemic class. Runtime zachowuje je z deterministycznego parsera, ogranicza
confidence do 0,85, mapuje cytowania na finalne ID rekordów i odrzuca syntezę,
która cytuje cudzy lub nieistniejący rekord. `claim` agenta nie może stać się
faktem przez wzbogacenie LLM.

Akcje `extract_communication` i `analyze_communication` są również dostępne
przez MCP i A2A. Wszystkie SDK akceptują je przez ogólną metodę `call`/`send`.

Wersjonowany fixture można uruchomić razem z całym demo przez `make demo` albo
samodzielnie:

```bash
node dist/src/cli.js communication examples \
  --project-dir project --ticket DEMO-101 \
  --out examples/.intent-communication/analysis.json \
  --md examples/.intent-communication/analysis.md \
  --graph examples/.intent-communication/graph.json
```

Domyślna analiza znajduje implementację `validateEventPayload` w AST, więc
claim Codexa ma dowód. Dodanie `--no-ast` demonstruje osobny problem
`AGENT_CLAIM_WITHOUT_EVIDENCE`.

## Wykrywane rozbieżności

- sprzeczne wypowiedzi dwóch ludzi;
- sprzeczne wypowiedzi dwóch agentów;
- konflikt polecenia człowieka z planem lub raportem agenta;
- polecenie człowieka bez semantycznie powiązanej odpowiedzi agenta;
- claim wykonania bez powiązanego commita lub faktu AST;
- plan albo praca agenta poza zakresem polecenia człowieka;
- claim agenta o akceptacji człowieka, której człowiek nie zapisał we własnym
  kanale;
- brak jednoznacznej tożsamości lub roli uczestnika.

Analiza nie uznaje wypowiedzi agenta za fakt wykonania. `report`, `result` i
`claim` pozostają klasą epistemiczną `claim`; dowodami są osobne rekordy Git,
AST i testów.

Każdy problem zawiera `responseRequiredRole` i `responseRequiredFrom`.
Przypisanie odpowiedzi jest częścią wyniku, a nie sugestią renderera:

| Rozbieżność | Kto powinien się wypowiedzieć |
|---|---|
| polecenie bez odpowiedzi | agent przypisany do ticketu |
| konflikt dwóch ludzi | obaj ludzie |
| konflikt człowiek–agent | człowiek będący właścicielem zakresu |
| konflikt dwóch agentów | człowiek będący właścicielem zakresu |
| praca agenta poza zakresem | człowiek — zatwierdza albo odrzuca rozszerzenie |
| claim wykonania bez dowodu | agent — dostarcza ścieżkę, symbol lub commit |
| claim agenta o decyzji człowieka | człowiek — zapisuje decyzję we własnym pliku |

Agent nie może zamknąć ostatniego przypadku, edytując `user-*` za człowieka.

Jeżeli wymagana rola nie ma żadnego zaufanego uczestnika w ticketcie,
`responseRequiredFrom` zawiera `unresolved:human` albo `unresolved:agent`.
Lista nie jest już pusta, a sentinel pozostaje jawną informacją o braku
tożsamości — nie jest domyślnym właścicielem ani adresem do wysyłki. Prawdziwy
uczestnik z komunikacji zachowuje pierwszeństwo i własne stabilne ID.

## Wdrożenie w `wellmanifest/new-project`

Aktualny stan tego repozytorium nie zawiera jeszcze `project/<ticket>/`.
Istniejące `Prompt.txt` są poleceniami człowieka, natomiast pliki w katalogach
`GPT56Luna/`, `Opus48Medium/`, `SWE17/` i `perplexity/` są wynikami różnych
agentów. Nie należy zmieniać ich roli na podstawie samego położenia — podczas
migracji należy utworzyć nowe, jednoznacznie opisane pliki ticketu.

## Kontrakt przestrzeni nazw `project/`

Repozytorium zachowuje `project/analysis.toon.yaml` i pozostałe pliki leżące
bezpośrednio w `project/` jako kompatybilną przestrzeń artefaktów analizy
technicznej generowanych przez `project.sh`. Komunikacja ma osobną przestrzeń
semantyczną: rekordy `agent_log` powstają z rozpoznanego
`project/<TICKET>/`, rejestru uczestników albo jawnego front matter. Pliki
analizy na poziomie głównym oraz ogólne katalogi takie jak `batch_1/` nie są
rozmową i ekstraktor je pomija. Dzięki temu fizyczny katalog pozostaje
kompatybilny ze skryptami, ale oba rodzaje danych nie mieszają się w DSL.
