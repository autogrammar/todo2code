#!/usr/bin/env python3
"""Run vallm with canonical parser IDs on affected batch CLI releases."""

from types import SimpleNamespace

import vallm.cli.batch_process as batch_process
from vallm.cli import app


_detect_file_language = batch_process.detect_file_language


def detect_file_language_with_parser_id(file_path):
    """Expose the lowercase tree-sitter ID through the legacy `.name` field."""
    language = _detect_file_language(file_path)
    if language is None:
        return None
    return SimpleNamespace(name=language.tree_sitter_id)


batch_process.detect_file_language = detect_file_language_with_parser_id


if __name__ == "__main__":
    app()
