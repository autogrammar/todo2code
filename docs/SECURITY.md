# Bezpieczeństwo

## Granica plików

MCP i A2A rozwiązują `root` względem `T2C_ROOT` i domyślnie odrzucają ścieżki wychodzące poza ten katalog. Kontrola obejmuje ścieżkę leksykalną oraz realpath najbliższego istniejącego elementu, dlatego dowiązanie symboliczne nie może przekierować odczytu poza workspace. Rekurencyjne analizatory pomijają symlinki. `T2C_ALLOW_OUTSIDE_ROOT=true` powinno być stosowane tylko w zaufanym środowisku lokalnym.

## Sekrety

- `.env` jest ignorowany przez Git i Docker context;
- OpenRouter key nie jest zapisywany do manifestu, grafu ani raportu;
- `doctor` redaguje klucze i tokeny;
- A2A może wymagać `T2C_A2A_TOKEN`;
- produkcyjny endpoint powinien być wystawiony za TLS i reverse proxy.

## Dane wysyłane do OpenRouter

Ekstraktor dokumentacji wysyła tylko pliki dopasowane do `T2C_DOC_PATTERNS` po zastosowaniu wykluczeń. Summarizer wysyła wyłącznie skompaktowany graf i diagnostykę, bez raw excerptów, diffów i pełnych plików kodu.

Przed użyciem na prywatnym repozytorium należy ustawić restrykcyjne globs i zweryfikować politykę wybranego modelu/providerów.

## Odporność

- limit rozmiaru pliku i body A2A;
- brak wykonywania komend pochodzących z dokumentacji/LLM;
- Git jest wywoływany przez `execFile`, nie shell;
- Python helper dostaje tylko katalog i limit pliku;
- parser OpenRouter przyjmuje JSON i następnie runtime normalizuje krytyczne pola provenance.
