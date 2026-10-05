# ADR-0007: UX construction law vs inventory vs sprint rows

- **Status:** Accepted
- **Date:** 2026-09-15
- **Deciders:** Template maintainer

## Context

Agents shipped UI from Golden Path tokens but had no product-quality bar except a later review. A `/ux-review` dump of 50 items as Sequential `🔲 [AGENT]` rows would make `/build` implement them blindly. Incomplete “later” lists hide work.

## Decision

1. **Construction law** is [`docs/ux-ui-guidelines.md`](../ux-ui-guidelines.md) plus always-on `.cursor/rules/ux-ui.mdc`. Agents **build** to it (`/plan`, `/feature`). [`DESIGN_GUIDE.md`](../DESIGN_GUIDE.md) stays token/chrome mechanics.
2. **`/ux-review`** scores the **same** law against real UI and writes every **change** into the BUILD_PLAN **UX inventory** (`<!-- ux-inventory -->`). Protect-what-is-working stays in the report unless a change is required.
3. **Inventory** items are `UX-NNN` with status `planned` / `in_progress` / `done` only. Not Sequential sprint fuel. `/build` ignores them until `/ux-apply UX-NNN` (or a human) promotes one item to a `🔲 [AGENT]` row.
4. Gaps noticed while coding are inventory items **in the same turn**. Never backlog, deferred, later, phase-2, or optional as Status.

## Alternatives considered

- Pointer-only rule (“read the doc”) — rejected: agents ship slop without a build checklist.
- Dump every finding as Sequential AGENT rows — rejected: `/build` would drain dozens of unrelated slices.
- Review-only command with no construction law — rejected: quality bar must exist before the audit.

### Critique

| Issue | Resolution |
|-------|------------|
| Null/empty UI stack | Review writes 0 items; do not invent screens. Gate allows empty stub. |
| Network timeout | Build path has no network. Review `--quick` skips live compare. |
| Race on inventory | Merge by `UX-NNN`; `check-ux-inventory` fails on duplicate ids. |
| Unhandled “later” status | Parser rejects forbidden Status words. |

## Consequences

- Child `BUILD_PLAN_TEMPLATE.md` ships the inventory stub.
- `check-ux-inventory` is part of `validate-bootstrap --quick`.
- Do not run `/ux-review` as part of landing this ADR on the template maintainer board.
