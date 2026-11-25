// Server-side match lifecycle: start, answer, finish, recover. All validation,
// timing and scoring happen here (never trusted from the client). Uses Supabase
// when configured, otherwise an in-memory store so the game runs out of the box.

import {
  computeConfidence,
  computeMaxResults,
  evaluateAnswer,
  getFallbackBank,
  randomSeed,
  selectMatchRounds,
  scoreAnswer,
} from "@/lib/game";
import type {
  AnswerOutcome,
  MatchSummary,
  MaxMode,
  PublicRound,
  RoundDefinition,
} from "@/lib/game";
import { getServiceClient, isSupabaseConfigured } from "./client";
import { memoryStore, type MatchRow, type ResultRow } from "./memory";

const MATCH_ROUNDS = 12;

function nowIso(): string {
  return new Date().toISOString();
}
function nowMs(): number {
  return Date.now();
}
function uuid(): string {
  return crypto.randomUUID();
}

function toPublicRound(round: RoundDefinition, index: number): PublicRound {
  return {
    id: round.id,
    difficulty: round.difficulty,
    gridSize: round.gridSize,
    cells: round.cells,
    timeLimitSec: round.timeLimitSec,
    basePoints: round.basePoints,
    index,
  };
}

function dbRowToRound(row: Record<string, unknown>): RoundDefinition {
  return {
    id: row.id as string,
    difficulty: row.difficulty as RoundDefinition["difficulty"],
    gridSize: row.grid_size as number,
    cells: row.cells as string[],
    baseEmoji: row.base_emoji as string,
    oddEmoji: row.odd_emoji as string,
    oddIndex: row.odd_index as number,
    explanation: row.explanation as string,
    timeLimitSec: row.time_limit_sec as number,
    basePoints: row.base_points as number,
    params: (row.params ?? {}) as Record<string, unknown>,
    source: (row.source as RoundDefinition["source"]) ?? "seeded",
    active: (row.active as boolean) ?? true,
  };
}

function buildMaxResults(rounds: RoundDefinition[], maxMode: MaxMode) {
  const results = computeMaxResults(rounds, maxMode);
  let streak = 0;
  return results.map((r) => {
    const round = rounds[r.index];
    streak = r.outcome === "correct" ? streak + 1 : 0;
    const points = scoreAnswer({
      basePoints: round.basePoints,
      timeLimitSec: round.timeLimitSec,
      timeUsedMs: r.timeMs,
      outcome: r.outcome,
      streakAfter: streak,
    }).total;
    return { ...r, points };
  });
}

function buildSummary(input: {
  matchId: string;
  playerName: string;
  avatar: string;
  maxMode: MaxMode;
  startedAt: string;
  endedAt: string;
  rounds: RoundDefinition[];
  playerAnswers: Array<{ given: number | null; outcome: AnswerOutcome; points: number; timeMs: number }>;
  maxScore: number;
  playerScore: number;
}): MatchSummary {
  const { rounds, playerAnswers } = input;
  let correct = 0;
  let wrong = 0;
  let blank = 0;
  let bestStreak = 0;
  let streak = 0;
  let totalMs = 0;
  let answered = 0;
  let hardest: RoundDefinition["difficulty"] | null = null;

  for (let i = 0; i < rounds.length; i++) {
    const a = playerAnswers[i] ?? { given: null, outcome: "blank" as AnswerOutcome, points: 0, timeMs: rounds[i].timeLimitSec * 1000 };
    streak = a.outcome === "correct" ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
    if (a.outcome === "correct") {
      correct++;
      hardest = rounds[i].difficulty;
    } else if (a.outcome === "wrong") wrong++;
    else blank++;
    if (a.given !== null) {
      totalMs += a.timeMs;
      answered++;
    }
  }

  const winner: MatchSummary["winner"] =
    input.playerScore > input.maxScore ? "human" : input.playerScore < input.maxScore ? "machine" : "draw";
  const accuracy = rounds.length ? Math.round((correct / rounds.length) * 1000) / 10 : 0;

  return {
    matchId: input.matchId,
    playerName: input.playerName,
    avatar: input.avatar,
    playerScore: input.playerScore,
    maxScore: input.maxScore,
    winner,
    correctCount: correct,
    wrongCount: wrong,
    blankCount: blank,
    accuracy,
    avgAnswerMs: answered ? Math.round(totalMs / answered) : 0,
    bestStreak,
    hardestSolved: hardest,
    maxMode: input.maxMode,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    breakdown: rounds.map((round, i) => {
      const a = playerAnswers[i] ?? { given: null, outcome: "blank" as AnswerOutcome, points: 0, timeMs: round.timeLimitSec * 1000 };
      return {
        index: i,
        difficulty: round.difficulty,
        gridSize: round.gridSize,
        cells: round.cells,
        oddEmoji: round.oddEmoji,
        oddIndex: round.oddIndex,
        playerAnswer: a.given,
        outcome: a.outcome,
        points: a.points,
        timeMs: a.timeMs,
        explanation: round.explanation,
      };
    }),
  };
}

export interface StartMatchInput {
  playerId: string;
  playerName: string;
  avatar: string;
}

export interface StartMatchResponse {
  sessionId: string;
  startedAt: string;
  maxMode: MaxMode;
  rounds: PublicRound[];
}

export interface AnswerResponse {
  outcome: AnswerOutcome;
  points: number;
  playerScore: number;
  maxScore: number;
  maxConfidence: number;
  /** Correct cell, revealed only after the player has submitted this answer. */
  oddIndex: number;
  maxResult: { outcome: AnswerOutcome; timeMs: number; method: string; points: number } | null;
  nextIndex: number;
  finished: boolean;
}

export interface FinishResponse {
  summary: MatchSummary;
  rank: number | null;
}

async function loadBank(): Promise<RoundDefinition[]> {
  if (!isSupabaseConfigured()) return getFallbackBank();
  const { data, error } = await getServiceClient()
    .from("question_bank")
    .select("*")
    .eq("active", true);
  if (error) throw new Error("Failed to load question bank: " + error.message);
  return (data ?? []).map(dbRowToRound);
}

export async function startMatch(input: StartMatchInput): Promise<StartMatchResponse> {
  const bank = await loadBank();
  const rounds = selectMatchRounds(bank, randomSeed());
  // M.A.X. always plays at maximum ability (exact solver + fastest simulated timing).
  const maxResults = buildMaxResults(rounds, "expert");
  const sessionId = uuid();
  const startedAt = nowIso();

  if (isSupabaseConfigured()) {
    const db = getServiceClient();
    await db.from("players").upsert(
      { id: input.playerId, name: input.playerName, avatar: input.avatar },
      { onConflict: "id" },
    );
    const { data: match, error: matchErr } = await db
      .from("matches")
      .insert({
        id: uuid(),
        session_id: sessionId,
        player_id: input.playerId,
        player_name: input.playerName,
        avatar: input.avatar,
        max_mode: "expert",
        status: "active",
        started_at: startedAt,
        current_index: 0,
        player_score: 0,
        max_score: 0,
        max_confidence: 50,
        player_answers: [],
        max_results: maxResults,
      })
      .select("id")
      .single();
    if (matchErr || !match) throw new Error("Failed to create match: " + (matchErr?.message ?? "unknown"));

    const rows = rounds.map((r, i) => ({
      match_id: match.id,
      question_id: r.id,
      index: i,
      difficulty: r.difficulty,
      grid_size: r.gridSize,
      time_limit_sec: r.timeLimitSec,
    }));
    const { error: qErr } = await db.from("match_questions").insert(rows);
    if (qErr) throw new Error("Failed to store match questions: " + qErr.message);
  } else {
    memoryStore.upsertPlayer(input.playerId, input.playerName, input.avatar);
    memoryStore.putMatch({
      id: uuid(),
      session_id: sessionId,
      player_id: input.playerId,
      player_name: input.playerName,
      avatar: input.avatar,
      max_mode: "expert",
      status: "active",
      started_at: startedAt,
      ended_at: null,
      current_index: 0,
      player_score: 0,
      max_score: 0,
      max_confidence: 50,
      player_answers: [],
      max_results: maxResults,
      rounds,
      question_started_at: startedAt,
    });
  }

  return {
    sessionId,
    startedAt,
    maxMode: "expert",
    rounds: rounds.map(toPublicRound),
  };
}

interface LoadedMatch {
  matchId: string;
  playerId: string;
  playerName: string;
  avatar: string;
  maxMode: MaxMode;
  status: string;
  startedAt: string;
  endedAt: string | null;
  currentIndex: number;
  playerScore: number;
  maxScore: number;
  maxConfidence: number;
  playerAnswers: Array<{ given: number | null; outcome: AnswerOutcome; points: number; timeMs: number }>;
  maxResults: Array<{ index: number; outcome: AnswerOutcome; timeMs: number; method: string; points: number }>;
  rounds: RoundDefinition[];
}

async function loadMatch(sessionId: string): Promise<LoadedMatch | null> {
  if (isSupabaseConfigured()) {
    const db = getServiceClient();
    const { data: match, error } = await db.from("matches").select("*").eq("session_id", sessionId).single();
    if (error || !match) return null;
    const { data: qrows, error: qErr } = await db
      .from("match_questions")
      .select("question_id")
      .eq("match_id", match.id)
      .order("index");
    if (qErr || !qrows) throw new Error("Failed to load match questions");
    const { data: bankRows, error: bErr } = await db
      .from("question_bank")
      .select("*")
      .in("id", qrows.map((q) => q.question_id));
    if (bErr || !bankRows) throw new Error("Failed to load rounds");
    const byId = new Map(bankRows.map((r) => [r.id, dbRowToRound(r)]));
    const rounds = qrows.map((q) => byId.get(q.question_id)!);

    return {
      matchId: match.id,
      playerId: match.player_id,
      playerName: match.player_name,
      avatar: match.avatar,
      maxMode: match.max_mode,
      status: match.status,
      startedAt: match.started_at,
      endedAt: match.ended_at,
      currentIndex: match.current_index,
      playerScore: match.player_score,
      maxScore: match.max_score,
      maxConfidence: match.max_confidence,
      playerAnswers: match.player_answers as LoadedMatch["playerAnswers"],
      maxResults: match.max_results as LoadedMatch["maxResults"],
      rounds,
    };
  }

  const m = memoryStore.getMatchBySession(sessionId);
  if (!m) return null;
  return {
    matchId: m.id,
    playerId: m.player_id,
    playerName: m.player_name,
    avatar: m.avatar,
    maxMode: m.max_mode as MaxMode,
    status: m.status,
    startedAt: m.started_at,
    endedAt: m.ended_at,
    currentIndex: m.current_index,
    playerScore: m.player_score,
    maxScore: m.max_score,
    maxConfidence: m.max_confidence,
    playerAnswers: m.player_answers as LoadedMatch["playerAnswers"],
    maxResults: m.max_results as LoadedMatch["maxResults"],
    rounds: m.rounds,
  };
}

async function persistAnswer(
  sessionId: string,
  match: LoadedMatch,
  answer: { given: number | null; outcome: AnswerOutcome; points: number; timeMs: number; streakAfter: number },
  playerScore: number,
  maxScore: number,
  maxConfidence: number,
  nextIndex: number,
): Promise<void> {
  const newAnswers = [
    ...match.playerAnswers,
    { given: answer.given, outcome: answer.outcome, points: answer.points, timeMs: answer.timeMs },
  ];
  if (isSupabaseConfigured()) {
    const { error } = await getServiceClient()
      .from("matches")
      .update({
        player_answers: newAnswers,
        player_score: playerScore,
        max_score: maxScore,
        max_confidence: maxConfidence,
        current_index: nextIndex,
      })
      .eq("session_id", sessionId);
    if (error) throw new Error("Failed to persist answer: " + error.message);
  } else {
    const m = memoryStore.getMatchBySession(sessionId)!;
    m.player_answers = newAnswers as unknown[];
    m.player_score = playerScore;
    m.max_score = maxScore;
    m.max_confidence = maxConfidence;
    m.current_index = nextIndex;
    m.question_started_at = nowIso();
  }
}

export async function submitAnswer(input: {
  sessionId: string;
  index: number;
  cellIndex: number | null;
}): Promise<AnswerResponse> {
  const match = await loadMatch(input.sessionId);
  if (!match) throw new Error("Match not found");
  if (match.status !== "active") throw new Error("Match is not active");
  if (input.index !== match.currentIndex) throw new Error("Unexpected question index (stale answer)");

  const round = match.rounds[input.index];
  const startedMs = new Date(match.startedAt).getTime();
  const previousMs = match.playerAnswers.reduce((s, a) => s + (a.timeMs ?? 0), 0);
  const timeUsedMs =
    input.cellIndex === null
      ? round.timeLimitSec * 1000
      : Math.max(0, Math.min(nowMs() - startedMs - previousMs, round.timeLimitSec * 1000));

  let streakBefore = 0;
  for (let i = match.playerAnswers.length - 1; i >= 0; i--) {
    if (match.playerAnswers[i].outcome === "correct") streakBefore++;
    else break;
  }

  const evalResult = evaluateAnswer(round, input.cellIndex, timeUsedMs, streakBefore);
  const newPlayerScore = match.playerScore + evalResult.points;

  // Reveal M.A.X.'s result for this round.
  const maxResult = match.maxResults[input.index] ?? null;
  const newMaxScore = match.maxScore + (maxResult ? maxResult.points : 0);

  const playerCorrect = match.playerAnswers.filter((a) => a.outcome === "correct").length + (evalResult.outcome === "correct" ? 1 : 0);
  const playerWrong = match.playerAnswers.filter((a) => a.outcome === "wrong").length + (evalResult.outcome === "wrong" ? 1 : 0);
  const playerBlank = match.playerAnswers.filter((a) => a.outcome === "blank").length + (evalResult.outcome === "blank" ? 1 : 0);
  const maxCorrect = match.maxResults.slice(0, input.index + 1).filter((r) => r.outcome === "correct").length;

  const confidence = computeConfidence({
    trigger: evalResult.outcome === "correct" ? "player_correct" : evalResult.outcome === "wrong" ? "player_wrong" : "player_blank",
    playerScore: newPlayerScore,
    maxScore: newMaxScore,
    scoreDiff: newPlayerScore - newMaxScore,
    playerCorrect,
    playerWrong,
    playerBlank,
    streak: evalResult.streakAfter,
    maxStreak: 0,
    maxCorrect,
    timeRemainingSec: 0,
    difficulty: round.difficulty,
    confidence: match.maxConfidence,
  });

  await persistAnswer(
    input.sessionId,
    match,
    { given: input.cellIndex, outcome: evalResult.outcome, points: evalResult.points, timeMs: timeUsedMs, streakAfter: evalResult.streakAfter },
    newPlayerScore,
    newMaxScore,
    confidence,
    input.index + 1,
  );

  return {
    outcome: evalResult.outcome,
    points: evalResult.points,
    playerScore: newPlayerScore,
    maxScore: newMaxScore,
    maxConfidence: confidence,
    oddIndex: round.oddIndex,
    maxResult: maxResult
      ? { outcome: maxResult.outcome, timeMs: maxResult.timeMs, method: maxResult.method, points: maxResult.points }
      : null,
    nextIndex: input.index + 1,
    finished: input.index + 1 >= MATCH_ROUNDS,
  };
}

export async function finishMatch(sessionId: string): Promise<FinishResponse> {
  const match = await loadMatch(sessionId);
  if (!match) throw new Error("Match not found");

  if (match.status === "finished") {
    const existing = await getExistingResult(sessionId);
    if (existing) return existing;
  }

  const endedAt = nowIso();
  // Fill blanks for unanswered rounds.
  const answers = match.playerAnswers.slice();
  while (answers.length < match.rounds.length) {
    answers.push({ given: null, outcome: "blank" as AnswerOutcome, points: 0, timeMs: match.rounds[answers.length].timeLimitSec * 1000 });
  }

  const summary = buildSummary({
    matchId: match.matchId,
    playerName: match.playerName,
    avatar: match.avatar,
    maxMode: match.maxMode,
    startedAt: match.startedAt,
    endedAt,
    rounds: match.rounds,
    playerAnswers: answers,
    maxScore: match.maxScore,
    playerScore: match.playerScore,
  });

  const durationMs = new Date(endedAt).getTime() - new Date(match.startedAt).getTime();

  const result: ResultRow = {
    match_id: match.matchId,
    player_id: match.playerId,
    player_name: match.playerName,
    avatar: match.avatar,
    winner: summary.winner,
    player_score: summary.playerScore,
    max_score: summary.maxScore,
    correct_count: summary.correctCount,
    wrong_count: summary.wrongCount,
    blank_count: summary.blankCount,
    accuracy: summary.accuracy,
    avg_answer_ms: summary.avgAnswerMs,
    best_streak: summary.bestStreak,
    hardest_solved: summary.hardestSolved,
    max_mode: match.maxMode,
    duration_ms: durationMs,
    breakdown: summary.breakdown,
    created_at: endedAt,
  };

  if (isSupabaseConfigured()) {
    const db = getServiceClient();
    const { error } = await db.from("match_results").insert(result);
    if (error) throw new Error("Failed to store result: " + error.message);
    await db.from("matches").update({ status: "finished", ended_at: endedAt }).eq("session_id", sessionId);
  } else {
    memoryStore.insertResult(result);
    const m = memoryStore.getMatchBySession(sessionId);
    if (m) {
      m.status = "finished";
      m.ended_at = endedAt;
    }
  }

  const rank = await getPlayerRank(match.playerId);
  return { summary, rank };
}

async function getExistingResult(sessionId: string): Promise<FinishResponse | null> {
  let result: ResultRow | undefined;
  if (isSupabaseConfigured()) {
    const { data: match } = await getServiceClient().from("matches").select("id").eq("session_id", sessionId).single();
    if (!match) return null;
    const { data } = await getServiceClient().from("match_results").select("*").eq("match_id", match.id).single();
    result = (data as ResultRow | null) ?? undefined;
  } else {
    const m = memoryStore.getMatchBySession(sessionId);
    result = m ? memoryStore.results.find((r) => r.match_id === m.id) : undefined;
  }
  if (!result) return null;
  const rank = await getPlayerRank(result.player_id);
  return { summary: resultRowToSummary(result), rank };
}

function resultRowToSummary(r: ResultRow): MatchSummary {
  return {
    matchId: r.match_id,
    playerName: r.player_name,
    avatar: r.avatar,
    playerScore: r.player_score,
    maxScore: r.max_score,
    winner: r.winner,
    correctCount: r.correct_count,
    wrongCount: r.wrong_count,
    blankCount: r.blank_count,
    accuracy: r.accuracy,
    avgAnswerMs: r.avg_answer_ms,
    bestStreak: r.best_streak,
    hardestSolved: r.hardest_solved as MatchSummary["hardestSolved"],
    maxMode: r.max_mode as MaxMode,
    startedAt: r.created_at,
    endedAt: r.created_at,
    breakdown: r.breakdown as MatchSummary["breakdown"],
  };
}

export interface RecoverResponse {
  status: "active" | "finished";
  summary?: MatchSummary;
  startedAt?: string;
  maxMode?: MaxMode;
  currentIndex?: number;
  playerScore?: number;
  maxScore?: number;
  maxConfidence?: number;
  rounds?: PublicRound[];
}

export async function recoverMatch(sessionId: string): Promise<RecoverResponse> {
  const match = await loadMatch(sessionId);
  if (!match) throw new Error("Match not found");
  if (match.status === "finished") {
    const existing = await getExistingResult(sessionId);
    return { status: "finished", summary: existing?.summary };
  }
  return {
    status: "active",
    startedAt: match.startedAt,
    maxMode: match.maxMode,
    currentIndex: match.currentIndex,
    playerScore: match.playerScore,
    maxScore: match.maxScore,
    maxConfidence: match.maxConfidence,
    rounds: match.rounds.map(toPublicRound),
  };
}

async function getPlayerRank(playerId: string): Promise<number> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getServiceClient()
      .from("players")
      .select("id")
      .order("total_score", { ascending: false });
    if (error || !data) return 0;
    const idx = data.findIndex((p) => p.id === playerId);
    return idx >= 0 ? idx + 1 : 0;
  }
  const sorted = Array.from(memoryStore.players.values()).sort((a, b) => b.total_score - a.total_score);
  const idx = sorted.findIndex((p) => p.id === playerId);
  return idx >= 0 ? idx + 1 : 0;
}
