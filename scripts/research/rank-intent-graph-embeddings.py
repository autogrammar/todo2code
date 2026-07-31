#!/usr/bin/env python3
"""Research-only ranking of module aggregates for targetless declarations."""

from __future__ import annotations

import argparse
import hashlib
import json
import time
from pathlib import Path

from sentence_transformers import SentenceTransformer


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("graph", type=Path)
    parser.add_argument("--model", required=True)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--minimum-score", type=float, default=0.75)
    parser.add_argument("--minimum-margin", type=float, default=0.01)
    return parser.parse_args()


def projection_text(record: dict, prefix: str) -> str:
    statement = record["statement"]
    return prefix + " ".join(dict.fromkeys((
        statement["object"].strip(),
        statement["text"].strip(),
    )))


def main() -> None:
    args = parse_args()
    graph_bytes = args.graph.read_bytes()
    graph = json.loads(graph_bytes)
    modules = sorted(
        (
            record
            for record in graph["records"]
            if record["statement"]["kind"] == "module_fact"
        ),
        key=lambda record: record["id"],
    )
    declarations = sorted(
        (
            record
            for record in graph["records"]
            if record["source"]["kind"] in ("nl", "todo", "document")
            and not record["statement"]["target"]["paths"]
            and not record["statement"]["target"]["tickets"]
            and (
                record["source"]["kind"] == "todo"
                or record["statement"]["modality"] in ("required", "recommended")
            )
        ),
        key=lambda record: record["id"],
    )
    module_ids = {record["id"] for record in modules}
    current_modules: dict[str, set[str]] = {
        record["id"]: set()
        for record in declarations
    }
    for relation in graph["relations"]:
        if relation["from"] in current_modules and relation["to"] in module_ids:
            current_modules[relation["from"]].add(relation["to"])
        if relation["to"] in current_modules and relation["from"] in module_ids:
            current_modules[relation["to"]].add(relation["from"])

    query_texts = [projection_text(record, "query: ") for record in declarations]
    passage_texts = [projection_text(record, "passage: ") for record in modules]
    started = time.monotonic()
    model = SentenceTransformer(
        args.model,
        revision=args.revision,
        cache_folder=str(args.cache),
    )
    query_vectors = model.encode(
        query_texts,
        batch_size=16,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    passage_vectors = model.encode(
        passage_texts,
        batch_size=16,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    scores = query_vectors @ passage_vectors.T

    rankings = []
    for declaration, row in zip(declarations, scores, strict=True):
        order = row.argsort()[::-1][:3]
        top = [
            {
                "recordId": modules[int(index)]["id"],
                "path": modules[int(index)]["statement"]["target"]["paths"][0],
                "score": round(float(row[index]), 6),
            }
            for index in order
        ]
        best = top[0]
        second = top[1]
        margin = round(best["score"] - second["score"], 6)
        best_module_index = int(order[0])
        reverse_order = scores[:, best_module_index].argsort()[::-1][:2]
        reverse_best = int(reverse_order[0])
        reverse_margin = round(
            float(scores[reverse_best, best_module_index])
            - float(scores[int(reverse_order[1]), best_module_index]),
            6,
        )
        reciprocal = declarations[reverse_best]["id"] == declaration["id"]
        existing = sorted(current_modules[declaration["id"]])
        selected = (
            best["score"] >= args.minimum_score
            and margin >= args.minimum_margin
            and reciprocal
            and reverse_margin >= args.minimum_margin
        )
        rankings.append({
            "recordId": declaration["id"],
            "sourceKind": declaration["source"]["kind"],
            "sourcePath": declaration["source"]["path"],
            "modality": declaration["statement"]["modality"],
            "text": declaration["statement"]["text"],
            "currentModuleIds": existing,
            "top": top,
            "margin": margin,
            "reciprocalTopOne": reciprocal,
            "reverseMargin": reverse_margin,
            "selected": selected,
            "addsNewCandidate": selected and best["recordId"] not in existing,
        })

    output = {
        "schemaVersion": "t2c.embedding-ranking-experiment/v1",
        "graphFingerprint": graph["fingerprint"],
        "graphSha256": hashlib.sha256(graph_bytes).hexdigest(),
        "model": args.model,
        "revision": args.revision,
        "queryPrefix": "query: ",
        "passagePrefix": "passage: ",
        "minimumScore": args.minimum_score,
        "minimumMargin": args.minimum_margin,
        "moduleCount": len(modules),
        "declarationCount": len(declarations),
        "selectedCount": sum(row["selected"] for row in rankings),
        "newCandidateCount": sum(row["addsNewCandidate"] for row in rankings),
        "elapsedSeconds": round(time.monotonic() - started, 3),
        "rankings": rankings,
    }
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        key: output[key]
        for key in (
            "graphFingerprint",
            "moduleCount",
            "declarationCount",
            "selectedCount",
            "newCandidateCount",
            "elapsedSeconds",
        )
    }))


if __name__ == "__main__":
    main()
