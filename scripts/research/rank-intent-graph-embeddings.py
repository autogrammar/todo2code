#!/usr/bin/env python3
"""Research-only ranking of module aggregates for targetless declarations."""

from __future__ import annotations

import argparse
import hashlib
import json
import time
from pathlib import Path
from typing import Any, Iterable

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


def load_graph(graph_path: Path) -> tuple[dict[str, Any], bytes]:
    graph_bytes = graph_path.read_bytes()
    return json.loads(graph_bytes), graph_bytes


def extract_modules(graph: dict[str, Any]) -> list[dict[str, Any]]:
    return sorted(
        (
            record
            for record in graph["records"]
            if record["statement"]["kind"] == "module_fact"
        ),
        key=lambda record: record["id"],
    )


def extract_declarations(graph: dict[str, Any]) -> list[dict[str, Any]]:
    return sorted(
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


def collect_current_module_links(
    declarations: Iterable[dict[str, Any]],
    relations: Iterable[dict[str, Any]],
    module_ids: set[str],
) -> dict[str, set[str]]:
    current_modules: dict[str, set[str]] = {
        record["id"]: set()
        for record in declarations
    }
    for relation in relations:
        source_id = relation["from"]
        target_id = relation["to"]
        if source_id in current_modules and target_id in module_ids:
            current_modules[source_id].add(target_id)
        if target_id in current_modules and source_id in module_ids:
            current_modules[target_id].add(source_id)
    return current_modules


def build_projection_texts(declarations: list[dict[str, Any]], modules: list[dict[str, Any]]) -> tuple[list[str], list[str]]:
    query_texts = [projection_text(record, "query: ") for record in declarations]
    passage_texts = [projection_text(record, "passage: ") for record in modules]
    return query_texts, passage_texts


def build_rankings(
    declarations: list[dict[str, Any]],
    modules: list[dict[str, Any]],
    scores,
    current_modules: dict[str, set[str]],
    minimum_score: float,
    minimum_margin: float,
) -> list[dict[str, Any]]:
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
            best["score"] >= minimum_score
            and margin >= minimum_margin
            and reciprocal
            and reverse_margin >= minimum_margin
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
    return rankings


def build_output(
    graph: dict[str, Any],
    graph_bytes: bytes,
    args: argparse.Namespace,
    modules: list[dict[str, Any]],
    declarations: list[dict[str, Any]],
    rankings: list[dict[str, Any]],
    elapsed_seconds: float,
) -> dict[str, Any]:
    return {
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
        "elapsedSeconds": elapsed_seconds,
        "rankings": rankings,
    }


def write_output(path: Path, output: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def print_summary(output: dict[str, Any]) -> None:
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


def main() -> None:
    args = parse_args()
    graph, graph_bytes = load_graph(args.graph)
    modules = extract_modules(graph)
    declarations = extract_declarations(graph)
    module_ids = {record["id"] for record in modules}
    current_modules = collect_current_module_links(declarations, graph["relations"], module_ids)

    query_texts, passage_texts = build_projection_texts(declarations, modules)
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
    rankings = build_rankings(
        declarations=declarations,
        modules=modules,
        scores=scores,
        current_modules=current_modules,
        minimum_score=args.minimum_score,
        minimum_margin=args.minimum_margin,
    )
    output = build_output(
        graph=graph,
        graph_bytes=graph_bytes,
        args=args,
        modules=modules,
        declarations=declarations,
        rankings=rankings,
        elapsed_seconds=round(time.monotonic() - started, 3),
    )
    write_output(args.output, output)
    print_summary(output)


if __name__ == "__main__":
    main()
