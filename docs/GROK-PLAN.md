Analiza projektu todo2code — stan ścieżki NL → DSL → sourcecode

1. Czym system jest dziś (i czym nie jest)

todo2code 0.5.0 to system Intent Evidence — nie generator kodu. Realizuje:

NL / Git / AST / TODO / CHANGELOG / docs / config / komunikacja
                    ↓
              t2c.intent/v1  (Intent DSL)
                    ↓
         walidacja + linker → t2c.graph/v1
                    ↓
     diagnostyka + Intent vs Reality
           ↙                    ↘
  conclusion → raport NL    DSL2TODO → TODO.patch (po approve)
                              ↘
                    operation-plan → Subactor envelope (propozycja, bez dispatch)

Brakuje jawnej gałęzi DSL → sourcecode. Kod jest tylko odczytywany (AST → DSL). System nie emituje implementacji z intencji — tylko zadania, wnioski i plany operacyjne do review.

───

2. Co już działa dobrze (fundament analizy)

┌────────────────────────┬───────────┬────────────────────────────────────────────────────┐
│ Etap                   │ Stan      │ Uwagi                                              │
├────────────────────────┼───────────┼────────────────────────────────────────────────────┤
│ NL → DSL               │ działa    │ deterministic + OpenRouter; tryby deterministic    │
│                        │           │ |prefer-llm|require-llm                            │
├────────────────────────┼───────────┼────────────────────────────────────────────────────┤
│ Git / AST → DSL        │ działa    │ TS/JS, Python, Go, Java, Rust                      │
├────────────────────────┼───────────┼────────────────────────────────────────────────────┤
│ TODO/CHANGELOG → DSL   │ działa    │ struktura + LLM w batchach ≤32                     │
├────────────────────────┼───────────┼────────────────────────────────────────────────────┤
│ Docs/config → DSL      │ działa    │ baseline offline + opcjonalny LLM                  │
├────────────────────────┼───────────┼────────────────────────────────────────────────────┤
│ Komunikacja + identity │ działa    │ participant-registry, epistemic class runtime      │
│                        │           │ -owned                                             │
├────────────────────────┼───────────┼────────────────────────────────────────────────────┤
│ Linker + diagnostyka   │ działa    │ m.in. PLANNED_NOT_IMPLEMENTED, konflikty,          │
│                        │           │ ambiguity                                          │
├────────────────────────┼───────────┼────────────────────────────────────────────────────┤
│ Graph → conclusion →   │ działa    │ walidacja cytowań przed renderem                   │
│ NL                     │           │                                                    │
├────────────────────────┼───────────┼────────────────────────────────────────────────────┤
│ Graph → TODO.proposal  │ działa    │ apply tylko po hash approval                       │
│ → patch                │           │                                                    │
├────────────────────────┼───────────┼────────────────────────────────────────────────────┤
│ Gold offline           │ działa    │ 100% P/R na małym v1, stabilność 2/2               │
├────────────────────────┼───────────┼────────────────────────────────────────────────────┤
│ make demollm           │ działa    │ 6/6 etapów llm / degraded=false (zweryfikowany     │
│                        │ live      │ run)                                               │
├────────────────────────┼───────────┼────────────────────────────────────────────────────┤
│ Multi-repo offline     │ działa    │ code2llm, domd, pactfix                            │
└────────────────────────┴───────────┴────────────────────────────────────────────────────┘

Zasada architektoniczna jest spójna: LLM interpretuje, runtime trzyma provenance, ID, lifecycle i cytowania. To dobry model pod NL→DSL.

Lokalne zmiany (jeszcze nie w commitach) poprawiają jakość analizy:
• bare basename (markdown.ts) tylko gdy unikalny w repo,
• dokumentacja = plan tylko przy modality required/recommended (wcześniej setki fałszywych PLANNED_NOT_IMPLEMENTED).

───

3. Otwarte pozycje z TODO.md

Aktualizacja 2026-07-31: pozycja 3 została zamknięta przez ticket-009; tabela
poniżej pozostaje historycznym planem wejściowym.

P1 — jakość semantyki

┌───┬──────────────────────────────────────────────┬──────────────────────────────────────┐
│ # │ Zadanie                                      │ Wpływ na NL→DSL→code                 │
├───┼──────────────────────────────────────────────┼──────────────────────────────────────┤
│ 1 │ Live latency/cost TODO/CHANGELOG: qwen/      │ operacyjna jakość batchy LLM, nie    │
│   │ qwen3.7-plus vs szybszy model                │ semantyka per se                     │
├───┼──────────────────────────────────────────────┼──────────────────────────────────────┤
│ 2 │ Incremental cache AST + docs (content hash)  │ skalowanie dużych repo; bez tego     │
│   │                                              │ pipeline jest wolny/drogi            │
├───┼──────────────────────────────────────────────┼──────────────────────────────────────┤
│ 3 │ Jeden source schematów → TS validators +     │ drift kontraktów = cicha utrata      │
│   │ OpenRouter response schemas                  │ jakości ekstrakcji                   │
└───┴──────────────────────────────────────────────┴──────────────────────────────────────┘

P2 — modularność / ops

┌───┬───────────────────────────────────────┬─────────────────────────────────────────────┐
│ # │ Zadanie                               │ Wpływ                                       │
├───┼───────────────────────────────────────┼─────────────────────────────────────────────┤
│ 4 │ AST dla PHP i innych języków w        │ luki w „reality” (kod niewidoczny w DSL)    │
│   │ analizowanych repo                    │                                             │
├───┼───────────────────────────────────────┼─────────────────────────────────────────────┤
│ 5 │ A2A streaming/push + transakcyjny     │ multi-agent orchestration, nie jakość       │
│   │ task-store                            │ pojedynczej analizy                         │
└───┴───────────────────────────────────────┴─────────────────────────────────────────────┘

───

4. Problemy i ograniczenia, które wciąż psują „poprawną analizę”

A. Semantyka i gold (najważniejsze pod NL→DSL)

1. Gold v1 jest za mały — kilka case’ów ekstrakcji, 4 relacje (3 exact + 1 capability), hard negative, 2 propozycje TODO. 100% P/R na tym zbiorze nie gwarantuje jakości na realnym prose/ticketach.
2. Capability-topic linking (3 wspólne tematy) podniósł AST↔NL/TODO, ale dokumentacja statusu mówi wprost: potrzeba szerszego gold z trudnymi negatywami.
3. Złożone zdania NL nadal → AMBIGUOUS_REQUIREMENT / niepełne pola — bez dobrego targetu (path/symbol/ticket) linker nie ma na czym budować mostu do kodu.
4. Live LLM ≠ offline gold — gold docs to snapshot naprawy odpowiedzi, nie pomiar żywego modelu. Jakość NL/docs live zależy od modelu i rate-limitów (429).

B. Pokrycie „reality” (code → DSL)

5. PHP/Ruby/C#/Kotlin/C/C++ — tylko liczone jako unsupported, bez faktów AST → fałszywe PLANNED_NOT_IMPLEMENTED lub brak evidence.
6. Agregaty modułów redukują szum AST, ale gubią detale potrzebne do precyzyjnego mapowania „zrób X w funkcji Y”.
7. Brak cache na dużych repo (np. 10k–18k rekordów AST) — analiza jest kompletna, ale nieprzyrostowa.

C. Epistemika i fałszywe sygnały

8. Git/CHANGELOG = claim, nie fact — dobrze, ale agent nadal może „zamknąć” pracę bez hard gate w CI (branch protection / work permit = warstwa poza paczką).
9. Approval TODO.patch jest świadomie ludzkie — system nie domyka pętli autonomicznego DONE.
10. Sekcja „Następne działania” w team-summary.md to projekcja conclusions, nie zamiennik walidowanego DSL2TODO.

D. Kontrakty i drift

11. Schematy JSON i ręczne asserty w schema.ts mogą się rozjechać (otwarty punkt P1).
12. Operation-plan / Subactor: propozycja + envelope, bez I/O i bez wykonania — to nie jest generacja kodu.

E. Luka architektoniczna: brak DSL → sourcecode

To jest największa luka względem Twojego celu:

┌─────────────────────────────────────┬─────────────┬─────────────────────────────────────┐
│ Warstwa                             │ Istnieje?   │ Co produkuje                        │
├─────────────────────────────────────┼─────────────┼─────────────────────────────────────┤
│ NL → Intent DSL                     │ tak         │ t2c.intent/v1                       │
├─────────────────────────────────────┼─────────────┼─────────────────────────────────────┤
│ multi-source → graph + diagnostics  │ tak         │ rozbieżności Intent vs Reality      │
├─────────────────────────────────────┼─────────────┼─────────────────────────────────────┤
│ graph → zadania                     │ tak         │ todo-proposal + TODO.patch          │
├─────────────────────────────────────┼─────────────┼─────────────────────────────────────┤
│ intent → plan operacyjny            │ tak (       │ operation-plan / envelope Subactor  │
│                                     │ kontrakt)   │                                     │
├─────────────────────────────────────┼─────────────┼─────────────────────────────────────┤
│ DSL / task → diff / pliki źródłowe  │ nie         │ —                                   │
├─────────────────────────────────────┼─────────────┼─────────────────────────────────────┤
│ weryfikacja wygenerowanego kodu z   │ częściowo   │ re-run pipeline po zmianach, ale    │
│ powrotem w DSL                      │             │ bez pętli codegen                   │
└─────────────────────────────────────┴─────────────┴─────────────────────────────────────┘

Bez tej gałęzi system analizuje i planuje, ale nie realizuje ścieżki NL→DSL→sourcecode.

───

5. Co jeszcze trzeba zrobić, żeby system poprawnie wspierał NL → DSL → sourcecode

Poniżej w kolejności zależności (najpierw jakość analizy, potem generacja).

Faza 1 — wiarygodna analiza (blokery jakości)

1. Rozszerzyć gold v1→v2
   • trudne NL (PL/EN, wielozdaniowe, bez path, z aliasami),
   • hard negatives capability-topic,
   • docs prescriptive vs descriptive,
   • bare basename ambigous/unambiguous,
   • DSL2TODO: partial implement, false DONE.
   Osobno: precision/recall live na redacted snapshotach (nie w CI offline).

2. Wzmocnić NL→target
   • resolution symboli względem AST (nie tylko string match),
   • ticket binding,
   • jawne missingFields → diagnostyka z actionable fix,
   • mniej AMBIGUOUS_REQUIREMENT przy dobrych ticketach.

3. Linker precision floor
   • metryki osobno: exact path/symbol vs capability-topic,
   • threshold + audit „dlaczego linked”,
   • regresja na gold.

4. Schemas z jednego źródła
   • JSON Schema → TS validators + OpenRouter response format (punkt z TODO).

Faza 2 — kompletne „reality”

5. Adaptery AST dla języków obecnych w repo docelowych (PHP minimum, reszta wg portfolio).
6. Cache AST/docs po content hash.
7. (Opcjonalnie) testy/CI facts jako evidence „implemented” — dziś evidence = głównie AST+Git.

Faza 3 — zamknięcie pętli do sourcecode (brakujący produkt)

8. Nowy kontrakt t2c.code-change-plan/v1 (lub rozszerzenie operation-plan):
   • cytowania recordIds/diagnosticIds,
   • dokładne paths + symbols + acceptance criteria z TODO proposal,
   • risk/rollback,
   • bez auto-apply.

9. Codegen agent (LLM) za bramką
   • input: graph slice + proposal + istniejący AST context pliku,
   • output: structured patch/diff (nie free-form „zaufaj mi”),
   • runtime waliduje: tylko dozwolone paths, cytowania, brak tajemnic.

10. Re-extract → re-link → re-diagnose po patchu
    • acceptance: zniknięcie PLANNED_NOT_IMPLEMENTED dla danego planu,
    • brak nowych CONFLICTING_INTENT,
    • opcjonalnie test runner jako zewnętrzny evidence.

11. Human/CI gate
    • jak przy TODO.patch: hash approval,
    • nie DONE bez evidence (to już jest w filozofii Intent Guard).

12. Integracja z Subactor/Planfile tylko do orchestracji ticketów — nie jako zamiennik walidacji DSL.

Faza 4 — ops (nie blokuje semantyki, blokuje skalę multi-agent)

13. Live cost/latency batch TODO.
14. A2A streaming + shared task store.
15. Branch protection / work permits (świadomie poza core — ale potrzebne w pełnym Intent Guard).

───

6. Mapa „gotowe vs luka” pod Twój cel

NL ──LLM──► Intent DSL ──link──► Graph ──diag──► Conclusions / TODO
  ▲              ▲                                    │
  │              │                                    ▼
  │         AST facts                          [BRAK] Codegen plan
  │         Git claims                                │
  │                                                   ▼
  └──────── re-extract ◄──── apply patch ◄──── [BRAK] Source patch

┌──────────────────────────────────────────────┬──────────────────────────────────────────┐
│ Cel                                          │ Status                                   │
├──────────────────────────────────────────────┼──────────────────────────────────────────┤
│ Poprawna ekstrakcja NL→DSL z provenance      │ gotowe (z zastrzeżeniem gold/live)       │
├──────────────────────────────────────────────┼──────────────────────────────────────────┤
│ Multi-source evidence + rozbieżności         │ gotowe (heurystyki linkera do            │
│                                              │ twardnienia)                             │
├──────────────────────────────────────────────┼──────────────────────────────────────────┤
│ Zadania ugruntowane w diagnostyce            │ gotowe (DSL2TODO)                        │
├──────────────────────────────────────────────┼──────────────────────────────────────────┤
│ Generacja sourcecode z DSL + weryfikacja     │ niezaimplementowane                      │
│ pętlą                                        │                                          │
├──────────────────────────────────────────────┼──────────────────────────────────────────┤
│ Fail-closed bez udawania sukcesu LLM         │ gotowe (require-llm, demollm)            │
└──────────────────────────────────────────────┴──────────────────────────────────────────┘

───

7. Priorytety praktyczne (co robić najpierw)

Jeśli celem jest poprawna analiza pod przyszłe NL→DSL→code:

1. Gold v2 + metryki linkera (exact vs topic) — bez tego codegen będzie „strzelał” w złe pliki.
2. Commit lokalnych poprawek linker/diagnostics (basename + modality docs) + testy regresji.
3. Schema single-source — stabilność kontraktów LLM.
4. Cache — żeby analiza na dużych monorepo była używalna w pętli re-extract.
5. Dopiero potem zaprojektować code-change-plan + structured patch + re-diagnose gate.

Jeśli celem jest już dziś używać LLM do kodu:
najbezpieczniejszy most istniejący to:
pipeline → DSL2TODO → człowiek/agent implementuje → re-run pipeline
— system jest już dobrym guardem intencji, ale nie generatorem.

───

8. Podsumowanie

• Rdzeń analizy (źródła → DSL → graf → diagnostyka → wnioski/zadania) jest dojrzały, testowany offline i live, z jasną granicą LLM/deterministyczny.
• Otwarte TODO to głównie: koszt LLM, cache, schema codegen, PHP AST, A2A store.
• Krytyczne ograniczenia jakości: mały gold, heurystyki linkera, niepełne AST, brak pętli codegen.
• Aby system poprawnie domykał NL → DSL → sourcecode, trzeba dodać warstwę planu zmian kodu + structured patch + re-analysis acceptance, a nie tylko dopieszczać ekstrakcję.

Mogę w kolejnym kroku: (a) spisać konkretny design t2c.code-change-plan/v1, (b) rozwinąć checklistę gold v2, albo (c) przejrzeć lokalny diff linkera i zapr
