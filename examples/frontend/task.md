# TASK-FE-021: Panel rozbieżności intencji

Zespół `team-web` musi dostarczyć panel przeglądarkowy pokazujący rozbieżności
między planem a kodem, korzystając z backendowej kolejki zdarzeń.

## Zakres

- Dodać klienta HTTP w `src/api.ts` opartego na `fetch`.
- Dodać renderowanie tabeli rozbieżności w `src/render.ts`.
- Dodać obsługę stanu widoku w `src/app.ts`.
- Dodać filtrowanie po statusie rozbieżności.

## Kryteria akceptacji

- Panel pobiera zdarzenia z `GET /events` i renderuje je bez przeładowania.
- Błąd sieci musi być pokazany użytkownikowi, a nie tylko zalogowany.
- Widok musi działać bez zewnętrznych bibliotek frontendowych.
