import type { ChangeOp } from "./types.js";

/** Total order for multi-writer logs: (at, deviceId, seq). */
export function compareOps(a: ChangeOp, b: ChangeOp): number {
  if (a.at !== b.at) return a.at < b.at ? -1 : 1;
  if (a.deviceId !== b.deviceId) return a.deviceId < b.deviceId ? -1 : 1;
  return a.seq - b.seq;
}

export function parseChangeLog(raw: string): ChangeOp[] {
  const out: ChangeOp[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const op = JSON.parse(t) as ChangeOp;
      if (!op?.op || !op.at) continue;
      out.push(normalizeLegacyOp(op));
    } catch {
      /* skip corrupt line */
    }
  }
  return out;
}

/** Upgrade pre-deviceId ops for replay compatibility. */
function normalizeLegacyOp(op: ChangeOp): ChangeOp {
  const any = op as ChangeOp & { seq?: number; deviceId?: string; url?: string };
  const seq = typeof any.seq === "number" ? any.seq : 0;
  const deviceId = typeof any.deviceId === "string" ? any.deviceId : "legacy";
  if (op.op === "remove") {
    return {
      op: "remove",
      id: op.id,
      url: typeof any.url === "string" ? any.url : "",
      title: (op as { title?: string }).title,
      folderPath: (op as { folderPath?: string[] }).folderPath,
      at: op.at,
      seq,
      deviceId,
    };
  }
  if (op.op === "setCategory") {
    return { ...op, seq, deviceId };
  }
  return { ...op, seq, deviceId };
}

export function serializeOps(ops: ChangeOp[]): string {
  if (!ops.length) return "";
  return ops.map((o) => JSON.stringify(o)).join("\n") + "\n";
}

export function nextSeq(ops: ChangeOp[]): number {
  let max = 0;
  for (const o of ops) if (o.seq > max) max = o.seq;
  return max + 1;
}

export function sortOps(ops: ChangeOp[]): ChangeOp[] {
  return [...ops].sort(compareOps);
}

/**
 * Drop exact duplicates (same device, seq and timestamp) copied into several logs.
 * `at` is part of the key so two different ops that reused a seq number are both kept.
 */
export function dedupeOps(ops: ChangeOp[]): ChangeOp[] {
  const seen = new Set<string>();
  const out: ChangeOp[] = [];
  for (const o of ops) {
    if (o.seq > 0) {
      const key = `${o.deviceId}\0${o.seq}\0${o.at}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(o);
  }
  return out;
}

/** Union of two op lists, deduped and in total order. */
export function unionOps(a: ChangeOp[], b: ChangeOp[]): ChangeOp[] {
  return sortOps(dedupeOps([...a, ...b]));
}
