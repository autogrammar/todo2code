# Contribution and release rules

## Zmiany funkcjonalne

- Każda zmiana publicznego zachowania musi zawierać test albo wskazywać istniejący test, który ją pokrywa.
- Nie wolno oznaczać zadania jako wykonane wyłącznie na podstawie deklaracji w commicie, changelogu lub odpowiedzi agenta. Wymagany jest dowód w kodzie i pozytywny wynik odpowiedniej walidacji.
- Należy zachować jawną granicę LLM: OpenRouter może być wywoływany wyłącznie przez audytowalny orkiestrator NL (`src/extractors/nl-llm.ts`), semantyczne wzbogacanie TODO/CHANGELOG (`src/extractors/markdown-llm.ts`), ekstrakcję dokumentacji i podsumowanie. Deterministyczne ekstraktory, linker, diagnostyka, diff i Intent vs Reality nie mogą importować klienta LLM; sprawdzają to `verify:no-llm` i `verify:modules`.
- Każda zmienna środowiskowa odczytywana przez kod, skrypty, Makefile, Docker/Compose lub przykłady SDK musi występować dokładnie raz w `.env.example`; `verify:env` odrzuca też przestarzałe aliasy, nadmiarowe klucze i niesynchronizowany lokalny `.env`. Sekrety pozostają wyłącznie w ignorowanym `.env`.
- Każdy etap LLM musi zapisać model, bezpieczne parametry konfiguracji, status `succeeded|partial|fallback|failed|skipped` oraz powód degradacji. Sekrety nie mogą trafić do artefaktów.

## Workflow GitHub

- Wszystkie zatwierdzone zmiany należy commitować bezpośrednio do gałęzi `main` i wypychać przez `git push origin main`.
- Nie wolno tworzyć ani używać pull requestów (PR) w tym repozytorium.
- Przed bezpośrednim pushem należy uruchomić walidację odpowiednią do zakresu zmian.
- Jeśli bezpośredni push do `main` zostanie odrzucony, należy zgłosić blokadę zamiast tworzyć PR, wykonywać force push albo omijać zabezpieczenia repozytorium.

## TODO, changelog i wersja

Przy każdym zatwierdzonym wydaniu należy wykonać wszystkie poniższe kroki:

1. Usunąć z `TODO.md` wyłącznie pozycje faktycznie wykonane i zweryfikowane. Otwarte zadania pozostają w pliku bez zmiany statusu.
2. Przenieść opis wykonanych pozycji do nowej sekcji wersji w `CHANGELOG.md`. Nie wolno przepisywać ani usuwać historii wcześniejszych wydań.
3. Podbić semantyczną wersję w `VERSION` oraz we wszystkich manifestach i publicznych stałych wersji, które już przechowują wersję pakietu lub serwera.
4. Uruchomić `npm run verify`, kontrole SDK objętych zmianą oraz odpowiedni smoke test runtime'u. Nie tworzyć taga, jeśli którakolwiek wymagana kontrola nie przechodzi.
5. Commit wydaniowy musi zawierać zsynchronizowane `TODO.md`, `CHANGELOG.md`, `VERSION`, manifesty, kod i testy.

`VERSION` przechowuje numer bez prefiksu, na przykład `0.2.0`. Odpowiadający tag Git ma postać `v0.2.0` i musi wskazywać dokładnie commit wydaniowy. Po zatwierdzeniu wydania należy wypchnąć najpierw commit na główną gałąź, a następnie anotowany tag do `origin`:

```bash
version="$(cat VERSION)"
git tag -a "v${version}" -m "todo2code ${version}"
git push origin main
git push origin "v${version}"
```

Istniejących tagów wydaniowych nie wolno nadpisywać ani przesuwać.
