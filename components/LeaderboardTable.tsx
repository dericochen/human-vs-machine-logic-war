"use client";

import { useEffect, useMemo, useState } from "react";
import type { LeaderboardRow } from "@/lib/db/queries";
import type { LeaderboardWindow } from "@/lib/game";
import { apiFetch } from "@/lib/client";
import { getBrowserSupabase } from "@/lib/supabase-browser";

const WINDOWS: { id: LeaderboardWindow; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
];

function fmtTime(ms: number | null): string {
  if (ms == null) return "-";
  return `${Math.round(ms / 1000)}s`;
}

export default function LeaderboardTable() {
  const [window, setWindow] = useState<LeaderboardWindow>("all");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useMemo(
    () => () => {
      setLoading(true);
      apiFetch<{ rows: LeaderboardRow[] }>(`/api/leaderboard?window=${window}`)
        .then((d) => setRows(d.rows))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    },
    [window],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Realtime refresh (Supabase) — refetch when a new result lands.
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const channel = sb
      .channel("leaderboard")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "match_results" }, () => load())
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [load]);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {WINDOWS.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setWindow(w.id)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              window === w.id ? "bg-neon/15 text-neon neon-border" : "glass text-inkdim hover:text-ink"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-inkdim">Loading leaderboard…</div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-xl py-10 text-center text-sm text-inkdim">
          No matches yet. Be the first to battle M.A.X.
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-xl">
          <div className="grid grid-cols-[2.5rem_1fr_4rem_4rem_4rem_4rem_4rem] gap-2 border-b border-line px-4 py-2 text-[11px] uppercase tracking-wide text-inkdim md:grid-cols-[3rem_1fr_5rem_4rem_4rem_5rem_4rem_4rem]">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Score</span>
            <span className="text-right">W</span>
            <span className="text-right">L</span>
            <span className="text-right">Win rate</span>
            <span className="text-right">Streak</span>
            <span className="hidden text-right md:block">Best time</span>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.playerId}
              className={`grid grid-cols-[2.5rem_1fr_4rem_4rem_4rem_4rem_4rem] items-center gap-2 px-4 py-2.5 text-sm md:grid-cols-[3rem_1fr_5rem_4rem_4rem_5rem_4rem_4rem] ${
                i === 0 ? "bg-gold/5" : ""
              }`}
            >
              <span className={`mono font-bold ${i === 0 ? "text-gold" : "text-inkdim"}`}>{i + 1}</span>
              <span className="flex items-center gap-2 truncate">
                <span aria-hidden>{r.avatar || "\u{1F9E0}"}</span>
                <span className="truncate">{r.name}</span>
              </span>
              <span className="mono text-right font-semibold text-neon">{r.totalScore}</span>
              <span className="text-right text-win">{r.wins}</span>
              <span className="text-right text-lose">{r.losses}</span>
              <span className="mono text-right tabular-nums text-inkdim">{r.winRate}%</span>
              <span className="mono text-right tabular-nums text-inkdim">{r.bestStreak}</span>
              <span className="mono hidden text-right tabular-nums text-inkdim md:block">{fmtTime(r.bestTimeMs)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
