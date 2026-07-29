# Analiza wydajności runtime'u

Pomiary wykonane na realnym runie `.intent/runs/20260729T120109Z-e74bf713`
(**2561 rekordów**, **95 549 relacji**), Node.js 20, jeden wątek. Każdą liczbę
da się odtworzyć skryptami opisanymi w sekcji [Metodyka](#metodyka).

## Podsumowanie

| Etap | Wyjściowo | Po kroku 1–2 | Po kroku 3 | Łącznie |
|---|--:|--:|--:|--:|
| `linkIntentRecords` | 3480 ms | 1717 ms | **641 ms** | **5,4×** |
| `diagnoseGraph` | ~O(n²) lookup | 85 ms | 77 ms | — |
| `buildRealityView` | — | 7 ms | 6 ms | — |
| relacje w grafie | 95 549 | 95 549 | **26 099** | −73% |
| `intent.graph.json` | 21,4 MiB | 21,4 MiB | **7,7 MiB** | −64% |

Widok historii korzysta ponadto z kompaktowej odpowiedzi graph diff. Dla dwóch
runów repozytorium odpowiedź REST spadła z **38,71 MiB do 13,71 KiB** (około
2890×), bez zmiany fingerprintu, liczników ani SVG. Czas obliczeń pozostaje
zależny od rozmiaru grafów; optymalizacja usuwa koszt transferu, parsowania JSON
i przechowywania pełnego diffu po stronie przeglądarki.

Kroki 1–2 są czysto wydajnościowe: fingerprint grafu przed i po jest identyczny
co do bajtu (`16549106e3f926a1…`).

Krok 3 zmienia zbiór relacji, ale **nie zmienia żadnego wniosku**. Zmierzone na
tym samym runie:

| Typ relacji | Przed | Po |
|---|--:|--:|
| `related_to` (szum) | 72 529 | **3 079** (−96%) |
| `evidenced_by` | 1 748 | 1 748 |
| `same_as` | 11 118 | 11 118 |
| `duplicates` | 10 151 | 10 151 |
| `implements` | 2 | 2 |
| `releases` | 1 | 1 |

Utraconych relacji niosących wniosek: **0** (1751 przed i po). Raport
diagnostyczny jest identyczny — te same liczności `info/warning/review_required/
blocking` (141/163/24/4) i ten sam rozkład kodów. Usunięty został wyłącznie szum.

## 1. Tokenizacja w pętli scoringu — zastosowane

`scorePair` liczyło `similarity()` dla pary `object` i pary `text`, a
`determineRelation` liczyło **te same dwie wartości drugi raz**. Każde
`similarity()` wywołuje `keywords()` na obu argumentach, więc jedna para
kosztowała 8 tokenizacji. Przy 157 204 parach daje to ~1,26 mln tokenizacji.

Pomiar izolowany:

```text
200k wywołań similarity()        588 ms
200k jaccard na gotowych Setach    8 ms   → 73×
```

Zmiana w `src/graph/linker.ts`:

- `indexKeywords()` liczy zbiory słów raz na rekord (2561 razy zamiast 1,26 mln);
- `jaccard()` iteruje mniejszy zbiór;
- `PairEvidence.textScore` przenosi wynik do `determineRelation` zamiast liczyć go ponownie.

Efekt: **3480 ms → 1717 ms**.

## 2. Wyszukiwanie liniowe w diagnostyce — zastosowane

`diagnoseGraph` robiło `graph.records.find(...)` dla każdego sąsiada każdego
rekordu (O(n²)), a `buildNeighbors` przy każdej relacji kopiowało tablicę
sąsiadów przez spread (O(n²) alokacji). Oba zastąpione `Map` i `push`.

## 3. Objętość relacji — zastosowane

To była **główna dźwignia**, a nie mikrooptymalizacja. Rozkład par kandydujących
przed zmianą:

| Bucket | Pary | Udział |
|---|--:|--:|
| `path:` | 142 158 | **80,1 %** |
| `token:` | 18 748 | 10,6 % |
| `symbol:` | 16 482 | 9,3 % |
| `ticket:` | 1 | ~0 % |

Przyczyna: `path:` grupuje **wszystkie symbole AST z tego samego pliku**, więc
jeden duży plik generuje kwadratową liczbę par:

```text
path:src/interfaces/a2a.ts   313 rekordów →  44 850 par
path:src/cli.ts              199 rekordów →  19 701 par
path:src/interfaces/mcp.ts   147 rekordów →  10 731 par
```

Współdzielenie pliku to słaby dowód powiązania dla faktów AST — dwie niezwiązane
funkcje w tym samym module dostają relację `related_to`. Potwierdza to rozkład
typów: 72 529 z 95 549 relacji (76 %) to `related_to`.

Koszt tej objętości rozlewa się na cały pipeline:

```text
createRelationId × 95 549     382 ms   (stableStringify + sha256 na relację)
graphFingerprint              350 ms
```

oraz na `diagnoseGraph`, rozmiar `intent.graph.json` i na widok reality — to
właśnie ta gęstość sprawiła, że grupowanie po spójnych składowych zlewało cały
repozytorium w jeden topic (patrz `src/diff/reality.ts`).

### Zastosowane rozwiązanie

`collectCandidatePairs` **nie paruje już dwóch faktów AST na podstawie samego
bucketa `path:`**. Taka para trafia do grafu dopiero wtedy, gdy łączy ją także
bucket `symbol:` albo `token:` — czyli gdy istnieje dowód mocniejszy niż
„leżą w tym samym pliku”.

Kryterium jest strukturalne, nie progowe: nie dobieramy magicznej stałej, tylko
odmawiamy traktowania współdzielonej ścieżki jako samodzielnego dowodu między
faktami AST. Dla par, w których choć jedna strona jest nie-AST (TODO, NL,
dokumentacja, commit ↔ kod), `path:` pozostaje pełnoprawnym sygnałem — i to
właśnie te pary niosą relacje `implements`, `evidenced_by`, `plans`.

Wynik potwierdza dobór kryterium: zniknęło 96% `related_to`, a wszystkie
pozostałe typy relacji zachowały się co do sztuki (patrz [Podsumowanie](#podsumowanie)).

### Warianty odrzucone

- **Obniżenie limitu bucketa** z 300 do np. 60 — arbitralne i niestabilne:
  obcięcie zależy od kolejności identyfikatorów, więc dodanie funkcji do pliku
  mogłoby usunąć niepowiązaną relację.
- **Podniesienie progu `score` z 0,42** dla par `shared_path` — nadal wymaga
  zbudowania i wypunktowania 142 tys. par, czyli nie usuwa kosztu, tylko
  odrzuca wynik na końcu.

## 4. Pary jako krotki zamiast kluczy — zastosowane

`collectCandidatePairs` zwraca teraz `Array<[string, string]>`. Klucz `"a|b"`
służy wyłącznie do deduplikacji w `Map`, więc pętla scoringu nie rozbija już
stringa na każdej parze (44 ms) i nie alokuje 157 tys. tymczasowych stringów.
Determinizm zachowany: wynik jest sortowany po tym samym kluczu.

Przy okazji `token:` korzysta z gotowego indeksu słów zamiast wołać `keywords()`
drugi raz na rekord.

### Budżet po zmianach

Koszty zależne od liczby relacji spadły same, zgodnie z przewidywaniem:

```text
                     przed 95 549 rel.   po 26 099 rel.
createRelationId            382 ms            118 ms
graphFingerprint            350 ms            130 ms
```

`createRelationId` liczy hash z pola `basis`; skrócenie seeda do `from|to|type`
obniżyłoby koszt jeszcze o kilkadziesiąt ms, ale zmienia identyfikatory relacji
i nie jest już potrzebne przy obecnej objętości grafu.

## 5. Ekstrakcja dokumentacji i podsumowanie LLM — zastosowane

Fragmenty dokumentów są przetwarzane przez ograniczoną pulę workerów
(`T2C_DOC_CONCURRENCY`, domyślnie 3), a wyniki są składane w pierwotnej,
deterministycznej kolejności. Test mierzy rzeczywistą liczbę równoległych
żądań. Timeout lub błąd transportu nie uruchamia już drugiego, bezcelowego
fallbacku bez JSON Schema; fallback pozostaje tylko dla błędów formatu i
obsługi structured output.

Koszt całego etapu jest dodatkowo ograniczony przez `T2C_DOC_CHUNK_CHARS=8000`,
`T2C_DOC_MAX_CHUNKS=12`, `T2C_DOC_MAX_RECORDS_PER_CHUNK=24` i osobny
`T2C_DOC_TIMEOUT_MS=45000`. Chunks zgodne z wykrytymi wcześniej targetami są
obsługiwane pierwsze. Przekroczenie liczby fragmentów nie jest ciche — run
otrzymuje `DOC_CHUNK_BUDGET` z liczbą przeanalizowanych i pominiętych chunków.

Payload podsumowania zachowuje najpierw wszystkie źródła nie-AST — w tym
dokumentację — po czym dopełnia limit istotnymi faktami AST. Limity 400
rekordów, 800 relacji i 250 diagnoz zapobiegają timeoutom dużych grafów;
diagnozy są wybierane od najwyższej ważności. Na grafie 3597 rekordów i
149 902 relacji ponowne podsumowanie `qwen/qwen3.7-flash` zakończyło się w
38 s i zawarło cytowania `INT-DOC`.

Artefakty JSON mają osobny limit od plików źródłowych (128 MiB), dzięki czemu
CLI może ponownie otworzyć wygenerowany graf 49 MiB.

## Metodyka

```bash
npm run build

# Etapy pipeline'u na realnym grafie
node - <<'JS'
import { readFileSync } from 'node:fs';
import { linkIntentRecords } from './dist/src/graph/linker.js';
const g = JSON.parse(readFileSync('.intent/runs/<run-id>/intent.graph.json','utf8'));
const t = performance.now();
const rebuilt = linkIntentRecords(g.records, g.generatedAt);
console.log((performance.now()-t).toFixed(0), 'ms; identical:', rebuilt.fingerprint === g.fingerprint);
JS
```

### Kontrola regresji

Rozróżnij dwa rodzaje zmian w linkerze:

- **Zmiana czysto wydajnościowa** (kroki 1, 2, 4) — `fingerprint` przebudowanego
  grafu musi być identyczny ze składowanym. Różnica oznacza niezamierzoną zmianę
  semantyki.
- **Zmiana kryterium wiązania** (krok 3) — fingerprint *z założenia* się różni,
  więc sam w sobie niczego nie dowodzi. Właściwym niezmiennikiem jest
  **zachowanie relacji niosących wniosek i raportu diagnostycznego**:

```bash
node - <<'JS'
import { readFileSync } from 'node:fs';
import { linkIntentRecords } from './dist/src/graph/linker.js';
import { diagnoseGraph } from './dist/src/graph/diagnostics.js';

const before = JSON.parse(readFileSync('.intent/runs/<run-id>/intent.graph.json','utf8'));
const after = linkIntentRecords(before.records, before.generatedAt);

// Relacje, które niosą wniosek — muszą przetrwać co do sztuki.
const carries = new Set(['implements','evidenced_by','plans','documents','releases','contradicts']);
const key = (r) => `${r.from}|${r.to}|${r.type}`;
const kept = new Set(after.relations.filter((r) => carries.has(r.type)).map(key));
const lost = before.relations.filter((r) => carries.has(r.type) && !kept.has(key(r)));
console.log('utracone relacje z wnioskiem:', lost.length);   // musi być 0

// Wnioski diagnostyczne nie mogą się zmienić.
console.log(JSON.stringify(diagnoseGraph(before).counts));
console.log(JSON.stringify(diagnoseGraph(after).counts));    // musi być identyczne
JS
```

Spadek liczby `related_to` jest efektem pożądanym; spadek któregokolwiek
z pozostałych typów albo zmiana liczności diagnoz to regresja.
