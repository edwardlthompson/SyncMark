"""feature-catalog.json lists the optional Blender icon factory."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "schemas/golden-path/feature-catalog.json"


class FeatureCatalogBlenderTests(unittest.TestCase):
    def test_icon_factory_is_optional_stack(self) -> None:
        data = json.loads(CATALOG.read_text(encoding="utf-8"))
        feat = next(f for f in data["features"] if f["id"] == "icon-factory")
        self.assertEqual(feat["stacks"], ["blender"])
        self.assertIn("examples/blender/blender.toml", feat["detect"]["blender"])
        self.assertTrue(feat["spec"].startswith("docs/features/"))


if __name__ == "__main__":
    unittest.main()
