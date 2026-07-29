# Example backend — kolejka zdarzeń intencji

Minimalny backend HTTP bez zewnętrznych zależności, używany jako repozytorium
wejściowe dla runtime'u `todo2code`.

## Kontrakt HTTP

| Metoda | Ścieżka | Odpowiedź |
|---|---|---|
| `GET` | `/health` | `200` ze statusem i liczbą zdarzeń |
| `POST` | `/events` | `202` z identyfikatorem zdarzenia |
| `GET` | `/events?offset=0&limit=50` | `200` ze stroną zdarzeń |

Ładunek `POST /events`:

```json
{ "agent": "agent-a", "action": "add", "object": "walidacja kontraktu" }
```

Nieprawidłowy ładunek zwraca `400` i nie trafia do magazynu.

## Moduły

- `src/server.ts` — routing HTTP i limit rozmiaru ciała żądania;
- `src/validation.ts` — walidacja ładunku przed `enqueueEvent`;
- `src/store.ts` — magazyn zdarzeń w pamięci.

## Uruchomienie analizy intencji

```bash
node ../../dist/src/cli.js pipeline . \
  --task task.md --todo TODO.md --changelog CHANGELOG.md \
  --docs 'README.md' --no-docs-llm --out .intent
```

## Kontrola kodu

Z katalogu głównego `todo2code`:

```bash
npx tsc -p examples/backend/tsconfig.json --noEmit
```

Pełny `npm run examples:check` dodatkowo uruchamia backend na losowym porcie i
sprawdza `GET /health`, poprawny `POST /events`, stronicowanie oraz odrzucenie
nieprawidłowego payloadu kodem `400`.
