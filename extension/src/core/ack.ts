import type { ChangeOp } from "./types.js";

/** Written by each browser after it applied the shared log: "I have everything up to these seq numbers". */
export interface Ack {
  deviceId: string;
  /** Short browser name for messages, e.g. "firefox". */
  browser: string;
  at: string;
  /** Highest seq seen per writing device when the sync began. */
  seen: Record<string, number>;
}

export interface PendingLink {
  url: string;
  title: string;
  /** Own log seq that must be seen by other browsers; set after the sync that published the link. */
  needSeq?: number;
  addedAt: number;
  /** Devices that already confirmed. */
  ackedBy: string[];
  warned?: boolean;
}

export function ackPath(deviceId: string): string {
  return `acks/${deviceId}.json`;
}

export function seenFromOps(ops: ChangeOp[]): Record<string, number> {
  const seen: Record<string, number> = {};
  for (const o of ops) if (o.deviceId && o.seq > (seen[o.deviceId] ?? 0)) seen[o.deviceId] = o.seq;
  return seen;
}

export function parseAck(raw: string | null): Ack | null {
  if (!raw) return null;
  try {
    const a = JSON.parse(raw) as Ack;
    return a && typeof a.deviceId === "string" && a.seen && typeof a.seen === "object" ? a : null;
  } catch {
    return null;
  }
}

/** Highest seq an own op has, i.e. what other browsers must reach to hold everything we published. */
export function ownMaxSeq(ops: ChangeOp[], ownId: string): number {
  return seenFromOps(ops)[ownId] ?? 0;
}

export interface VerifyResult {
  /** Browsers that confirmed this link since the last check. */
  newlyAcked: Ack[];
  /** Every known other browser has it. */
  complete: boolean;
}

/** Which other browsers hold `link`, given everyone's latest ack. Browsers without an ack are unknown and ignored. */
export function verifyLink(link: PendingLink, acks: Ack[], ownId: string): VerifyResult {
  if (link.needSeq == null) return { newlyAcked: [], complete: false };
  const others = acks.filter((a) => a.deviceId !== ownId);
  const has = others.filter((a) => (a.seen[ownId] ?? 0) >= (link.needSeq as number));
  const newlyAcked = has.filter((a) => !link.ackedBy.includes(a.deviceId));
  return { newlyAcked, complete: others.length > 0 && has.length === others.length };
}

/** Human list: "Firefox", "Firefox and Brave". */
export function browserNames(acks: Ack[]): string {
  const names = [...new Set(acks.map((a) => a.browser.charAt(0).toUpperCase() + a.browser.slice(1)))];
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "the other browser");
}
