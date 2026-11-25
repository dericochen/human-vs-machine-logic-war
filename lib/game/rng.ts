// Deterministic, seedable pseudo-random utilities used across the game engine.
// The same seed always yields the same sequence, which keeps generated questions
// reproducible and lets the bank be rebuilt idempotently.

/** Mulberry32 PRNG — small, fast, good distribution for game use. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string to a 32-bit unsigned int (FNV-1a). */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Rng {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(arr: readonly T[]) => T;
  shuffle: <T>(arr: readonly T[]) => T[];
  chance: (p: number) => boolean;
  seed: number;
}

export function createRng(seed: number | string): Rng {
  const s = typeof seed === "string" ? hashString(seed) : seed >>> 0;
  const next = mulberry32(s);
  const rng: Rng = {
    next,
    seed: s,
    int(min: number, max: number): number {
      // inclusive of min, exclusive of max
      return min + Math.floor(next() * (max - min));
    },
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(next() * arr.length)];
    },
    shuffle<T>(arr: readonly T[]): T[] {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    chance(p: number): boolean {
      return next() < p;
    },
  };
  return rng;
}

/** Random 32-bit seed from crypto (non-deterministic, used for live matches). */
export function randomSeed(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0];
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export function stableId(parts: string[]): string {
  return "q_" + hashString(parts.join("|")).toString(16).padStart(8, "0");
}
