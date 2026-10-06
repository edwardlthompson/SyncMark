# ADR-0010: Local folder + pairing-code architecture

- **Status:** Accepted
- **Date:** 2026-10-05
- **Deciders:** SyncMark maintainers

## Context

SyncMark must unify bookmarks across browsers without accounts or a project-operated cloud. Users already sync folders with Syncthing, Dropbox desktop, network shares, or the same machine. Concurrent edits need a merge-friendly on-disk format. Category AI and NAT-traversing P2P are out of scope for MVP.

## Decision

**Pattern in practice:** Hexagonal (ports & adapters) around a pure TypeScript domain, delivered as a Manifest V3 / WebExtensions extension. (ADR-0001 remains the open template pick required by bootstrap gates; this ADR records the product decision.)

### Persistence

- The **user-owned SyncMark space** is the sole source of truth for bookmark content.
- Logical layout:
  - `space.json` (includes `devices[]` registry)
  - `changelog/<deviceId>.jsonl` — **one writer per file** (append-only); avoids Dropbox/Syncthing conflict copies
  - `snapshots/bookmarks.json` — materialised view rebuilt from all device logs
  - `tombstones.json` — soft deletes with `deletedAt` for cross-browser propagation
  - `health.json` — advisory link status
- Legacy root `changelog.jsonl` is migrated once into the local device log.
- Portable `*.syncmark.json` bundle remains supported for create/open/join.
- v1 merge: deterministic LWW on `(at, deviceId, seq)` for scalars; tag set-union; tombstone vs revive rules. Full CRDT later.

### Pairing

- Creating a space generates a **space id** and a **shared secret**.
- The human-enterable **pairing code** encodes id + secret (`SM-…` Crockford groups).
- Joining verifies the code against `space` metadata in the SyncMark file the user opens. No remote SyncMark server is contacted.

### Suggestions and health

- Category/tag suggestions use **local heuristics** (domain + title rules). User confirmation is required for any change.
- Dead-link checks are **on-demand**, rate-limited, and **never delete** bookmarks; status is advisory in `health`.

## Consequences

- Core logic under `extension/src/core/` stays free of browser APIs and is unit-tested with an in-memory folder port.
- Extension UI never uploads bookmark content to SyncMark-operated infrastructure.
- Changing to CRDT or LAN discovery requires a follow-on ADR.

## Alternatives Considered

| Pattern | Rejected because |
|---------|------------------|
| Project-hosted sync API | Violates Sacred brief (no cloud / no login) |
| Browser sync storage only | Does not unify across browser vendors or expose a user-owned file |
| Full CRDT (Automerge/Yjs) in v1 | Valuable but heavier; JSON bundle first for inspectability |
| True P2P mesh | Explicit non-goal for v1 |
