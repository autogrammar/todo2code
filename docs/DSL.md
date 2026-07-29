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
- Brak pola pozostaje brakiem; system nie tworzy ukrytego faktu.
