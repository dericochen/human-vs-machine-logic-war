// Emoji library for the "find the different emoji" game.
//
// Every emoji is tagged with a coarse category and a fine group. These tags drive
// both difficulty (how confusable the odd emoji is) and M.A.X.'s "perceptual
// resolution" per ability mode: a weaker mode compares only coarse tags and so
// genuinely cannot tell apart similar emojis.
//
// Emojis are written as ASCII \u{...} escapes (not literal glyphs) so the source
// is byte-safe across encodings; JavaScript resolves them to the real glyphs.

import type { Difficulty, MaxMode } from "./types.ts";
import type { Rng } from "./rng.ts";

export interface EmojiMeta {
  coarse: string;
  fine: string;
}

// coarse -> fine -> glyphs
const RAW: Record<string, Record<string, string[]>> = {
  face: {
    grin: ["\u{1F600}", "\u{1F603}", "\u{1F604}", "\u{1F601}"],
    smile: ["\u{1F642}", "\u{1F60A}", "\u{1F609}"],
    laugh: ["\u{1F602}", "\u{1F923}", "\u{1F606}"],
    cool: ["\u{1F60E}", "\u{1F60F}", "\u{1F913}"],
    sad: ["\u{1F622}", "\u{1F62D}", "\u{1F625}"],
    love: ["\u{1F60D}", "\u{1F970}", "\u{1F618}"],
    surprise: ["\u{1F62E}", "\u{1F632}", "\u{1F62F}"],
    angry: ["\u{1F621}", "\u{1F92C}", "\u{1F620}"],
  },
  fruit: {
    apple: ["\u{1F34E}", "\u{1F34F}"],
    citrus: ["\u{1F34A}", "\u{1F34B}"],
    berry: ["\u{1F353}", "\u{1FAD0}", "\u{1F347}"],
    tropical: ["\u{1F34C}", "\u{1F34D}", "\u{1F96D}", "\u{1F95D}"],
    stone: ["\u{1F351}", "\u{1F352}"],
  },
  animal: {
    dog: ["\u{1F436}", "\u{1F415}"],
    cat: ["\u{1F431}", "\u{1F408}"],
    bear: ["\u{1F43B}", "\u{1F43C}", "\u{1F428}"],
    bird: ["\u{1F426}", "\u{1F985}", "\u{1F989}", "\u{1F424}"],
    farm: ["\u{1F42E}", "\u{1F437}", "\u{1F414}"],
    small: ["\u{1F98A}", "\u{1F430}", "\u{1F439}"],
  },
  food: {
    fastfood: ["\u{1F354}", "\u{1F35F}", "\u{1F32D}"],
    dessert: ["\u{1F369}", "\u{1F36A}", "\u{1F382}", "\u{1F9C1}"],
    veg: ["\u{1F955}", "\u{1F966}", "\u{1F33D}"],
  },
  nature: {
    flower: ["\u{1F338}", "\u{1F33A}", "\u{1F33B}"],
    tree: ["\u{1F332}", "\u{1F333}", "\u{1F334}"],
    weather: ["\u{26A1}\u{FE0F}", "\u{2744}\u{FE0F}", "\u{1F308}"],
    celestial: ["\u{2B50}", "\u{1F31F}", "\u{1F319}", "\u{1F31B}", "\u{2600}\u{FE0F}", "\u{1F31E}"],
  },
  object: {
    vehicle: ["\u{1F697}", "\u{1F695}", "\u{1F699}"],
    transport: ["\u{1F68C}", "\u{1F69B}", "\u{1F691}"],
    tech: ["\u{1F4F1}", "\u{1F4BB}", "\u{1F4FA}", "\u{231A}"],
    sport: ["\u{26BD}", "\u{1F3C0}", "\u{1F3BE}", "\u{1F3AF}"],
  },
  shape: {
    circle: ["\u{1F534}", "\u{1F7E0}", "\u{1F7E1}", "\u{1F7E2}", "\u{1F535}", "\u{1F7E3}", "\u{26AB}", "\u{26AA}"],
    square: ["\u{1F7E5}", "\u{1F7E7}", "\u{1F7E8}", "\u{1F7E9}", "\u{1F7E6}", "\u{1F7EA}", "\u{2B1B}", "\u{2B1C}"],
    heart: ["\u{2764}\u{FE0F}", "\u{1F9E1}", "\u{1F49B}", "\u{1F49A}", "\u{1F499}", "\u{1F49C}"],
  },
};

export const EMOJI_META: Record<string, EmojiMeta> = {};
for (const [coarse, fines] of Object.entries(RAW)) {
  for (const [fine, glyphs] of Object.entries(fines)) {
    for (const g of glyphs) EMOJI_META[g] = { coarse, fine };
  }
}

// Pairs that are near-identical — only M.A.X.'s exact (expert) comparator can
// reliably distinguish them; the hard comparator treats each pair as one glyph.
export const ULTRA_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["\u{1F600}", "\u{1F603}"],
  ["\u{1F604}", "\u{1F601}"],
  ["\u{1F642}", "\u{1F60A}"],
  ["\u{1F34E}", "\u{1F34F}"],
  ["\u{1F436}", "\u{1F415}"],
  ["\u{1F431}", "\u{1F408}"],
  ["\u{2B50}", "\u{1F31F}"],
  ["\u{1F319}", "\u{1F31B}"],
  ["\u{2600}\u{FE0F}", "\u{1F31E}"],
  ["\u{1F621}", "\u{1F92C}"],
  ["\u{1F62E}", "\u{1F62F}"],
  ["\u{1F970}", "\u{1F60D}"],
  ["\u{1F426}", "\u{1F424}"],
  ["\u{1F34A}", "\u{1F34B}"],
];

// Visually-similar pairs used for NON-easy rounds: same emoji type, subtle
// difference — never a different picture. Grid size is the difficulty ramp.
export const TRICKY_PAIRS: ReadonlyArray<readonly [string, string]> = [
  // faces — same expression, subtle variants
  ["\u{1F600}", "\u{1F603}"], ["\u{1F600}", "\u{1F604}"], ["\u{1F600}", "\u{1F601}"],
  ["\u{1F603}", "\u{1F604}"], ["\u{1F603}", "\u{1F601}"], ["\u{1F604}", "\u{1F601}"],
  ["\u{1F642}", "\u{1F60A}"], ["\u{1F642}", "\u{1F609}"], ["\u{1F60A}", "\u{1F609}"],
  ["\u{1F602}", "\u{1F923}"], ["\u{1F602}", "\u{1F606}"], ["\u{1F923}", "\u{1F606}"],
  ["\u{1F60E}", "\u{1F60F}"], ["\u{1F60E}", "\u{1F913}"],
  ["\u{1F622}", "\u{1F625}"], ["\u{1F622}", "\u{1F62D}"], ["\u{1F625}", "\u{1F62D}"],
  ["\u{1F60D}", "\u{1F970}"], ["\u{1F60D}", "\u{1F618}"], ["\u{1F970}", "\u{1F618}"],
  ["\u{1F62E}", "\u{1F62F}"], ["\u{1F62E}", "\u{1F632}"], ["\u{1F62F}", "\u{1F632}"],
  ["\u{1F621}", "\u{1F92C}"], ["\u{1F621}", "\u{1F620}"], ["\u{1F92C}", "\u{1F620}"],
  // fruit — same fruit, colour variant
  ["\u{1F34E}", "\u{1F34F}"], ["\u{1F34A}", "\u{1F34B}"],
  // animals — same animal
  ["\u{1F436}", "\u{1F415}"], ["\u{1F431}", "\u{1F408}"],
  // nature — same type
  ["\u{2B50}", "\u{1F31F}"], ["\u{1F319}", "\u{1F31B}"], ["\u{2600}\u{FE0F}", "\u{1F31E}"],
  // shapes — same shape, colour variants
  ["\u{1F534}", "\u{1F7E0}"], ["\u{1F7E0}", "\u{1F7E1}"], ["\u{1F7E1}", "\u{1F7E2}"],
  ["\u{1F7E2}", "\u{1F535}"], ["\u{1F535}", "\u{1F7E3}"], ["\u{1F534}", "\u{1F535}"], ["\u{1F7E3}", "\u{1F534}"],
  ["\u{1F7E5}", "\u{1F7E7}"], ["\u{1F7E7}", "\u{1F7E8}"], ["\u{1F7E8}", "\u{1F7E9}"],
  ["\u{1F7E9}", "\u{1F7E6}"], ["\u{1F7E6}", "\u{1F7EA}"], ["\u{1F7E5}", "\u{1F7E9}"], ["\u{1F7EA}", "\u{1F7E5}"],
  ["\u{2764}\u{FE0F}", "\u{1F9E1}"], ["\u{2764}\u{FE0F}", "\u{1F49B}"], ["\u{1F9E1}", "\u{1F49B}"],
  ["\u{1F49B}", "\u{1F49A}"], ["\u{1F49A}", "\u{1F499}"], ["\u{1F499}", "\u{1F49C}"], ["\u{2764}\u{FE0F}", "\u{1F499}"],
];

const ULTRA_GROUP = new Map<string, number>();
ULTRA_PAIRS.forEach((pair, i) => {
  ULTRA_GROUP.set(pair[0], i);
  ULTRA_GROUP.set(pair[1], i);
});

const BY_COARSE = new Map<string, string[]>();
for (const [coarse, fines] of Object.entries(RAW)) {
  const all: string[] = [];
  for (const glyphs of Object.values(fines)) all.push(...glyphs);
  BY_COARSE.set(coarse, all);
}

export function allEmojis(): string[] {
  return Object.keys(EMOJI_META);
}

/**
 * Perceptual resolution key for an emoji under a given M.A.X. ability mode.
 * Lower modes collapse visually similar emojis, so a "naive" M.A.X. literally
 * cannot distinguish them.
 */
export function resolveKey(emoji: string, mode: MaxMode): string {
  const meta = EMOJI_META[emoji];
  if (!meta) return "unknown|" + emoji;
  switch (mode) {
    case "easy":
      return meta.coarse;
    case "normal":
      return `${meta.coarse}|${meta.fine}`;
    case "hard": {
      const u = ULTRA_GROUP.get(emoji);
      const glyph = u === undefined ? emoji : `ultra:${u}`;
      return `${meta.coarse}|${meta.fine}|${glyph}`;
    }
    case "expert":
      return `${meta.coarse}|${meta.fine}|${emoji}`;
  }
}

export interface EmojiPair {
  base: string;
  odd: string;
  tier: Difficulty;
}

/**
 * Pick a (base, odd) pair for a round.
 *  - easy: a genuinely different emoji (different category / picture).
 *  - normal/hard/expert: a visually-similar pair only — same emoji type, subtle
 *    difference (never a different picture). Grid size is the difficulty ramp;
 *    hard/expert draw from the closest "ultra" pairs.
 */
export function generatePair(difficulty: Difficulty, rng: Rng): EmojiPair {
  if (difficulty === "easy") {
    const coarses = Array.from(BY_COARSE.keys());
    const a = rng.pick(coarses);
    let b = rng.pick(coarses);
    while (b === a) b = rng.pick(coarses);
    return { base: rng.pick(BY_COARSE.get(a)!), odd: rng.pick(BY_COARSE.get(b)!), tier: "easy" };
  }
  const pool = difficulty === "normal" ? TRICKY_PAIRS : ULTRA_PAIRS;
  const pair = rng.pick(pool);
  return rng.chance(0.5)
    ? { base: pair[0], odd: pair[1], tier: difficulty }
    : { base: pair[1], odd: pair[0], tier: difficulty };
}
