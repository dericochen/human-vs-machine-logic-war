// Admin authorization + data access (server-side only).

import { getServiceClient, isSupabaseConfigured } from "./client";
import { memoryStore, type ResultRow } from "./memory";
import { createRng, DIFFICULTY_ORDER, generateRound, getFallbackBank, type Difficulty, type RoundDefinition } from "@/lib/game";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";

export interface AdminAuth {
  email: string;
}

/**
 * Verify an admin request. Supabase mode: Bearer access token + admin_users row.
 * Fallback mode (no Supabase): x-admin-key header compared to ADMIN_PASSWORD.
 * Returns the admin identity, or null if unauthorized.
 */
export async function requireAdmin(req: Request): Promise<AdminAuth | null> {
  if (isSupabaseConfigured()) {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return null;
    const { data, error } = await getServiceClient().auth.getUser(token);
    if (error || !data.user?.email) return null;
    const email = data.user.email.toLowerCase();
    const { data: admins } = await getServiceClient().from("admin_users").select("email").eq("email", email).limit(1);
    if (!admins || admins.length === 0) return null;
    return { email };
  }
  const key = req.headers.get("x-admin-key") ?? "";
  if (key !== ADMIN_PASSWORD) return null;
  return { email: "local-admin" };
}

export interface AdminStats {
  players: number;
  matches: number;
  humanWins: number;
  machineWins: number;
  draws: number;
  machineWinRate: number;
  byMode: Array<{ mode: string; matches: number; machineWins: number; humanWins: number }>;
  mostMissed: Array<{ difficulty: string; oddEmoji: string; missed: number }>;
  totalQuestions: number;
  activeQuestions: number;
}

function aggregateResults(results: Array<{
  winner: string;
  max_mode: string;
  breakdown: unknown[] | null;
}>): Pick<AdminStats, "humanWins" | "machineWins" | "draws" | "byMode" | "mostMissed"> {
  let humanWins = 0;
  let machineWins = 0;
  let draws = 0;
  const byMode = new Map<string, { matches: number; machineWins: number; humanWins: number }>();
  const missCount = new Map<string, { difficulty: string; oddEmoji: string; missed: number }>();

  for (const r of results) {
    if (r.winner === "human") humanWins++;
    else if (r.winner === "machine") machineWins++;
    else draws++;

    const m = byMode.get(r.max_mode) ?? { matches: 0, machineWins: 0, humanWins: 0 };
    m.matches++;
    if (r.winner === "machine") m.machineWins++;
    if (r.winner === "human") m.humanWins++;
    byMode.set(r.max_mode, m);

    for (const raw of r.breakdown ?? []) {
      const b = raw as { difficulty: string; oddEmoji: string; outcome: string };
      if (b.outcome !== "correct") {
        const key = `${b.difficulty}:${b.oddEmoji}`;
        const cur = missCount.get(key) ?? { difficulty: b.difficulty, oddEmoji: b.oddEmoji, missed: 0 };
        cur.missed++;
        missCount.set(key, cur);
      }
    }
  }

  return {
    humanWins,
    machineWins,
    draws,
    byMode: Array.from(byMode.entries()).map(([mode, v]) => ({ mode, ...v })),
    mostMissed: Array.from(missCount.values()).sort((a, b) => b.missed - a.missed).slice(0, 8),
  };
}

export async function getAdminStats(): Promise<AdminStats> {
  if (!isSupabaseConfigured()) {
    const agg = aggregateResults(memoryStore.results);
    const bank = getFallbackBank();
    return {
      players: memoryStore.players.size,
      matches: memoryStore.results.length,
      ...agg,
      machineWinRate: agg.humanWins + agg.machineWins
        ? Math.round((agg.machineWins / (agg.humanWins + agg.machineWins)) * 1000) / 10
        : 0,
      totalQuestions: bank.length,
      activeQuestions: bank.length,
    };
  }

  const db = getServiceClient();
  const [{ count: players }, { count: matches }] = await Promise.all([
    db.from("players").select("id", { count: "exact", head: true }),
    db.from("match_results").select("id", { count: "exact", head: true }),
  ]);

  const { data: results } = await db
    .from("match_results")
    .select("winner, max_mode, breakdown")
    .order("created_at", { ascending: false })
    .limit(500);

  const agg = aggregateResults(
    (results ?? []).map((r) => ({
      winner: r.winner,
      max_mode: r.max_mode,
      breakdown: r.breakdown as Array<{ difficulty: string; oddEmoji: string; outcome: string }> | null,
    })),
  );

  const { count: totalQuestions } = await db.from("question_bank").select("id", { count: "exact", head: true });
  const { count: activeQuestions } = await db.from("question_bank").select("id", { count: "exact", head: true }).eq("active", true);

  const decided = agg.humanWins + agg.machineWins;
  return {
    players: players ?? 0,
    matches: matches ?? 0,
    humanWins: agg.humanWins,
    machineWins: agg.machineWins,
    draws: agg.draws,
    machineWinRate: decided ? Math.round((agg.machineWins / decided) * 1000) / 10 : 0,
    byMode: agg.byMode,
    mostMissed: agg.mostMissed,
    totalQuestions: totalQuestions ?? 0,
    activeQuestions: activeQuestions ?? 0,
  };
}

export interface QuestionListResult {
  rows: Array<Record<string, unknown>>;
  count: number;
}

export async function listQuestions(difficulty: Difficulty | "all", offset: number, limit: number): Promise<QuestionListResult> {
  if (!isSupabaseConfigured()) {
    const bank = getFallbackBank().filter((r) => difficulty === "all" || r.difficulty === difficulty);
    const page = bank.slice(offset, offset + limit);
    return {
      rows: page.map((r) => ({
        id: r.id,
        difficulty: r.difficulty,
        grid_size: r.gridSize,
        cells: r.cells,
        base_emoji: r.baseEmoji,
        odd_emoji: r.oddEmoji,
        odd_index: r.oddIndex,
        active: true,
        source: r.source,
      })),
      count: bank.length,
    };
  }

  const db = getServiceClient();
  let q = db.from("question_bank").select("*", { count: "exact" }).order("difficulty").order("id").range(offset, offset + limit - 1);
  if (difficulty !== "all") q = q.eq("difficulty", difficulty);
  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as Array<Record<string, unknown>>, count: count ?? 0 };
}

export async function generateAndInsert(difficulty: Difficulty): Promise<RoundDefinition> {
  if (!isSupabaseConfigured()) throw new Error("Question management requires Supabase. Configure the env vars.");
  const db = getServiceClient();
  for (let i = 0; i < 30; i++) {
    const round = generateRound(difficulty, createRng(Date.now() + i * 7919));
    const { error } = await db.from("question_bank").insert({
      id: round.id,
      category: "odd_emoji",
      difficulty: round.difficulty,
      kind: "grid",
      prompt: "Find the emoji that is different.",
      grid_size: round.gridSize,
      cells: round.cells,
      base_emoji: round.baseEmoji,
      odd_emoji: round.oddEmoji,
      odd_index: round.oddIndex,
      explanation: round.explanation,
      time_limit_sec: round.timeLimitSec,
      base_points: round.basePoints,
      params: round.params,
      source: "generated",
      active: true,
    });
    if (!error) return round;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Could not generate a unique round");
}

export async function setQuestionActive(id: string, active: boolean): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Question management requires Supabase.");
  const { error } = await getServiceClient().from("question_bank").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteQuestion(id: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Question management requires Supabase.");
  const { error } = await getServiceClient().from("question_bank").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
