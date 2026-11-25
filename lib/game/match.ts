// Pure match runner: the single source of truth for how a match is scored and
// who wins. Used by the demo/tests and mirrored by the server validation layer.

import { DIFFICULTIES } from "./constants.ts";
import { scoreAnswer } from "./scoring.ts";
import { checkRound } from "./oddEmoji.ts";
import { computeMaxResults, type MaxResult } from "./max.ts";
import { round1 } from "./answer.ts";
import type {
  AnswerOutcome,
  MatchSummary,
  MaxMode,
  PlayerAnswerRecord,
  RoundDefinition,
} from "./types.ts";

export interface PlayerInput {
  given: number | null;
  timeMs: number;
}

export interface AnswerEvaluation {
  outcome: AnswerOutcome;
  points: number;
  streakAfter: number;
}

export function evaluateAnswer(
  round: RoundDefinition,
  given: number | null,
  timeMs: number,
  streakBefore: number,
): AnswerEvaluation {
  let outcome: AnswerOutcome;
  if (given === null) outcome = "blank";
  else if (checkRound(round, given)) outcome = "correct";
  else outcome = "wrong";

  const streakAfter = outcome === "correct" ? streakBefore + 1 : 0;
  const points = scoreAnswer({
    basePoints: round.basePoints,
    timeLimitSec: round.timeLimitSec,
    timeUsedMs: Math.max(0, timeMs),
    outcome,
    streakAfter,
  }).total;

  return { outcome, points, streakAfter };
}

export interface MatchRunResult {
  playerScore: number;
  maxScore: number;
  playerRecords: PlayerAnswerRecord[];
  maxRecords: MaxResult[];
  summary: MatchSummary;
}

export function runMatch(
  rounds: RoundDefinition[],
  maxMode: MaxMode,
  playerInputs: Array<PlayerInput | undefined>,
  meta: {
    matchId: string;
    playerName: string;
    avatar: string;
    startedAt: string;
    endedAt: string;
  },
): MatchRunResult {
  const maxResults = computeMaxResults(rounds, maxMode);

  let playerScore = 0;
  let maxScore = 0;
  let streak = 0;
  let bestStreak = 0;
  let correct = 0;
  let wrong = 0;
  let blank = 0;
  let totalMs = 0;
  let answeredCount = 0;
  let hardestSolved: RoundDefinition["difficulty"] | null = null;

  const playerRecords: PlayerAnswerRecord[] = [];
  const maxRecords: MaxResult[] = maxResults.map((r) => ({ ...r }));

  for (let i = 0; i < rounds.length; i++) {
    const round = rounds[i];
    const input = playerInputs[i] ?? {
      given: null,
      timeMs: DIFFICULTIES[round.difficulty].timeLimitSec * 1000,
    };
    const ev = evaluateAnswer(round, input.given, input.timeMs, streak);
    streak = ev.streakAfter;
    bestStreak = Math.max(bestStreak, streak);
    if (ev.outcome === "correct") {
      correct++;
      if (
        hardestSolved === null ||
        DIFFICULTIES[round.difficulty].stage > DIFFICULTIES[hardestSolved].stage
      ) {
        hardestSolved = round.difficulty;
      }
    } else if (ev.outcome === "wrong") wrong++;
    else blank++;

    if (input.given !== null) {
      totalMs += input.timeMs;
      answeredCount++;
    }

    playerScore += ev.points;
    playerRecords.push({
      index: i,
      roundId: round.id,
      given: input.given,
      outcome: ev.outcome,
      points: ev.points,
      timeMs: input.timeMs,
      streakAfter: streak,
      answeredAt: meta.endedAt,
    });
  }

  let maxStreak = 0;
  let mRun = 0;
  for (const r of maxResults) {
    const round = rounds[r.index];
    mRun = r.outcome === "correct" ? mRun + 1 : 0;
    maxStreak = Math.max(maxStreak, mRun);
    const points = scoreAnswer({
      basePoints: round.basePoints,
      timeLimitSec: round.timeLimitSec,
      timeUsedMs: r.timeMs,
      outcome: r.outcome,
      streakAfter: mRun,
    }).total;
    maxScore += points;
  }

  const winner: MatchSummary["winner"] =
    playerScore > maxScore ? "human" : playerScore < maxScore ? "machine" : "draw";
  const accuracy = rounds.length > 0 ? round1((correct / rounds.length) * 100) : 0;
  const avgAnswerMs = answeredCount > 0 ? Math.round(totalMs / answeredCount) : 0;

  const summary: MatchSummary = {
    matchId: meta.matchId,
    playerName: meta.playerName,
    avatar: meta.avatar,
    playerScore,
    maxScore,
    winner,
    correctCount: correct,
    wrongCount: wrong,
    blankCount: blank,
    accuracy,
    avgAnswerMs,
    bestStreak,
    hardestSolved,
    maxMode,
    startedAt: meta.startedAt,
    endedAt: meta.endedAt,
    breakdown: rounds.map((round, i) => {
      const rec = playerRecords[i];
      return {
        index: i,
        difficulty: round.difficulty,
        gridSize: round.gridSize,
        cells: round.cells,
        oddEmoji: round.oddEmoji,
        oddIndex: round.oddIndex,
        playerAnswer: rec.given,
        outcome: rec.outcome,
        points: rec.points,
        timeMs: rec.timeMs,
        explanation: round.explanation,
      };
    }),
  };

  return { playerScore, maxScore, playerRecords, maxRecords, summary };
}
