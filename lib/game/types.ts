// Shared type contracts for "HUMAN VS MACHINE: LOGIC WAR".
//
// The core challenge is a single, universally understandable game:
//   "Find the emoji that is different."
//
// Each round renders an n×n grid of emojis where exactly one cell differs from
// the rest. Difficulty scales the grid size (2×2 → 3×3 → 4×4 → 5×5) and how
// visually confusable the odd emoji is. M.A.X. solves the same grid with its own
// scanning algorithm; both are scored by the same formula.

export type Difficulty = "easy" | "normal" | "hard" | "expert";
export type MaxMode = "easy" | "normal" | "hard" | "expert";

export type AnswerOutcome = "correct" | "wrong" | "blank";
export type MatchStatus = "starting" | "active" | "finished" | "abandoned";

export interface DifficultyMeta {
  id: Difficulty;
  label: string;
  /** Grid side length (n => n×n cells). */
  gridSize: number;
  timeLimitSec: number;
  basePoints: number;
  stage: number; // 1..4
}

/**
 * Full definition of a round. `oddIndex` is the answer and is NEVER sent to the
 * browser before the player answers — only the grid (`cells`) is exposed.
 */
export interface RoundDefinition {
  id: string;
  difficulty: Difficulty;
  gridSize: number;
  /** n×n emoji strings, flattened row-major. Exactly one differs. */
  cells: string[];
  baseEmoji: string;
  oddEmoji: string;
  /** 0-based index (row-major) of the odd cell. */
  oddIndex: number;
  explanation: string;
  timeLimitSec: number;
  basePoints: number;
  params: Record<string, unknown>;
  source: "seeded" | "generated";
  active: boolean;
}

/** A round as shown in the browser. No answer data. */
export interface PublicRound {
  id: string;
  difficulty: Difficulty;
  gridSize: number;
  cells: string[];
  timeLimitSec: number;
  basePoints: number;
  index: number;
}

export interface PlayerAnswerRecord {
  index: number;
  roundId: string;
  /** Tapped cell index (0-based, row-major), or null if time expired. */
  given: number | null;
  outcome: AnswerOutcome;
  points: number;
  timeMs: number;
  streakAfter: number;
  answeredAt: string;
}

export interface MaxAnswerRecord {
  index: number;
  roundId: string;
  outcome: AnswerOutcome;
  points: number;
  timeMs: number; // simulated solve time
  method: string;
}

export interface GridSolveResult {
  /** Index of the odd cell, or null if the strategy could not distinguish it. */
  cellIndex: number | null;
  method: string;
}

export interface MatchRoundRef {
  index: number;
  roundId: string;
  difficulty: Difficulty;
  gridSize: number;
  timeLimitSec: number;
}

export interface MatchState {
  id: string;
  sessionId: string;
  playerId: string;
  playerName: string;
  avatar: string;
  maxMode: MaxMode;
  status: MatchStatus;
  startedAt: string; // authoritative server start time (ISO)
  endedAt: string | null;
  rounds: MatchRoundRef[];
  currentIndex: number;
  playerAnswers: PlayerAnswerRecord[];
  maxAnswers: MaxAnswerRecord[];
  playerScore: number;
  maxScore: number;
  maxConfidence: number; // 0..100
  /** Pre-computed M.A.X. result per round (computed server-side at start). */
  maxResults: Array<{ index: number; outcome: AnswerOutcome; timeMs: number; method: string }>;
}

export interface MatchSummary {
  matchId: string;
  playerName: string;
  avatar: string;
  playerScore: number;
  maxScore: number;
  winner: "human" | "machine" | "draw";
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  accuracy: number; // 0..100
  avgAnswerMs: number;
  bestStreak: number;
  hardestSolved: Difficulty | null;
  maxMode: MaxMode;
  startedAt: string;
  endedAt: string;
  breakdown: Array<{
    index: number;
    difficulty: Difficulty;
    gridSize: number;
    cells: string[];
    oddEmoji: string;
    oddIndex: number;
    playerAnswer: number | null;
    outcome: AnswerOutcome;
    points: number;
    timeMs: number;
    explanation: string;
  }>;
}

export interface ScoreBreakdown {
  base: number;
  speedBonus: number;
  streakBonus: number;
  penalty: number;
  total: number;
}

// ---- Personality / dialogue ----

export type EmotionId =
  | "idle"
  | "thinking"
  | "confident"
  | "laughing"
  | "surprised"
  | "angry"
  | "victory"
  | "defeated";

export type DialogueTrigger =
  | "match_start"
  | "player_slow"
  | "player_correct"
  | "player_wrong"
  | "player_blank"
  | "max_leading"
  | "player_leading"
  | "player_overtake"
  | "max_overtake"
  | "stage_up"
  | "final_countdown"
  | "max_victory"
  | "max_defeat"
  | "draw"
  | "streak_hot";

export interface DialogueContext {
  trigger: DialogueTrigger;
  playerScore: number;
  maxScore: number;
  scoreDiff: number; // player - max
  playerCorrect: number;
  playerWrong: number;
  playerBlank: number;
  streak: number; // player's current consecutive-correct streak
  maxStreak: number; // M.A.X.'s current consecutive-correct streak
  maxCorrect: number;
  timeRemainingSec: number;
  difficulty: Difficulty | null;
  confidence: number; // 0..100 (previous)
}

export interface PersonalitySnapshot {
  emotion: EmotionId;
  confidence: number; // 0..100
  line: string;
}
