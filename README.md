# HUMAN VS MACHINE: LOGIC WAR

**"YOUR BRAIN VS MY ALGORITHM."**

A competitive, futuristic browser game where you race **M.A.X.** (Machine Algorithm X) through twelve rounds of one universal challenge: **find the one emoji that is different**. Difficulty scales from a 2×2 grid (easy) up to a 5×5 grid with near-identical emojis (expert). Whoever scores more in five minutes wins.

Built for event audiences — anyone can play instantly, no login, no install, no IT background needed.

## What's inside

- **One accessible game**: spot the odd emoji. Grid size and emoji similarity scale with difficulty.
- **A real opponent**: M.A.X. solves every grid with its own scanning algorithm at a per-mode "perceptual resolution". Lower modes genuinely cannot tell apart confusable emojis; expert mode is exact. Solve *time* is a deterministic simulation, clearly labeled.
- **A personality**: M.A.X. reacts to score, streaks, leads and time pressure with 100+ context-conditioned lines and a live confidence meter.
- **Fair scoring**: base points by difficulty + speed bonus + streak bonus − small wrong penalty. Computed **server-side** only.
- **Server-authoritative timers**: a 5-minute match clock and per-round timers backed by server timestamps, with reconnect/recovery.
- **Supabase database**: question bank (100+ seeded rounds), matches, results, leaderboard, global stats, admin.
- **Realtime leaderboard** and **global Human vs Machine stats**.
- **Admin dashboard**: stats, question bank management (generate/enable/delete), dialogue viewer.
- **Original audio**: synthesized music + SFX via the Web Audio API — no external assets, no licensing issues.
- **No AI API**: every solver, generator, scorer and dialogue is local TypeScript. No OpenAI/Gemini/Claude keys.

## Tech stack

Next.js (App Router) · TypeScript · Tailwind CSS · Framer Motion · Supabase (Postgres + Realtime) · Vercel.

## Quick start

```bash
# 1. install (requires network)
pnpm install        # or npm install

# 2. run the verified engine scripts (no Supabase needed)
pnpm run verify:bank   # 405 checks over the 100-round bank
pnpm run demo          # terminal full-match simulation

# 3. start the app — works immediately with an in-memory store
pnpm run dev

# 4. (production) add Supabase env vars, run migrations, deploy to Vercel
#    see docs/SETUP.md
```

Open http://localhost:3000. Without Supabase configured, the game runs fully against an in-memory store (data resets on restart). With Supabase configured, it persists matches, leaderboard and stats.

## Project structure

```
app/            pages + API routes (landing, lobby, battle, result, leaderboard, admin)
components/     M.A.X. character, timers, grid, scoreboard, leaderboard, stats, audio
lib/game/       pure game engine (types, emoji library, generator, solver, scoring,
                M.A.X., personality + 100+ dialogues, match runner) — Node-runnable
lib/db/         Supabase clients, match service, leaderboard/stats, admin, memory store
scripts/        seed-bank, verify-bank, play-demo (run with plain `node`)
supabase/       migrations (schema + RLS + triggers + 100-round seed)
docs/           setup + architecture
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm run dev` | start the dev server |
| `pnpm run build` | production build |
| `pnpm run verify:bank` | validate the 100-round bank (solvers, uniqueness, mode↔difficulty) |
| `pnpm run seed:bank` | regenerate `supabase/migrations/0002_seed_bank.sql` |
| `pnpm run demo` | simulate a full match in the terminal |

## Honesty notes

- M.A.X.'s solve **time is simulated** (not a CPU benchmark); its *correctness* comes from genuinely running the scanning algorithm.
- Leaderboard/stats are computed from real match results, never seeded with fake data.
- See `docs/ARCHITECTURE.md` for scoring, anti-cheat and solver details.
