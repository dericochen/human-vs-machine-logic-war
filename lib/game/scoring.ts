import { SCORING } from "./constants.ts";
import type { AnswerOutcome, ScoreBreakdown } from "./types.ts";

/**
 * Server-side scoring. Deterministic and documented:
 *
 *   correct: base + speedBonus + streakBonus
 *   wrong:   -WRONG_PENALTY
 *   blank:   0
 *
 * speedBonus  = base * 0.35 * (1 - timeUsed/timeLimit)   (correct only)
 * streakBonus = min(streakSteps, cap) * step              (correct only)
 *
 * `streak` is the consecutive-correct count INCLUDING the current answer,
 * so the first correct answer in a run contributes 0 streak bonus.
 */
export interface ScoreInput {
  basePoints: number;
  timeLimitSec: number;
  timeUsedMs: number;
  outcome: AnswerOutcome;
  streakAfter: number; // consecutive correct after this answer
}

export function scoreAnswer(input: ScoreInput): { total: number; breakdown: ScoreBreakdown } {
  if (input.outcome === "blank") {
    return {
      total: 0,
      breakdown: { base: 0, speedBonus: 0, streakBonus: 0, penalty: 0, total: 0 },
    };
  }

  if (input.outcome === "wrong") {
    const penalty = -SCORING.wrongPenalty;
    return {
      total: penalty,
      breakdown: { base: 0, speedBonus: 0, streakBonus: 0, penalty, total: penalty },
    };
  }

  // correct
  const timeUsedSec = Math.max(0, input.timeUsedMs / 1000);
  const timeLimitSec = Math.max(0.001, input.timeLimitSec);
  const timeFrac = Math.min(1, Math.max(0, timeUsedSec / timeLimitSec));
  const speedBonus = Math.round(input.basePoints * SCORING.speedBonusFraction * (1 - timeFrac));
  const streakSteps = Math.min(Math.max(input.streakAfter - 1, 0), SCORING.streakCap);
  const streakBonus = streakSteps * SCORING.streakStepPoints;
  const total = input.basePoints + speedBonus + streakBonus;

  return {
    total,
    breakdown: {
      base: input.basePoints,
      speedBonus,
      streakBonus,
      penalty: 0,
      total,
    },
  };
}

/** Score a single answer the same way the server will, given the full record. */
export function scoreAnswerFromRecord(params: {
  basePoints: number;
  timeLimitSec: number;
  timeUsedMs: number;
  outcome: AnswerOutcome;
  streakAfter: number;
}): number {
  return scoreAnswer({
    basePoints: params.basePoints,
    timeLimitSec: params.timeLimitSec,
    timeUsedMs: params.timeUsedMs,
    outcome: params.outcome,
    streakAfter: params.streakAfter,
  }).total;
}
