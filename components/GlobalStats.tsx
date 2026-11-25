"use client";

import { useEffect, useMemo, useState } from "react";
import type { GlobalStats } from "@/lib/db/queries";
import { apiFetch } from "@/lib/client";
import { getBrowserSupabase } from "@/lib/supabase-browser";

const EMPTY: GlobalStats = {
  totalMatches: 0,
  humanWins: 0,
  machineWins: 0,
  draws: 0,
  totalAnswers: 0,
  avgAccuracy: 0,
  humanWinRate: 50,
  machineWinRate: 50,
  bestScore: 0,
  bestStreak: 0,
  bestPlayerName: null,
};

export default function GlobalStats() {
  const [stats, setStats] = useState<GlobalStats>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useMemo(
    () => () => {
      apiFetch<GlobalStats>("/api/stats")
        .then(setStats)
        .catch(() => setStats(EMPTY))
        .finally(() => setLoading(false));
    },
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const channel = sb
      .channel("global-stats")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "match_results" }, () => load())
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [load]);

  const stat = (label: string, value: string | number, accent = false) => (
    <div className="glass rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wide text-inkdim">{label}</div>
      <div className={`mono mt-1 text-2xl font-bold tabular-nums ${accent ? "neon-text" : "text-ink"}`}>{value}</div>
    </div>
  );

  return (
    <section>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stat("Matches played", stats.totalMatches)}
        {stat("Human wins", stats.humanWins, true)}
        {stat("Machine wins", stats.machineWins)}
        {stat("Avg human accuracy", `${stats.avgAccuracy}%`)}
      </div>

      <div className="glass mt-3 rounded-xl p-5">
        <div className="mb-2 text-[11px] uppercase tracking-wide text-inkdim">Win rate</div>
        <div className="flex h-4 w-full overflow-hidden rounded-full" style={{ background: "var(--panel-2)" }}>
          <div
            className="h-full"
            style={{ width: `${stats.humanWinRate}%`, background: "var(--neon)", transition: "width 0.5s ease" }}
          />
          <div
            className="h-full"
            style={{ width: `${stats.machineWinRate}%`, background: "var(--violet)", transition: "width 0.5s ease" }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-neon">
            HUMAN {loading ? "--" : `${stats.humanWinRate}%`}
          </span>
          <span className="text-violet">
            MACHINE {loading ? "--" : `${stats.machineWinRate}%`}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
        {stat("Answers given", stats.totalAnswers)}
        {stat("Best score", stats.bestScore)}
        {stat("Best streak", stats.bestStreak)}
      </div>
      {stats.bestPlayerName && (
        <p className="mt-3 text-sm text-inkdim">
          Highest score by <span className="text-ink">{stats.bestPlayerName}</span>
        </p>
      )}
    </section>
  );
}
