"""Machine QA for icon PNGs — no human review of thousands of frames."""
from __future__ import annotations

import json
import struct
import zlib
from pathlib import Path
from typing import Any

MAX_BYTES = 8 * 1024 * 1024
MIN_ALPHA_RATIO = 0.02


def write_stub_png(path: Path, *, size: int = 64, alpha: int = 200) -> None:
    """Write a tiny RGBA PNG (stdlib only) for unit tests."""
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            row.extend((30, 140, 220, alpha if x > 4 and y > 4 else 0))
        rows.append(b"\x00" + bytes(row))
    raw = b"".join(rows)
    compressed = zlib.compress(raw)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b""))


def inspect_png(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path} is not a PNG")
    width, height, bit, color = struct.unpack(">IIBB", data[16:26])
    return {
        "path": str(path),
        "bytes": len(data),
        "width": width,
        "height": height,
        "bit_depth": bit,
        "color_type": color,
    }


def _idat(data: bytes) -> bytes:
    i, chunks = 8, []
    while i + 8 <= len(data):
        n = struct.unpack(">I", data[i : i + 4])[0]
        tag = data[i + 4 : i + 8]
        chunks.append(data[i + 8 : i + 8 + n] if tag == b"IDAT" else b"")
        i += 12 + n
        if tag == b"IEND":
            break
    return zlib.decompress(b"".join(chunks))


def alpha_ratio(path: Path) -> float | None:
    info = inspect_png(path)
    if info["color_type"] != 6 or info["bit_depth"] != 8:
        return None
    raw = _idat(path.read_bytes())
    w, h = info["width"], info["height"]
    stride, opaque, i = w * 4, 0, 0
    for _ in range(h):
        filt = raw[i]
        row = raw[i + 1 : i + 1 + stride]
        i += 1 + stride
        if filt != 0 or len(row) < stride:
            return None
        opaque += sum(1 for x in range(w) if row[x * 4 + 3] > 16)
    return opaque / max(1, w * h)


def qa_png(path: Path, *, expect: int | None = None) -> dict[str, Any]:
    info = inspect_png(path)
    errors: list[str] = []
    if info["bytes"] > MAX_BYTES:
        errors.append("file too large")
    if expect and (info["width"] != expect or info["height"] != expect):
        errors.append("resolution mismatch")
    if info["bit_depth"] != 8 or info["color_type"] not in (2, 6):
        errors.append("expected 8-bit RGB or RGBA")
    ratio = alpha_ratio(path) if info["color_type"] == 6 else None
    if ratio is not None and ratio < MIN_ALPHA_RATIO:
        errors.append("alpha coverage too low")
    info["ok"] = not errors
    info["errors"] = errors
    info["alpha_ratio"] = ratio
    return info


def write_report(path: Path, jobs: list[dict[str, Any]]) -> None:
    path.write_text(json.dumps({"jobs": jobs}, indent=2) + "\n", encoding="utf-8")
