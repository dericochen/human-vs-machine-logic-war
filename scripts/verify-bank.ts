// Verifies the generated round bank: every round has exactly one odd cell with
// a correct, solver-recoverable answer, ids are unique, and M.A.X.'s per-mode
// ability maps to the intended difficulty tiers.
//
// Run:  node scripts/verify-bank.ts

import { generateBank } from "../lib/game/bank.ts";
import { solveGrid } from "../lib/game/oddEmoji.ts";
import type { Difficulty, MaxMode } from "../lib/game/types.ts";

const bank = generateBank();

let failures = 0;
let checks = 0;
function check(cond: boolean, msg: string): void {
  checks++;
  if (!cond) {
    failures++;
    console.log("  FAIL: " + msg);
  }
}

console.log(`Bank size: ${bank.length} rounds`);

// 1. Per-difficulty counts.
const byDiff = new Map<Difficulty, number>();
for (const r of bank) byDiff.set(r.difficulty, (byDiff.get(r.difficulty) ?? 0) + 1);
for (const d of ["easy", "normal", "hard", "expert"] as Difficulty[]) {
  const n = byDiff.get(d) ?? 0;
  check(n >= 25, `difficulty ${d} has >= 25 rounds (found ${n})`);
}

// 2. Unique ids.
const ids = new Set(bank.map((r) => r.id));
check(ids.size === bank.length, `all ids unique (${ids.size}/${bank.length})`);

// 3. Structural validity + expert solver always recovers the odd cell.
for (const r of bank) {
  const nonBase = r.cells.filter((c) => c !== r.baseEmoji);
  check(nonBase.length === 1, `${r.id}: exactly one non-base cell (found ${nonBase.length})`);
  check(r.cells[r.oddIndex] === r.oddEmoji, `${r.id}: oddIndex points at the odd emoji`);
  check(r.cells.length === r.gridSize * r.gridSize, `${r.id}: cell count matches grid size`);

  const sol = solveGrid(r.cells, "expert");
  check(sol.cellIndex === r.oddIndex, `${r.id}: expert solver recovers oddIndex (${r.oddIndex})`);
}

// 4. Mode ↔ difficulty alignment.
const MODE_ABOVE: Record<Difficulty, MaxMode> = {
  easy: "easy",
  normal: "normal",
  hard: "hard",
  expert: "expert",
};
const MODE_BELOW: Record<Difficulty, MaxMode | null> = {
  easy: null,
  normal: "easy",
  hard: "normal",
  expert: "hard",
};

let wrongMode = 0;
for (const r of bank) {
  const solvableMode = MODE_ABOVE[r.difficulty];
  const sol = solveGrid(r.cells, solvableMode);
  if (sol.cellIndex !== r.oddIndex) {
    wrongMode++;
    check(false, `${r.id}: ${solvableMode} mode should solve but did not`);
  }
  const below = MODE_BELOW[r.difficulty];
  if (below) {
    const belowSol = solveGrid(r.cells, below);
    if (belowSol.cellIndex === r.oddIndex) {
      wrongMode++;
      check(false, `${r.id}: ${below} mode should NOT solve (${r.difficulty}) but did`);
    }
  }
}
if (wrongMode === 0) {
  console.log("  OK: mode↔difficulty alignment holds for all rounds");
}

console.log("---");
console.log(`${failures === 0 ? "PASS" : "FAIL"}: ${checks} checks, ${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
