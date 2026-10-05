const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function encodeCrockford(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function randomCrockford(length: number, randomBytes: (n: number) => Uint8Array): string {
  const need = Math.ceil((length * 5) / 8);
  const encoded = encodeCrockford(randomBytes(need));
  return encoded.slice(0, length);
}

export function normalizeCrockford(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[ILO]/g, (c) => ({ I: "1", L: "1", O: "0" }[c] ?? c))
    .replace(/[^0-9A-HJKMNP-TV-Z]/g, "");
}
