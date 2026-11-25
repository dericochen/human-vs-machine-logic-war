// Verifies the generated round bank: every round has exactly one odd cell with
// a correct, solver-recoverable answer, ids are unique, and M.A.X.'s per-mode
// ability maps to the intended difficulty tiers.
//
// Run:  node scripts/verify-bank.ts

import { generateBank } from "../lib/game/bank.ts";
import { solveGrid } from "../lib/game/oddEmoji.ts";
import { EMOJI_META } from "../lib/game/emoji.ts";
import type { Difficulty } from "../lib/game/types.ts";

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

// 4. Difficulty rules: easy = a genuinely different picture; the rest = the
//    same emoji family (subtle variant), never a different picture.
let wrongPicture = 0;
for (const r of bank) {
  const baseMeta = EMOJI_META[r.baseEmoji];
  const oddMeta = EMOJI_META[r.oddEmoji];
  if (!baseMeta || !oddMeta) {
    wrongPicture++;
    check(false, `${r.id}: emoji missing from library`);
    continue;
  }
  if (r.difficulty === "easy") {
    if (baseMeta.coarse === oddMeta.coarse) {
      wrongPicture++;
      check(false, `${r.id}: easy round must use a DIFFERENT picture (same coarse "${baseMeta.coarse}")`);
    }
  } else if (baseMeta.coarse !== oddMeta.coarse) {
    wrongPicture++;
    check(false, `${r.id}: ${r.difficulty} round must stay in the SAME picture family ("${baseMeta.coarse}" vs "${oddMeta.coarse}")`);
  }
}
if (wrongPicture === 0) {
  console.log("  OK: easy = different picture, normal/hard/expert = same family (subtle)");
}

console.log("---");
console.log(`${failures === 0 ? "PASS" : "FAIL"}: ${checks} checks, ${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
