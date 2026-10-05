"""Icon factory CLI. Inside Blender: bpy render. Outside: validate + QA only."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from cycles_device import cycles_device
from manifest import load_manifest
from qa import qa_png, write_report, write_stub_png

ROOT = Path(__file__).resolve().parent


def _hash_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _sidecar(dest: Path) -> Path:
    return dest.with_suffix(dest.suffix + ".sha256")


def _resume_hit(dest: Path) -> bool:
    side = _sidecar(dest)
    return dest.is_file() and side.is_file() and side.read_text(encoding="utf-8").strip() == _hash_file(dest)


def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Render icon-factory jobs")
    parser.add_argument("--manifest", default=str(ROOT / "fixtures/icon-manifest.sample.json"))
    parser.add_argument("--out", default=str(ROOT / "out"))
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--stub", action="store_true", help="Write stub PNGs (no Blender)")
    args = parser.parse_args(argv)
    try:
        jobs = load_manifest(Path(args.manifest))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 2
    if args.limit and args.limit > 0:
        jobs = jobs[: args.limit]
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    reports: list[dict] = []
    try:
        import bpy  # noqa: F401

        bpy_ok = True
    except ImportError:
        bpy_ok = False
    if not bpy_ok and not args.stub:
        print("SKIP: blender/bpy missing (use --stub for QA fixtures)", file=sys.stderr)
        return 0
    for job in jobs:
        dest = out / f"{job['id']}.png"
        if args.resume and _resume_hit(dest):
            item = qa_png(dest)
            item["id"] = job["id"]
            item["resumed"] = True
            reports.append(item)
            continue
        if bpy_ok and not args.stub:
            from render_job import render_png

            render_png(job, dest, device=cycles_device())
        else:
            write_stub_png(dest, size=min(64, int(job["resolution"])))
        item = qa_png(dest)
        item["id"] = job["id"]
        item["sha256"] = _hash_file(dest)
        if item.get("ok"):
            _sidecar(dest).write_text(item["sha256"] + "\n", encoding="utf-8")
        reports.append(item)
    write_report(out / "qa-report.json", reports)
    failed = [r for r in reports if not r.get("ok")]
    if failed:
        print(f"FAIL: {len(failed)} icon QA errors", file=sys.stderr)
        return 1
    print(f"OK: {len(reports)} icons ({cycles_device()})")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
