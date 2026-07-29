# Contribution and release rules

## Zmiany funkcjonalne

- Każda zmiana publicznego zachowania musi zawierać test albo wskazywać istniejący test, który ją pokrywa.
- Nie wolno oznaczać zadania jako wykonane wyłącznie na podstawie deklaracji w commicie, changelogu lub odpowiedzi agenta. Wymagany jest dowód w kodzie i pozytywny wynik odpowiedniej walidacji.
- Należy zachować deterministyczną granicę LLM: tylko ekstrakcja dokumentacji i podsumowanie mogą wywoływać OpenRouter.

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
