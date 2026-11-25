import type { Difficulty, DifficultyMeta, MaxMode } from "./types.ts";

export const MATCH_DURATION_SEC = 300; // 5 minutes, authoritative upper bound
export const MATCH_ROUND_COUNT = 12;

// 12 rounds across 4 stages (3 rounds each). Stage maps to difficulty + grid size.
export const STAGES: Array<{ difficulty: Difficulty; from: number; to: number }> = [
  { difficulty: "easy", from: 0, to: 2 },
  { difficulty: "normal", from: 3, to: 5 },
  { difficulty: "hard", from: 6, to: 8 },
  { difficulty: "expert", from: 9, to: 11 },
];

export const DIFFICULTIES: Record<Difficulty, DifficultyMeta> = {
  easy: { id: "easy", label: "EASY", gridSize: 2, timeLimitSec: 20, basePoints: 100, stage: 1 },
  normal: { id: "normal", label: "NORMAL", gridSize: 3, timeLimitSec: 25, basePoints: 150, stage: 2 },
  hard: { id: "hard", label: "HARD", gridSize: 4, timeLimitSec: 30, basePoints: 220, stage: 3 },
  expert: { id: "expert", label: "EXPERT", gridSize: 5, timeLimitSec: 35, basePoints: 300, stage: 4 },
};

export const DIFFICULTY_ORDER: Difficulty[] = ["easy", "normal", "hard", "expert"];

export function difficultyForIndex(index: number): Difficulty {
  for (const s of STAGES) {
    if (index >= s.from && index <= s.to) return s.difficulty;
  }
  return "easy";
}

// ---- Scoring (documented, server-enforced) ----
// total = base + speedBonus + streakBonus  (correct)
//       = -WRONG_PENALTY                    (wrong)
//       = 0                                 (blank)
export const SCORING = {
  speedBonusFraction: 0.35, // up to 35% of base for answering instantly
  streakStepPoints: 20, // per consecutive correct beyond the first
  streakCap: 5, // max streak steps counted for the bonus
  wrongPenalty: 15,
};

// ---- M.A.X. simulated solve-time model ----
// M.A.X. genuinely scans the grid (string comparison at a per-mode perceptual
// resolution). The *time* shown is a deterministic simulation â€” not a CPU
// benchmark â€” that scales with grid size, emoji confusability, and ability mode.
// It is clearly labeled as simulated in the UI.
export const MAX_TIMING = {
  baseMs: 6500,
  perCellMs: 450,
  similarityMs: { easy: 0, normal: 300, hard: 700, expert: 1200 } as Record<Difficulty, number>,
  modeMultiplier: { easy: 1.5, normal: 1.15, hard: 0.85, expert: 0.62 } as Record<MaxMode, number>,
  minMs: 600,
  headroomFraction: 0.9,
  noiseFraction: 0.15,
};

export const MAX_MODES: MaxMode[] = ["easy", "normal", "hard", "expert"];

export const MAX_MODE_LABEL: Record<MaxMode, string> = {
  easy: "EASY",
  normal: "NORMAL",
  hard: "HARD",
  expert: "EXPERT",
};

export const MAX_MODE_DESC: Record<MaxMode, string> = {
  easy: "M.A.X. uses a naive scanner â€” slow and easily confused.",
  normal: "M.A.X. uses a standard scanner.",
  hard: "M.A.X. uses an efficient scanner.",
  expert: "M.A.X. uses its optimal scanner â€” fast and near-perfect.",
};

export const LEADERBOARD_WINDOWS = ["all", "today", "week"] as const;
export type LeaderboardWindow = (typeof LEADERBOARD_WINDOWS)[number];
