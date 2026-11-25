// Question/round bank generation.
//
// The bank is produced deterministically by the same generator used at match
// time, so every round has a verifiable answer. The seed script writes the same
// bank to `lib/data/round-bank.ts` and `supabase/migrations/*_seed.sql`.

import { createRng, type Rng } from "./rng.ts";
import { generateRound } from "./oddEmoji.ts";
import type { Difficulty, RoundDefinition } from "./types.ts";

export const BANK_PER_DIFFICULTY = 25; // 25 Ã— 4 = 100 validated rounds
export const BANK_SEED = 20260101;

export interface BankOptions {
  seed?: number;
  perDifficulty?: number;
}

/** Generate a bank with `perDifficulty` unique rounds per difficulty level. */
export function generateBank(options: BankOptions = {}): RoundDefinition[] {
  const seed = options.seed ?? BANK_SEED;
  const per = options.perDifficulty ?? BANK_PER_DIFFICULTY;
  const rng = createRng(seed);
  const seen = new Set<string>();
  const rounds: RoundDefinition[] = [];
  const difficulties: Difficulty[] = ["easy", "normal", "hard", "expert"];

  for (const d of difficulties) {
    let produced = 0;
    let guard = 0;
    while (produced < per && guard < per * 200) {
      guard++;
      const r = generateRound(d, rng);
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      rounds.push(r);
      produced++;
    }
  }
  return rounds;
}

let cache: RoundDefinition[] | null = null;

/**
 * Fallback bank used when Supabase is not configured, so the game remains fully
 * playable out of the box. Mirrors the seeded database bank.
 */
export function getFallbackBank(): RoundDefinition[] {
  if (!cache) cache = generateBank();
  return cache;
}

export function makeBankRng(seed: number | string): Rng {
  return createRng(seed);
}
