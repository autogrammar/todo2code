from pathlib import Path


def load_task(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def normalize_task(value: str) -> str:
    return value.strip().lower()
