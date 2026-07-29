# Intent Evidence DSL (`t2c.intent/v1`)

## Rekord

```json
{
  "schemaVersion": "t2c.intent/v1",
  "id": "INT-TODO-0123456789abcdefabcd",
  "statement": {
    "kind": "todo_item",
    "actor": "team-platform",
    "action": "validate",
    "subject": null,
    "object": "contract before executeContract",
    "target": {
      "paths": ["src/runtime.ts"],
      "symbols": ["executeContract"],
      "tickets": ["T2C-14"],
      "versions": []
    },
    "modality": "required",
    "polarity": "positive",
    "text": "Dodać walidację kontraktu przed executeContract."
  },
  "lifecycle": { "status": "planned" },
  "source": {
    "kind": "todo",
    "path": "TODO.md",
    "lines": { "start": 5, "end": 5 },
    "revision": null,
    "symbol": null,
    "commitIndex": null,
    "extractor": "t2c/markdown-todo@1",
    "contentHash": "...",
    "rawExcerpt": "- [ ] Dodać walidację..."
  },
  "epistemic": {
    "class": "plan",
    "confidence": 0.9,
    "basis": ["markdown_checkbox"]
  },
  "observedAt": null,
  "metadata": { "checked": false, "llmUsed": false }
}
```

## Relacje

| Relacja | Interpretacja |
|---|---|
| `plans` | TODO planuje deklarację/ticket |
| `implements` | commit deklaruje implementację planu |
| `evidenced_by` | deklaracja lub claim ma powiązany fakt AST |
| `releases` | changelog publikuje zmianę |
| `documents` | dokumentacja opisuje intencję/zdolność |
| `contradicts` | rekordy mają podobny obiekt i przeciwną polaryzację |
| `duplicates` | prawdopodobne powtórzenie w tym samym rodzaju źródła |
| `same_as` | silna zgodność semantyczna |
| `related_to` | słabsze, ale wystarczające powiązanie |

## Reguły provenance

- LLM nie może zmienić `source.path`, `source.lines`, `source.extractor` ani `epistemic.class` ustawianych przez runtime.
- `fact` jest zarezerwowany dla obserwacji deterministycznych.
- Commit message i changelog są `claim`, nawet gdy brzmią jak zakończona praca.
- Rekord z dokumentacji LLM nie może przekroczyć confidence `0.85`.
- Rekord NL z LLM nie może przekroczyć confidence `0.9`, a runtime wymusza lifecycle `proposed` niezależnie od odpowiedzi modelu.
- `metadata.generation` wskazuje `requested`, faktycznie `used`, `degraded`, `fallbackReason`, wersję runtime i — dla LLM — model.
- Brak pola pozostaje brakiem; system nie tworzy ukrytego faktu.

## Audyt runu (`t2c.run/v1`)

Manifest jest częścią dowodu wykonania, nie tylko indeksem plików. Zawiera:

- `status: succeeded|degraded`;
- `runtime.name` i `runtime.version`;
- bezpieczny `configuration` bez tokenów i kluczy oraz jego SHA-256 fingerprint;
- statusy etapów NL, dokumentacji i podsumowania: `succeeded`, `partial`,
  `fallback`, `failed` albo `skipped`;
- requested/effective mode, model, czas, liczbę rekordów/ostrzeżeń i strukturalny
  powód degradacji.

Historyczne manifesty sprzed rozszerzenia nadal są czytane przez API; UI oznacza
ich status jako `legacy`.

## Diff grafów (`t2c.diff/v1`)

Diff zachowuje fingerprint grafu wcześniejszego i późniejszego oraz rozdziela rekordy na `added`, `removed`, `changed` i `unchanged`. Zmiana jest rozpoznawana po stabilnej tożsamości źródła (`kind`, ścieżka, linie, symbol i rodzaj statementu), dzięki czemu zmiana treści rekordu nie jest błędnie raportowana jako niezależne usunięcie i dodanie. Relacje są porównywane deterministycznie po końcach, typie, confidence i basis.

SVG jest wyłącznie projekcją `t2c.diff/v1`; nie jest źródłem danych i nie wpływa na fingerprint diffu.

## Diff plików (`t2c.filediff/v1`)

Deterministyczny algorytm Myersa porównuje linie bez LLM i zwraca hunki z numerami linii oraz podsumowaniem `added`, `removed`, `unchanged`. Ten sam model zasila unified diff, boczny widok SVG i HTML oraz tryb porównania Git. Dla bardzo dużego środka pliku runtime przechodzi na ograniczoną pamięciowo reprezentację blokowej zamiany i oznacza wynik jako `truncated`.

## Intent vs reality (`t2c.reality/v1`)

Widok zestawia źródła deklaratywne (`nl`, `todo`, `document`) z dowodami wykonania (`git`, `ast`) i changelogiem. Każdy temat ma jawne liczniki per źródło oraz status, m.in. `aligned`, `planned_not_implemented`, `implemented_not_planned`, `implemented_not_documented` lub `conflicting`. SVG i Markdown są projekcjami tego samego deterministycznego modelu.

## Origin vs workspace (`t2c.workspace-comparison/v1`)

Format wiąże pełny SHA bazy z HEAD i stanem roboczym, przechowuje `ahead`,
`behind`, listę plików zmienionych przed analizą, pełny `t2c.diff/v1` oraz
metryki pokrycia obu stron. `trend.direction` jest `improved`, `regressed` lub
`unchanged` na podstawie zmiany współczynnika aligned/topics i liczby gaps.
