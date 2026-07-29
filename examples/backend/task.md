# TASK-BE-014: Kolejka zdarzeń intencji

Zespół `team-platform` musi udostępnić backendowe API kolejkujące zdarzenia intencji
z agentów, aby raporty zespołowe powstawały na podstawie jednego źródła prawdy.

## Zakres

- Dodać serwer HTTP w `src/server.ts` bez zewnętrznych zależności.
- Zaimplementować walidację ładunku przed `enqueueEvent`.
- Dodać trwały magazyn zdarzeń w `src/store.ts`.
- Udokumentować kontrakt HTTP w `README.md`.

## Kryteria akceptacji

- Endpoint `POST /events` zwraca `202` i identyfikator zdarzenia.
- Endpoint `GET /events` zwraca zdarzenia w kolejności zapisu.
- Nieprawidłowy ładunek musi zwrócić `400` bez zapisu do magazynu.
- Każde odrzucenie jest logowane z powodem.
