# Intent Guard — diagramy

## Zawartość

- `ALL_DIAGRAMS.md` — wszystkie diagramy w jednym pliku Markdown.
- `*.mmd` — osobne źródła Mermaid, po jednym diagramie na plik.

## Najnowsze założenia

1. Użytkownik przekazuje intencję.
2. AI generuje TODO i kryteria.
3. Człowiek zatwierdza TODO.
4. Agent sam uruchamia `intent-guard` zgodnie z instrukcjami projektu.
5. Paczka analizuje kod, Git, dokumenty i pracę agenta.
6. Powstają minimum trzy DSL-e:
   - Code Reality,
   - Change Intent,
   - Declared Intent.
7. Opcjonalnie powstaje osobny Execution Evidence DSL.
8. Wszystkie źródła są konsolidowane do DSL 4.
9. System generuje raport, decyzję bramki i patche Markdown.
10. Człowiek zatwierdza każdą oficjalną zmianę.
