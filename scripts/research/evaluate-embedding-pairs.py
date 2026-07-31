#!/usr/bin/env python3
"""Evaluate a pinned sentence-transformer on a positive/negative pair benchmark."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from sentence_transformers import SentenceTransformer


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("benchmark", type=Path)
    parser.add_argument("--model", required=True)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--query-prefix", default="")
    parser.add_argument("--passage-prefix", default="")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    benchmark = json.loads(args.benchmark.read_text(encoding="utf-8"))
    pairs = benchmark["pairs"]
    encoded_texts = list(dict.fromkeys(
        prefix + text
        for pair in pairs
        for prefix, text in (
            (args.query_prefix, pair["intent"]),
            (args.passage_prefix, pair["module"]),
        )
    ))

    started = time.monotonic()
    model = SentenceTransformer(
        args.model,
        revision=args.revision,
        cache_folder=str(args.cache),
    )
    loaded_seconds = time.monotonic() - started
    encoded = model.encode(
        encoded_texts,
        batch_size=16,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    elapsed_seconds = time.monotonic() - started
    vectors = dict(zip(encoded_texts, encoded, strict=True))

    results = []
    for pair in pairs:
        query = args.query_prefix + pair["intent"]
        passage = args.passage_prefix + pair["module"]
        score = float(vectors[query] @ vectors[passage])
        results.append({**pair, "score": round(score, 6)})

    positives = [row["score"] for row in results if row["expected"]]
    negatives = [row["score"] for row in results if not row["expected"]]
    output = {
        "schemaVersion": "t2c.embedding-experiment/v1",
        "model": args.model,
        "revision": args.revision,
        "queryPrefix": args.query_prefix,
        "passagePrefix": args.passage_prefix,
        "dimensions": int(encoded.shape[1]),
        "pairCount": len(results),
        "positiveCount": len(positives),
        "negativeCount": len(negatives),
        "minimumPositive": min(positives),
        "maximumNegative": max(negatives),
        "separation": min(positives) - max(negatives),
        "loadSeconds": round(loaded_seconds, 3),
        "totalSeconds": round(elapsed_seconds, 3),
        "results": results,
    }
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        key: output[key]
        for key in (
            "model",
            "revision",
            "dimensions",
            "minimumPositive",
            "maximumNegative",
            "separation",
            "loadSeconds",
            "totalSeconds",
        )
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
