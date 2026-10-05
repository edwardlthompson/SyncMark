import { parsePairingCode, verifySpaceSecret } from "./space.js";
import type { SpaceMeta } from "./types.js";

export type JoinResult =
  | { ok: true; spaceId: string; secret: string }
  | { ok: false; reason: string };

export async function joinWithPairingCode(space: SpaceMeta, code: string): Promise<JoinResult> {
  const parsed = parsePairingCode(code);
  if (!parsed) return { ok: false, reason: "That pairing code does not look right." };
  if (parsed.spaceId !== space.id) {
    return { ok: false, reason: "This folder belongs to a different SyncMark space." };
  }
  if (!(await verifySpaceSecret(space, parsed.secret))) {
    return { ok: false, reason: "The pairing code does not match this folder." };
  }
  return { ok: true, spaceId: parsed.spaceId, secret: parsed.secret };
}
