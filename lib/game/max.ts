// M.A.X. â€” Machine Algorithm X.
//
// M.A.X. genuinely solves each round by scanning the grid with a per-mode
// perceptual resolution (see emoji.resolveKey). Its solve *time* is a
// deterministic simulation that scales with grid size, emoji confusability and
// ability mode â€” clearly labeled in the UI as simulated, not a CPU benchmark.

import { DIFFICULTIES, MAX_TIMING } from "./constants.ts";
import { hashString } from "./rng.ts";
import { solveGrid } from "./oddEmoji.ts";
import type { AnswerOutcome, MaxMode, RoundDefinition } from "./types.ts";

/** Deterministic simulated solve time (ms) for a round. */
export function simulateSolveTime(
  difficulty: RoundDefinition["difficulty"],
  gridSize: number,
  mode: MaxMode,
  roundId: string,
): number {
  const t = MAX_TIMING;
  const cells = gridSize * gridSize;
  const raw = (t.baseMs + t.perCellMs * cells + t.similarityMs[difficulty]) * t.modeMultiplier[mode];
  const noise = (hashString(roundId + ":" + mode) % 1000) / 1000; // 0..1 deterministic
  const jitter = 1 + (noise - 0.5) * 2 * t.noiseFraction;
  const timeMs = Math.max(t.minMs, raw * jitter);
  const cap = DIFFICULTIES[difficulty].timeLimitSec * 1000 * t.headroomFraction;
  return Math.round(Math.min(timeMs, cap));
}

export interface MaxSolve {
  cellIndex: number | null;
  method: string;
  timeMs: number;
}

export function maxSolveRound(round: RoundDefinition, mode: MaxMode): MaxSolve {
  const sol = solveGrid(round.cells, mode);
  return {
    cellIndex: sol.cellIndex,
    method: sol.method,
    timeMs: simulateSolveTime(round.difficulty, round.gridSize, mode, round.id),
  };
}

export interface MaxResult {
  index: number;
  outcome: AnswerOutcome;
  timeMs: number;
  method: string;
}

/** Solve all rounds up front (M.A.X. "processes" the whole match). */
export function computeMaxResults(rounds: RoundDefinition[], mode: MaxMode): MaxResult[] {
  return rounds.map((round, index) => {
    const s = maxSolveRound(round, mode);
    let outcome: AnswerOutcome = "blank";
    if (s.cellIndex !== null) {
      outcome = s.cellIndex === round.oddIndex ? "correct" : "wrong";
    }
    return { index, outcome, timeMs: s.timeMs, method: s.method };
  });
}
