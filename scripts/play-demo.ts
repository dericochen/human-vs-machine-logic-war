// Terminal demo of a full match: picks 12 rounds, runs M.A.X.'s solver, applies
// a scripted "human" answer pattern, and prints round-by-round scoring, M.A.X.'s
// personality, and the winner. Proves the engine works end-to-end without a UI.
//
// Run:  node scripts/play-demo.ts

import { getFallbackBank } from "../lib/game/bank.ts";
import { selectMatchRounds } from "../lib/game/randomizer.ts";
import { runMatch } from "../lib/game/match.ts";
import { computeConfidence, snapshot } from "../lib/game/personality.ts";
import { createRng } from "../lib/game/rng.ts";
import { MAX_MODE_LABEL } from "../lib/game/constants.ts";
import type { MaxMode, DialogueContext } from "../lib/game/types.ts";

const bank = getFallbackBank();
const seed = 1234567;
const maxMode: MaxMode = "normal";

const rounds = selectMatchRounds(bank, seed);
const rng = createRng("demo-dialogue");
const used = new Set<string>();

// Scripted "human": mostly correct, a couple wrong, one blank, varied speed.
const humanAnswers = rounds.map((r, i) => {
  if (i === 4) return { given: 0, timeMs: 4100 }; // wrong (guesses cell 0)
  if (i === 8) return { given: null, timeMs: r.timeLimitSec * 1000 }; // blank (timeout)
  const correct = r.oddIndex;
  return { given: correct, timeMs: 1200 + i * 350 }; // correct, slower over time
});

console.log("HUMAN VS MACHINE — LOGIC WAR (demo)");
console.log(`M.A.X. ability: ${MAX_MODE_LABEL[maxMode]} | 12 rounds\n`);

let playerScore = 0;
let maxScore = 0;
let streak = 0;

for (let i = 0; i < rounds.length; i++) {
  const r = rounds[i];
  const input = humanAnswers[i];
  const correct = input.given === r.oddIndex;
  streak = correct ? streak + 1 : 0;
  const grid = `${r.gridSize}x${r.gridSize}`;
  const answerNote = input.given === null ? "BLANK" : correct ? "CORRECT" : "WRONG";
  console.log(
    `R${String(i + 1).padStart(2)} [${r.difficulty.toUpperCase().padEnd(6)} ${grid}] ` +
      `answer=${String(input.given).padEnd(2)} ${answerNote.padEnd(7)} time=${(input.timeMs / 1000).toFixed(1)}s`,
  );
}

const result = runMatch(rounds, maxMode, humanAnswers, {
  matchId: "demo-match",
  playerName: "Human Demo",
  avatar: "\u{1F9E0}",
  startedAt: new Date().toISOString(),
  endedAt: new Date().toISOString(),
});

console.log(`\nFINAL  Human ${result.playerScore}  vs  M.A.X. ${result.maxScore}`);
console.log(`Winner: ${result.summary.winner.toUpperCase()}`);
console.log(
  `Correct ${result.summary.correctCount} / Wrong ${result.summary.wrongCount} / ` +
    `Blank ${result.summary.blankCount} | accuracy ${result.summary.accuracy}% | best streak ${result.summary.bestStreak}`,
);

const ctx: DialogueContext = {
  trigger: result.summary.winner === "human" ? "max_defeat" : result.summary.winner === "machine" ? "max_victory" : "draw",
  playerScore: result.playerScore,
  maxScore: result.maxScore,
  scoreDiff: result.playerScore - result.maxScore,
  playerCorrect: result.summary.correctCount,
  playerWrong: result.summary.wrongCount,
  playerBlank: result.summary.blankCount,
  streak: 0,
  maxStreak: 12,
  maxCorrect: 12,
  timeRemainingSec: 0,
  difficulty: null,
  confidence: 50,
};

const snap = snapshot(ctx.trigger, ctx, rng, used);
console.log(`\nM.A.X.: "${snap.line}"`);
console.log(`M.A.X. confidence: ${snap.confidence}/100 (emotion: ${snap.emotion})`);
console.log(
  `(M.A.X. solve times are simulated — not CPU benchmarks. Computed confidence range: 5..95.)`,
);
