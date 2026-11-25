// In-memory fallback store for local development / demos when Supabase is not
// configured. Mirrors the Supabase schema closely enough to power the full game
// flow, leaderboard and global stats in a single process. Data is not persisted
// across restarts — production uses Supabase (see lib/db/client.ts).

import type { RoundDefinition } from "@/lib/game";

export interface PlayerRow {
  id: string;
  name: string;
  avatar: string;
  total_score: number;
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
  best_score: number;
  best_streak: number;
  best_time_ms: number | null;
  created_at: string;
}

export interface MatchRow {
  id: string;
  session_id: string;
  player_id: string;
  player_name: string;
  avatar: string;
  max_mode: string;
  status: "starting" | "active" | "finished" | "abandoned";
  started_at: string;
  ended_at: string | null;
  current_index: number;
  player_score: number;
  max_score: number;
  max_confidence: number;
  player_answers: unknown[];
  max_results: unknown[];
  rounds: RoundDefinition[];
  question_started_at: string;
}

export interface ResultRow {
  match_id: string;
  player_id: string;
  player_name: string;
  avatar: string;
  winner: "human" | "machine" | "draw";
  player_score: number;
  max_score: number;
  correct_count: number;
  wrong_count: number;
  blank_count: number;
  accuracy: number;
  avg_answer_ms: number;
  best_streak: number;
  hardest_solved: string | null;
  max_mode: string;
  duration_ms: number;
  breakdown: unknown[];
  created_at: string;
}

class MemoryStore {
  players = new Map<string, PlayerRow>();
  matches = new Map<string, MatchRow>();
  matchesBySession = new Map<string, string>(); // session_id -> match id
  results: ResultRow[] = [];
  daily = new Map<string, { total: number; human: number; machine: number; draw: number }>();

  upsertPlayer(id: string, name: string, avatar: string): PlayerRow {
    let p = this.players.get(id);
    if (!p) {
      p = {
        id,
        name,
        avatar,
        total_score: 0,
        matches_played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        best_score: 0,
        best_streak: 0,
        best_time_ms: null,
        created_at: new Date().toISOString(),
      };
      this.players.set(id, p);
    } else {
      p.name = name;
      p.avatar = avatar;
    }
    return p;
  }

  putMatch(match: MatchRow): void {
    this.matches.set(match.id, match);
    this.matchesBySession.set(match.session_id, match.id);
  }

  getMatchBySession(sessionId: string): MatchRow | undefined {
    const id = this.matchesBySession.get(sessionId);
    return id ? this.matches.get(id) : undefined;
  }

  insertResult(result: ResultRow): void {
    this.results.push(result);
    const p = this.players.get(result.player_id);
    if (p) {
      p.matches_played += 1;
      p.total_score += result.player_score;
      if (result.winner === "human") p.wins += 1;
      else if (result.winner === "machine") p.losses += 1;
      else p.draws += 1;
      p.best_score = Math.max(p.best_score, result.player_score);
      p.best_streak = Math.max(p.best_streak, result.best_streak);
      p.best_time_ms = p.best_time_ms === null ? result.duration_ms : Math.min(p.best_time_ms, result.duration_ms);
    }
    const day = result.created_at.slice(0, 10);
    const d = this.daily.get(day) ?? { total: 0, human: 0, machine: 0, draw: 0 };
    d.total += 1;
    if (result.winner === "human") d.human += 1;
    else if (result.winner === "machine") d.machine += 1;
    else d.draw += 1;
    this.daily.set(day, d);
  }
}

export const memoryStore = new MemoryStore();
