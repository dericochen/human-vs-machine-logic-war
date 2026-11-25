// Personality engine: turns match state into M.A.X.'s emotion, confidence and a
// context-appropriate line. Lines are drawn from the dialogue bank without
// repeating recent picks.

import { DIALOGUES } from "./dialogue.ts";
import { clamp } from "./answer.ts";
import type { Rng } from "./rng.ts";
import type { DialogueContext, DialogueTrigger, EmotionId, PersonalitySnapshot } from "./types.ts";

/** M.A.X. confidence (5..95) derived from score gap, streaks, and time pressure. */
export function computeConfidence(ctx: DialogueContext): number {
  let c = 50;
  c -= ctx.scoreDiff * 0.7; // M.A.X. leading => scoreDiff < 0 => more confidence
  c += Math.min(ctx.maxStreak, 5) * 2; // M.A.X. on a run
  c -= Math.min(ctx.streak, 5) * 3; // player on a run
  if (ctx.timeRemainingSec < 20) c -= 8; // final pressure
  return Math.round(clamp(c, 5, 95));
}

/** Map a trigger + score state to a visual emotion. */
export function computeEmotion(trigger: DialogueTrigger, ctx: DialogueContext): EmotionId {
  const ahead = ctx.scoreDiff > 0; // player ahead
  const behind = ctx.scoreDiff < 0;
  switch (trigger) {
    case "match_start":
      return "confident";
    case "player_slow":
      return behind ? "angry" : "confident";
    case "player_correct":
      return ahead ? "surprised" : "thinking";
    case "player_wrong":
      return "laughing";
    case "player_blank":
      return "confident";
    case "max_leading":
      return "confident";
    case "player_leading":
      return "surprised";
    case "player_overtake":
      return "surprised";
    case "max_overtake":
      return "confident";
    case "stage_up":
      return "thinking";
    case "final_countdown":
      return ahead ? "surprised" : "thinking";
    case "max_victory":
      return "victory";
    case "max_defeat":
      return "defeated";
    case "draw":
      return "surprised";
    case "streak_hot":
      return "surprised";
  }
}

export function pickLine(trigger: DialogueTrigger, rng: Rng, used: Set<string> = new Set()): string {
  const lines = DIALOGUES[trigger] ?? [];
  if (lines.length === 0) return "...";
  for (let i = 0; i < 12; i++) {
    const line = lines[rng.int(0, lines.length)];
    if (!used.has(line)) return line;
  }
  return lines[rng.int(0, lines.length)];
}

export function snapshot(
  trigger: DialogueTrigger,
  ctx: DialogueContext,
  rng: Rng,
  used: Set<string>,
): PersonalitySnapshot {
  const confidence = computeConfidence(ctx);
  const emotion = computeEmotion(trigger, ctx);
  const line = pickLine(trigger, rng, used);
  used.add(line);
  return { emotion, confidence, line };
}
