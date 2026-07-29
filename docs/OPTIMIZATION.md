# Analiza wydajności runtime'u

Pomiary wykonane na realnym runie `.intent/runs/20260729T120109Z-e74bf713`
(**2561 rekordów**, **95 549 relacji**), Node.js 20, jeden wątek. Każdą liczbę
da się odtworzyć skryptami opisanymi w sekcji [Metodyka](#metodyka).

## Podsumowanie

| Etap | Przed | Po | Status |
|---|--:|--:|---|
| `linkIntentRecords` | 3480 ms | **1717 ms** | zastosowane (2,0×) |
| `diagnoseGraph` | ~O(n²) lookup | 85 ms | zastosowane |
| `buildRealityView` | — | 7 ms | bez zastrzeżeń |

Zastosowane zmiany **nie zmieniają wyniku**: fingerprint grafu przed i po jest
identyczny co do bajtu (`16549106e3f926a1…`), liczba relacji bez zmian (95 549).

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

## 3. Objętość relacji — wymaga decyzji, nie zastosowane

To jest **główna dźwignia**, a nie mikrooptymalizacja. Rozkład par kandydujących:

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

### Proponowane warianty

Każdy zmienia zbiór relacji, więc **zmienia fingerprinty i diagnostykę** — stąd
brak automatycznego zastosowania.

1. **Nie parować AST↔AST po samym `path:`** (rekomendowane). Wymagać dla takiej
   pary dodatkowo wspólnego symbolu lub podobieństwa tekstu. Szacowana redukcja
   par: ~70 %, przy zachowaniu relacji plan↔kod, które niosą wartość.
2. **Obniżyć limit bucketa** z 300 do np. 60. Prosty, ale arbitralny: obcina
   duże pliki niedeterministycznie względem zawartości.
3. **Podnieść próg `score` z 0,42** dla par opartych wyłącznie na `shared_path`.

## 4. Pozostały budżet `linkIntentRecords` (1717 ms)

```text
bucketing                        16 ms
budowa zbioru par                91 ms
sortowanie 177k kluczy           29 ms
split "id|id" na parę            44 ms
createRelationId × 95 549       382 ms
graphFingerprint                350 ms
scoring + dedup + sort          ~805 ms
```

Drobne, bezpieczne usprawnienia do rozważenia:

- przechowywać pary jako `[string, string]` zamiast klucza `"a|b"` — usuwa
  44 ms `split()` i alokację 157k stringów;
- `createRelationId` liczy hash z pola `basis` (tablica stringów); skrócenie
  seeda do `from|to|type` obniżyłoby koszt, ale zmienia identyfikatory.

Oba mają sens dopiero po decyzji z punktu 3 — redukcja liczby relacji zdejmuje
te koszty automatycznie.

## 5. Ekstrakcja dokumentacji i podsumowanie LLM — zastosowane

Fragmenty dokumentów są przetwarzane przez ograniczoną pulę workerów
(`T2C_DOC_CONCURRENCY`, domyślnie 3), a wyniki są składane w pierwotnej,
deterministycznej kolejności. Test mierzy rzeczywistą liczbę równoległych
żądań. Timeout lub błąd transportu nie uruchamia już drugiego, bezcelowego
fallbacku bez JSON Schema; fallback pozostaje tylko dla błędów formatu i
obsługi structured output.

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

Kontrola regresji wyniku: po każdej zmianie w linkerze przebudować graf z tych
samych rekordów i porównać `fingerprint` ze składowanym. Różnica oznacza zmianę
semantyki, a nie samej wydajności.
