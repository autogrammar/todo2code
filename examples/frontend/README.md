# Example frontend — panel rozbieżności intencji

Panel przeglądarkowy bez bibliotek zewnętrznych, konsumujący API przykładowego
backendu. Służy jako drugie repozytorium wejściowe dla runtime'u `todo2code`.

## Moduły

- `src/api.ts` — klient HTTP `fetchEvents` i `publishEvent`;
- `src/render.ts` — renderowanie tabeli rozbieżności i komunikatu błędu;
- `src/app.ts` — stan widoku i montowanie panelu.

## Przepływ

1. `mountPanel` tworzy stan i wywołuje `refresh`.
2. `refresh` pobiera stronę zdarzeń przez `GET /events`.
3. `renderTable` renderuje wiersze; błąd sieci trafia do `renderError`.

## Uruchomienie analizy intencji

```bash
node ../../dist/src/cli.js pipeline . \
  --task task.md --todo TODO.md --changelog CHANGELOG.md \
  --docs 'README.md' --no-docs-llm --out .intent
```
