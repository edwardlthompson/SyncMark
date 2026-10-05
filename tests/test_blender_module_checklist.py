"""Blender MODULE.md stays aligned with examples and optional-stack docs."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / "scripts" / "lib"
if str(LIB) not in sys.path:
    sys.path.insert(0, str(LIB))
MOD = ROOT / "modules/blender/MODULE.md"

from bootstrap_engine import STACKS  # noqa: E402


class BlenderModuleChecklistTests(unittest.TestCase):
    def test_activation_checklist(self) -> None:
        if not MOD.is_file():
            self.skipTest("blender module pruned")
        text = MOD.read_text(encoding="utf-8")
        self.assertIn("## Activation Checklist", text)
        self.assertIn("examples/blender/", text)
        self.assertIn("child-activation", text.lower())
        self.assertIn("OptiX", text)
        self.assertTrue((ROOT / "examples/blender/blender.toml").is_file())

    def test_not_in_init_picker(self) -> None:
        self.assertNotIn("blender", STACKS)


if __name__ == "__main__":
    unittest.main()
