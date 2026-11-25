# Architecture

## Overview

The game is a single, accessible challenge — **find the different emoji** — wrapped in an esports-style race against M.A.X. Everything is local TypeScript; there is no external AI API.

```
Browser (React) ──► Next.js API routes ──► Supabase (Postgres + Realtime)
        │                    │
        │  public rounds      │  service-role key only (server-side)
        │  (never answers)    └── validation, scoring, match lifecycle
```

## Game engine (`lib/game`)

Pure TypeScript, runnable with plain Node (no build step), so every solver is unit-verified.

- `emoji.ts` — the emoji library. Every emoji is tagged `{coarse, fine}`; `ULTRA_PAIRS` lists near-identical pairs. `resolveKey(emoji, mode)` collapses similar emojis at lower ability modes.
- `oddEmoji.ts` — `generateRound(difficulty, rng)` builds an n×n grid with one odd cell; `solveGrid(cells, mode)` finds it.
- `scoring.ts` — documented formula (see below).
- `randomizer.ts` — picks 12 rounds (3 per difficulty) with no duplicate ids and emoji variety.
- `max.ts` — M.A.X. solves all rounds up front + a deterministic **simulated** solve-time model.
- `personality.ts` / `dialogue.ts` — emotion + confidence + 100+ context-conditioned lines.
- `match.ts` — pure match runner used by the terminal demo and tests.

### Difficulty

| Stage | Rounds | Grid | Time/round | Base points | Odd emoji |
|---|---|---|---|---|---|
| Easy | 1–3 | 2×2 | 20s | 100 | totally different category |
| Normal | 4–6 | 3×3 | 25s | 150 | same category, different item |
| Hard | 7–9 | 4×4 | 30s | 220 | same item, subtle variant |
| Expert | 10–12 | 5×5 | 35s | 300 | near-identical pair |

### M.A.X. ability modes

M.A.X.'s "perceptual resolution" determines what it can distinguish:

| Mode | Resolution | Correctness across the 12 rounds | Speed (simulated) |
|---|---|---|---|
| Easy | coarse tag only | solves easy (~3/12) | slow |
| Normal | coarse + fine | solves easy + normal (~6/12) | medium |
| Hard | + exact glyph (ultra pairs collapsed) | solves easy…hard (~9/12) | fast |
| Expert | exact glyph | solves all (12/12) | fastest |

This is a genuine strategy difference, not a faked result: a naive scanner literally cannot tell `😀` from `😃`. M.A.X.'s solve **time** is a deterministic simulation scaling with grid size, similarity and mode — labeled in the UI as simulated, not a CPU benchmark.

### Scoring (server-only)

```
correct: base + speedBonus + streakBonus
wrong:   -15
blank:   0

speedBonus  = base × 0.35 × (1 − timeUsed/timeLimit)
streakBonus = min(consecutiveCorrect − 1, 5) × 20
```

Player and M.A.X. are scored identically.

## Anti-cheat & validation

- The match start response sends **public rounds only** (grid emojis, no `odd_index`).
- `odd_index` is revealed in the answer response **after** the player submits, and in the final result.
- Answer validation, timing and scoring happen in API routes using the service-role key.
- Per-round time = `serverNow − matchStarted − Σ(previous round times)`, clamped to the round limit. The client clock is never trusted.
- Replay is blocked by `session_id` + `current_index` equality checks; one result per match is enforced by `match_results.match_id UNIQUE` + a status check.
- The service-role key is never exposed to the browser; the browser only uses the anon key for realtime and admin auth.

## Database (`supabase/migrations/0001_init.sql`)

Tables: `players`, `matches`, `match_questions`, `question_bank`, `puzzle_templates`, `machine_personality_logs`, `daily_statistics`, `match_results`, `admin_users`.

- UUID primary keys, foreign keys, indexes on hot columns, CHECK constraints.
- RLS: anon can read only non-sensitive aggregates (`match_results`, `daily_statistics`, `players`); `question_bank` and live match state are service-role/admin only.
- Triggers roll up player aggregates and `daily_statistics` on each new result.
- Realtime: `match_results` and `daily_statistics` are published.

## Performance

- Timers are isolated components; the page does not re-render on every tick.
- Animations use only `transform`/`opacity`; `prefers-reduced-motion` is respected.
- Audio is synthesized (Web Audio), no assets; starts only after a user gesture.
- Rounds are fetched once at match start; no per-question database round-trips beyond the answer submit.
- Leaderboard uses the indexed `players` table for "all time" and a filtered aggregation for "today"/"week"; realtime only triggers a refetch on new results.
