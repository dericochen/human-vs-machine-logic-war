// The single game engine: "find the different emoji".
//
// `generateRound` builds an nÃ—n grid where every cell is the base emoji except
// one odd cell. `solveGrid` is M.A.X.'s solver: it scans the grid at a
// per-mode perceptual resolution and returns the odd cell (or null if its
// resolution cannot distinguish base from odd).

import { DIFFICULTIES } from "./constants.ts";
import { stableId, type Rng } from "./rng.ts";
import { generatePair, resolveKey } from "./emoji.ts";
import type { Difficulty, GridSolveResult, MaxMode, RoundDefinition } from "./types.ts";

export function buildCells(base: string, odd: string, gridSize: number, oddIndex: number): string[] {
  const cells = new Array<string>(gridSize * gridSize).fill(base);
  cells[oddIndex] = odd;
  return cells;
}

export function generateRound(difficulty: Difficulty, rng: Rng): RoundDefinition {
  const meta = DIFFICULTIES[difficulty];
  const n = meta.gridSize;
  const pair = generatePair(difficulty, rng);
  const oddIndex = rng.int(0, n * n);
  const cells = buildCells(pair.base, pair.odd, n, oddIndex);

  const row = Math.floor(oddIndex / n) + 1;
  const col = (oddIndex % n) + 1;
  const explanation = `Every cell shows ${pair.base} except one ${pair.odd} in row ${row}, column ${col}.`;

  return {
    id: stableId(["odd", difficulty, cells.join("\u0000")]),
    difficulty,
    gridSize: n,
    cells,
    baseEmoji: pair.base,
    oddEmoji: pair.odd,
    oddIndex,
    explanation,
    timeLimitSec: meta.timeLimitSec,
    basePoints: meta.basePoints,
    params: { base: pair.base, odd: pair.odd, tier: pair.tier, gridSize: n },
    source: "generated",
    active: true,
  };
}

/** M.A.X.'s solver: find the odd cell at the given ability mode's resolution. */
export function solveGrid(cells: string[], mode: MaxMode): GridSolveResult {
  if (cells.length === 0) return { cellIndex: null, method: "grid:empty" };
  const counts = new Map<string, number>();
  for (const c of cells) {
    const k = resolveKey(c, mode);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let modeKey = "";
  let best = -1;
  for (const [k, c] of counts) {
    if (c > best) {
      best = c;
      modeKey = k;
    }
  }
  const odd: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (resolveKey(cells[i], mode) !== modeKey) odd.push(i);
  }
  if (odd.length === 1) return { cellIndex: odd[0], method: `grid:${mode}` };
  return { cellIndex: null, method: "grid:unresolved" };
}

/** Validate a player's tapped cell against the round's true odd cell. */
export function checkRound(round: RoundDefinition, givenIndex: number | null): boolean {
  return givenIndex !== null && givenIndex === round.oddIndex;
}
