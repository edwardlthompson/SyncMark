import { normalizeCrockford, randomCrockford } from "./crockford.js";
import { SPACE_VERSION, type SpaceMeta } from "./types.js";

export interface CreatedSpace {
  space: SpaceMeta;
  secret: string;
  pairingCode: string;
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function formatPairingCode(spaceId: string, secret: string): string {
  return `SM-${spaceId}-${secret}`;
}

export function parsePairingCode(code: string): { spaceId: string; secret: string } | null {
  const cleaned = code.trim().toUpperCase().replace(/\s+/g, "");
  const dashed = cleaned.match(/^SM-([0-9A-HJKMNPQRSTVWXYZILO]+)-([0-9A-HJKMNPQRSTVWXYZILO]+)$/);
  if (dashed) {
    const spaceId = normalizeCrockford(dashed[1]);
    const secret = normalizeCrockford(dashed[2]);
    if (spaceId.length === 10 && secret.length === 16) return { spaceId, secret };
    return null;
  }
  const compact = normalizeCrockford(cleaned.startsWith("SM") ? cleaned.slice(2) : cleaned);
  if (compact.length === 26) {
    return { spaceId: compact.slice(0, 10), secret: compact.slice(10) };
  }
  return null;
}

export async function createSpace(
  name: string,
  randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
  now: () => string = () => new Date().toISOString(),
): Promise<CreatedSpace> {
  const id = randomCrockford(10, randomBytes);
  const secret = randomCrockford(16, randomBytes);
  const space: SpaceMeta = {
    version: SPACE_VERSION,
    id,
    name: name.trim() || "My SyncMark",
    secretHash: await sha256Hex(secret),
    createdAt: now(),
  };
  return { space, secret, pairingCode: formatPairingCode(id, secret) };
}

export async function verifySpaceSecret(space: SpaceMeta, secret: string): Promise<boolean> {
  return space.secretHash === (await sha256Hex(normalizeCrockford(secret)));
}

export function isValidSpace(value: unknown): value is SpaceMeta {
  if (!value || typeof value !== "object") return false;
  const s = value as SpaceMeta;
  return (
    s.version === SPACE_VERSION &&
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    typeof s.secretHash === "string" &&
    typeof s.createdAt === "string"
  );
}
