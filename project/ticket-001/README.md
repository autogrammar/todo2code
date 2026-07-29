# Ticket 001: Bootstrap repozytorium todo2code

- **ID**: ticket-001
- **Owner**: semcod
- **Status**: BLOCKED
- **Created**: 2026-07-29

## Goal & Scope

Przygotować repozytorium `semcod/todo2code` bez kodu aplikacji. Zakres obejmuje wyłącznie pliki wymagane przez `wellmanifest/new-project` oraz pusty katalog `docs/`.

## Acceptance Criteria

- [x] Obowiązkowe pliki bootstrapu znajdują się w docelowym katalogu projektu.
- [x] Istnieje katalog `docs/`.
- [x] Nie utworzono kodu aplikacji ani plików wykraczających poza wskazany zakres.
- [ ] Użytkownik zaakceptował opis intencji i `TODO.md`.
- [ ] Repozytorium `semcod/todo2code` istnieje na GitHubie.

## Risks & Considerations

- Publikacja jest zablokowana przez nieważne lokalne uwierzytelnienie GitHub CLI.
- Walidacja Docker jest zablokowana, ponieważ silnik Docker nie działa.
- Zakres funkcjonalny i docelowa architektura nie są jeszcze określone; nie należy ich zgadywać.

## Participants

- `AI-Codex.md`
