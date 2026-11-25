// Match randomizer: pick 12 rounds (3 per difficulty) from the bank with no
// duplicate ids and with emoji variety within each stage.

import { STAGES } from "./constants.ts";
import { createRng } from "./rng.ts";
import type { RoundDefinition } from "./types.ts";

function pickDistinct(pool: RoundDefinition[], count: number, rng: ReturnType<typeof createRng>): RoundDefinition[] {
  const shuffled = rng.shuffle(pool);
  // Prefer variety of base emoji where possible.
  const seenEmoji = new Set<string>();
  const chosen: RoundDefinition[] = [];
  for (const r of shuffled) {
    if (chosen.length >= count) break;
    if (seenEmoji.has(r.baseEmoji)) continue;
    seenEmoji.add(r.baseEmoji);
    chosen.push(r);
  }
  // Fill any remaining slots with distinct ids (accepting repeated emojis).
  for (const r of shuffled) {
    if (chosen.length >= count) break;
    if (!chosen.some((c) => c.id === r.id)) chosen.push(r);
  }
  return chosen.slice(0, count);
}

/**
 * Select a full 12-round match in stage order (easy â†’ normal â†’ hard â†’ expert).
 * `seed` should be a fresh random seed per match so repeat players get variety.
 */
export function selectMatchRounds(bank: RoundDefinition[], seed: number | string): RoundDefinition[] {
  const rng = createRng(seed);
  const result: RoundDefinition[] = [];
  for (const stage of STAGES) {
    const pool = bank.filter((r) => r.difficulty === stage.difficulty && r.active);
    if (pool.length === 0) {
      throw new Error(`No active rounds for difficulty "${stage.difficulty}" in the bank.`);
    }
    result.push(...pickDistinct(pool, 3, rng));
  }
  return result;
}
