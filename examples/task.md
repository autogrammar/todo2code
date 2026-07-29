# T2C-14 — komunikacja i przepływ wiedzy

System musi przekształcać polecenia NL do wspólnego Intent DSL bez użycia LLM.
System musi przekształcać dokładnie 10 ostatnich commitów Git do tego samego DSL.
Aktualne TypeScript i Python AST muszą dostarczać fakty o symbolach, zależnościach i wywołaniach.
`TODO.md` i `CHANGELOG.md` muszą być parsowane deterministycznie.
Dokumentacja architektoniczna powinna być przekształcana do Intent DSL przez OpenRouter.
Dopiero końcowe podsumowanie grafu może używać LLM.
Runtime nie może wysyłać surowego kodu do modułu podsumowania.
