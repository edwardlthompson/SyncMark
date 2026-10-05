"""Load and validate icon-factory jobs without extra deps."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _vec3(name: str, raw: Any) -> list[float]:
    if not isinstance(raw, list) or len(raw) != 3:
        raise ValueError(f"{name} must be [x, y, z]")
    return [float(raw[0]), float(raw[1]), float(raw[2])]


def _lights(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    lights = []
    for i, item in enumerate(raw[:3]):
        if not isinstance(item, dict):
            raise ValueError(f"area_lights[{i}] must be an object")
        lights.append(
            {
                "location": _vec3(f"area_lights[{i}].location", item.get("location")),
                "energy": float(item.get("energy") or 0),
            }
        )
    return lights


def _job(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("job must be an object")
    ident = str(raw.get("id") or "").strip()
    if not ident:
        raise ValueError("job id is required")
    if "seed" not in raw:
        raise ValueError(f"{ident}: seed is required")
    seed = int(raw["seed"])
    cam = raw.get("camera")
    if not isinstance(cam, dict):
        raise ValueError(f"{ident}: camera is required")
    lighting = raw.get("lighting") if isinstance(raw.get("lighting"), dict) else {}
    return {
        "id": ident,
        "seed": seed,
        "samples": int(raw.get("samples") or 32),
        "resolution": int(raw.get("resolution") or 1024),
        "film_transparent": bool(raw.get("film_transparent", True)),
        "yaw_deg": float(raw.get("yaw_deg") or 0),
        "camera": {
            "location": _vec3("camera.location", cam.get("location")),
            "look_at": _vec3("camera.look_at", cam.get("look_at")),
            "focal_mm": float(cam.get("focal_mm") or 50),
        },
        "lighting": {
            "hdri_rotation": float(lighting.get("hdri_rotation") or 0),
            "intensity": float(lighting.get("intensity") or 1),
            "area_lights": _lights(lighting.get("area_lights")),
        },
    }


def load_manifest(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("jobs"), list):
        raise ValueError("manifest must be {\"jobs\": [...]}")
    jobs = [_job(item) for item in data["jobs"]]
    if not jobs:
        raise ValueError("manifest jobs must not be empty")
    return jobs
