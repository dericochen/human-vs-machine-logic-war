// Leaderboard and global statistics queries (server-side, aggregated safely).
// Uses Supabase when configured, otherwise the in-memory store.

import { getServiceClient, isSupabaseConfigured } from "./client";
import { memoryStore, type ResultRow } from "./memory";
import type { LeaderboardWindow } from "@/lib/game";

export interface LeaderboardRow {
  playerId: string;
  name: string;
  avatar: string;
  totalScore: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // 0..100
  bestTimeMs: number | null;
  bestStreak: number;
}

function windowStart(window: LeaderboardWindow): string {
  if (window === "all") return new Date(0).toISOString();
  const now = new Date();
  if (window === "today") {
    now.setUTCHours(0, 0, 0, 0);
    return now.toISOString();
  }
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Monday start
  now.setUTCDate(now.getUTCDate() - diff);
  now.setUTCHours(0, 0, 0, 0);
  return now.toISOString();
}

function aggregateRows(rows: ResultRow[]): LeaderboardRow[] {
  const map = new Map<string, LeaderboardRow>();
  for (const r of rows) {
    let row = map.get(r.player_id);
    if (!row) {
      row = {
        playerId: r.player_id,
        name: r.player_name,
        avatar: r.avatar,
        totalScore: 0,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        bestTimeMs: null,
        bestStreak: 0,
      };
      map.set(r.player_id, row);
    }
    row.totalScore += r.player_score;
    row.matchesPlayed += 1;
    if (r.winner === "human") row.wins += 1;
    else if (r.winner === "machine") row.losses += 1;
    else row.draws += 1;
    row.bestStreak = Math.max(row.bestStreak, r.best_streak);
    row.bestTimeMs = row.bestTimeMs === null ? r.duration_ms : Math.min(row.bestTimeMs, r.duration_ms);
  }
  for (const row of map.values()) {
    row.winRate = row.matchesPlayed ? Math.round((row.wins / row.matchesPlayed) * 1000) / 10 : 0;
  }
  return Array.from(map.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 10);
}

export async function getLeaderboard(window: LeaderboardWindow): Promise<LeaderboardRow[]> {
  const start = windowStart(window);

  if (isSupabaseConfigured()) {
    const db = getServiceClient();
    if (window === "all") {
      // Fast path: lifetime aggregates on the indexed players table.
      const { data, error } = await db
        .from("players")
        .select("id, name, avatar, total_score, matches_played, wins, losses, draws, best_time_ms, best_streak")
        .gt("matches_played", 0)
        .order("total_score", { ascending: false })
        .limit(10);
      if (error) throw new Error("Leaderboard error: " + error.message);
      return (data ?? []).map((p) => ({
        playerId: p.id,
        name: p.name,
        avatar: p.avatar,
        totalScore: p.total_score,
        matchesPlayed: p.matches_played,
        wins: p.wins,
        losses: p.losses,
        draws: p.draws,
        winRate: p.matches_played ? Math.round((p.wins / p.matches_played) * 1000) / 10 : 0,
        bestTimeMs: p.best_time_ms,
        bestStreak: p.best_streak,
      }));
    }
    const { data, error } = await db
      .from("match_results")
      .select("player_id, player_name, avatar, winner, player_score, duration_ms, best_streak")
      .gte("created_at", start);
    if (error) throw new Error("Leaderboard error: " + error.message);
    return aggregateRows((data ?? []) as ResultRow[]);
  }

  if (window === "all") {
    const rows = Array.from(memoryStore.players.values()).filter((p) => p.matches_played > 0);
    return rows
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        avatar: p.avatar,
        totalScore: p.total_score,
        matchesPlayed: p.matches_played,
        wins: p.wins,
        losses: p.losses,
        draws: p.draws,
        winRate: p.matches_played ? Math.round((p.wins / p.matches_played) * 1000) / 10 : 0,
        bestTimeMs: p.best_time_ms,
        bestStreak: p.best_streak,
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 10);
  }
  return aggregateRows(memoryStore.results.filter((r) => r.created_at >= start));
}

export interface GlobalStats {
  totalMatches: number;
  humanWins: number;
  machineWins: number;
  draws: number;
  totalAnswers: number;
  avgAccuracy: number;
  humanWinRate: number;
  machineWinRate: number;
  bestScore: number;
  bestStreak: number;
  bestPlayerName: string | null;
}

export async function getGlobalStats(): Promise<GlobalStats> {
  let rows: ResultRow[] = [];
  if (isSupabaseConfigured()) {
    const { data, error } = await getServiceClient()
      .from("match_results")
      .select("winner, player_name, player_score, correct_count, wrong_count, blank_count, accuracy, best_streak");
    if (error) throw new Error("Stats error: " + error.message);
    rows = (data ?? []) as ResultRow[];
  } else {
    rows = memoryStore.results;
  }

  let humanWins = 0;
  let machineWins = 0;
  let draws = 0;
  let totalAnswers = 0;
  let accSum = 0;
  let bestScore = 0;
  let bestStreak = 0;
  let bestPlayer: string | null = null;

  for (const r of rows) {
    if (r.winner === "human") humanWins++;
    else if (r.winner === "machine") machineWins++;
    else draws++;
    totalAnswers += (r.correct_count ?? 0) + (r.wrong_count ?? 0) + (r.blank_count ?? 0);
    accSum += r.accuracy ?? 0;
    if (r.player_score > bestScore) {
      bestScore = r.player_score;
      bestPlayer = r.player_name;
    }
    if (r.best_streak > bestStreak) bestStreak = r.best_streak;
  }

  const total = rows.length;
  const decided = humanWins + machineWins;
  return {
    totalMatches: total,
    humanWins,
    machineWins,
    draws,
    totalAnswers,
    avgAccuracy: total ? Math.round((accSum / total) * 10) / 10 : 0,
    humanWinRate: decided ? Math.round((humanWins / decided) * 1000) / 10 : 0,
    machineWinRate: decided ? Math.round((machineWins / decided) * 1000) / 10 : 0,
    bestScore,
    bestStreak,
    bestPlayerName: bestPlayer,
  };
}
