#!/usr/bin/env python3
"""Dependency-free Python entry point for the shared governed-intake handler.

Command/query execution delegates to the built TypeScript CLI, so Python,
TypeScript, MCP and A2A share one authorization/event-sourcing implementation.
The local codec is dependency-free and intentionally supports only the
varint/length-delimited fields in governed-intake.proto.
"""

from __future__ import annotations

import argparse
import base64
import json
import pathlib
import subprocess
import sys
from typing import Any


FIELDS = {
    1: "schemaVersion", 2: "messageId", 3: "correlationId", 4: "causationId",
    5: "idempotencyKey", 6: "authenticatedPrincipal", 7: "expectedVersion",
    8: "timestamp", 9: "payloadHash", 10: "payload",
}
SKIP_UNKNOWN_FIELD = object()


def _varint(value: int) -> bytes:
    if value < 0:
        raise ValueError("negative varint")
    output = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        output.append(byte | (0x80 if value else 0))
        if not value:
            return bytes(output)


def _read_varint(data: bytes, offset: int) -> tuple[int, int]:
    value = 0
    shift = 0
    for _ in range(10):
        if offset >= len(data):
            raise ValueError("truncated varint")
        byte = data[offset]
        offset += 1
        value |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return value, offset
        shift += 7
    raise ValueError("varint exceeds supported range")


def encode_envelope(envelope: dict[str, Any]) -> bytes:
    output = bytearray()
    for number in range(1, 11):
        key = FIELDS[number]
        value = envelope.get(key)
        if value is None:
            continue
        if number == 7:
            output += _varint(number << 3)
            output += _varint(int(value))
            continue
        if number == 10:
            raw = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()
        else:
            raw = str(value).encode()
        output += _varint((number << 3) | 2)
        output += _varint(len(raw))
        output += raw
    for unknown in envelope.get("unknownFields", []):
        output += base64.b64decode(unknown, validate=True)
    return bytes(output)


def decode_envelope(data: bytes) -> dict[str, Any]:
    output: dict[str, Any] = {"causationId": None, "expectedVersion": None}
    unknown: list[str] = []
    offset = 0
    while offset < len(data):
        start = offset
        number, wire, value_start, offset = read_field_metadata(data, offset)
        value = read_field_value(data, number, wire, value_start, offset)
        if value is SKIP_UNKNOWN_FIELD:
            unknown.append(base64.b64encode(data[start:offset]).decode())
            continue
        if value is not None:
            output[value[0]] = value[1]
    if unknown:
        output["unknownFields"] = unknown
    return output


def read_field_metadata(data: bytes, offset: int) -> tuple[int, int, int, int]:
    tag, offset = _read_varint(data, offset)
    number, wire = tag >> 3, tag & 7
    if wire == 0:
        value_start = offset
        _, offset = _read_varint(data, offset)
        return number, wire, value_start, offset
    if wire == 2:
        length, offset = _read_varint(data, offset)
        end = offset + length
        if end > len(data):
            raise ValueError("truncated length-delimited field")
        return number, wire, offset, end
    raise ValueError(f"unsupported wire type {wire}")


def read_field_value(
    data: bytes,
    number: int,
    wire: int,
    value_start: int,
    value_end: int,
) -> tuple[str, Any] | object | None:
    if value_start > len(data) or value_end > len(data) or value_end < value_start:
        raise ValueError("invalid field payload")
    if wire == 0 and number == 7:
        value, _ = _read_varint(data, value_start)
        return ("expectedVersion", value)
    if wire == 0:
        return SKIP_UNKNOWN_FIELD
    if wire == 2 and number in FIELDS and number != 7:
        payload = data[value_start:value_end]
        field_value = json.loads(payload) if number == 10 else payload.decode()
        return (FIELDS[number], field_value)
    return SKIP_UNKNOWN_FIELD


def execute(args: argparse.Namespace) -> int:
    repository = pathlib.Path(args.repository).resolve()
    cli = repository / "dist" / "src" / "cli.js"
    if not cli.is_file():
        print("intake_cli.py: build todo2code first (npm run build)", file=sys.stderr)
        return 7
    command = ["node", str(cli), "intake", args.operation, str(pathlib.Path(args.input).resolve()), "--root", args.root, "--project-dir", args.project_dir]
    if args.protobuf:
        command.append("--protobuf")
    return subprocess.run(command, cwd=repository, check=False).returncode


def run_command(args: argparse.Namespace) -> int:
    return execute(args)


def run_encode(args: argparse.Namespace) -> int:
    envelope = json.loads(pathlib.Path(args.input).read_text(encoding="utf-8"))
    pathlib.Path(args.output).write_bytes(encode_envelope(envelope))
    return 0


def run_decode(args: argparse.Namespace) -> int:
    envelope = decode_envelope(pathlib.Path(args.input).read_bytes())
    pathlib.Path(args.output).write_text(json.dumps(envelope, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Dependency-free todo2code governed-intake CLI")
    sub = parser.add_subparsers(dest="mode", required=True)
    for operation in ("command", "query"):
        add_command_parser(sub, operation)

    encode = sub.add_parser("encode")
    encode.add_argument("input")
    encode.add_argument("output")
    encode.set_defaults(handler=run_encode)

    decode = sub.add_parser("decode")
    decode.add_argument("input")
    decode.add_argument("output")
    decode.set_defaults(handler=run_decode)

    return parser


def add_command_parser(sub: argparse._SubParsersAction, operation: str) -> None:
    run = sub.add_parser(operation)
    run.add_argument("input")
    run.add_argument("--repository", default=".")
    run.add_argument("--root", default=".")
    run.add_argument("--project-dir", default="project")
    run.add_argument("--protobuf", action="store_true")
    run.set_defaults(handler=run_command, operation=operation)


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        result = args.handler(args)
        return int(result)
    except (OSError, ValueError, json.JSONDecodeError, UnicodeError) as error:
        print(f"T2C-INTAKE-INVALID-WIRE: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
