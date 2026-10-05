"""UX inventory parser rejects forbidden status and duplicate ids."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

LIB = Path(__file__).resolve().parent.parent / "scripts" / "lib"
ROOT = Path(__file__).resolve().parent.parent
if str(LIB) not in sys.path:
    sys.path.insert(0, str(LIB))

from ux_inventory import EMPTY, check_text, next_id  # noqa: E402

STUB = """# Plan
<!-- ux-inventory:begin -->
_No UX inventory items._
<!-- ux-inventory:end -->
"""

ITEM = """# Plan
<!-- ux-inventory:begin -->
### UX-001 — Primary CTA missing
- **Status:** planned
- **Source:** /ux-review
- **Severity:** High
- **Effort:** S
- **Impact:** 8
- **Where:** Settings / SettingsPanel.ts
- **What's wrong:** Two equal buttons
- **Why:** Users hesitate
- **Fix:** One filled primary Save
- **Pattern:** Linear Settings — one primary
- **Success:** One filled button on the screen
<!-- ux-inventory:end -->
"""


class UxInventoryTests(unittest.TestCase):
    def test_empty_stub_ok(self) -> None:
        self.assertEqual(check_text(STUB, label="stub"), [])

    def test_repo_plans(self) -> None:
        for name in ("BUILD_PLAN.md", "BUILD_PLAN_TEMPLATE.md"):
            text = (ROOT / name).read_text(encoding="utf-8")
            self.assertEqual(check_text(text, label=name), [])

    def test_item_ok_and_next_id(self) -> None:
        self.assertEqual(check_text(ITEM, label="item"), [])
        self.assertEqual(next_id(ITEM), "UX-002")

    def test_forbidden_status(self) -> None:
        bad = ITEM.replace("planned", "backlog")
        errors = check_text(bad, label="bad")
        self.assertTrue(any("forbidden" in e for e in errors))

    def test_duplicate_id(self) -> None:
        dup = ITEM.replace(
            "<!-- ux-inventory:end -->",
            "### UX-001 — Copy\n- **Status:** planned\n<!-- ux-inventory:end -->",
        )
        errors = check_text(dup, label="dup")
        self.assertTrue(any("duplicate" in e for e in errors))

    def test_commands_and_skill(self) -> None:
        for name in (
            "ux-review",
            "ux-apply",
            "ui-review",
            "ux-audit",
            "ui-audit",
            "a11y-check",
            "redesign",
            "compare-ui",
            "update-guidelines",
        ):
            path = ROOT / ".cursor" / "commands" / f"{name}.md"
            self.assertTrue(path.is_file(), msg=name)
        skill = (ROOT / ".cursor/skills/ux-review/SKILL.md").read_text(encoding="utf-8")
        self.assertIn("See also:", skill)
        cmd = (ROOT / ".cursor/commands/ux-review.md").read_text(encoding="utf-8")
        self.assertIn(".cursor/skills/ux-review/", cmd)

    def test_garbage_empty_fails(self) -> None:
        bad = STUB.replace(EMPTY, "later maybe")
        errors = check_text(bad, label="garbage")
        self.assertTrue(any("empty inventory" in e for e in errors))

    def test_wired(self) -> None:
        text = (ROOT / "scripts/validate-bootstrap.sh").read_text(encoding="utf-8")
        self.assertIn("check-ux-inventory.sh", text)


if __name__ == "__main__":
    unittest.main()
