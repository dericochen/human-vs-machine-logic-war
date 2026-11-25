"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import type { AdminStats } from "@/lib/db/admin";

type Tab = "overview" | "questions" | "dialogue";

interface QuestionRow {
  id: string;
  difficulty: string;
  grid_size: number;
  cells: string[];
  base_emoji: string;
  odd_emoji: string;
  odd_index: number;
  active: boolean;
  source: string;
}

const SUPABASE_MODE = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

function authHeaders(): HeadersInit {
  if (SUPABASE_MODE) {
    const t = localStorage.getItem("lw_admin_token") ?? "";
    return { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };
  }
  const k = localStorage.getItem("lw_admin_key") ?? "";
  return { "x-admin-key": k, "Content-Type": "application/json" };
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error((json?.error as string) || `Request failed (${res.status})`);
  return json as T;
}

function MiniGrid({ cells, size }: { cells: string[]; size: number }) {
  return (
    <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
      {cells.map((c, i) => (
        <span key={i} className="text-[11px] leading-none">
          {c}
        </span>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (SUPABASE_MODE) setAuthed(Boolean(localStorage.getItem("lw_admin_token")));
    else setAuthed(Boolean(localStorage.getItem("lw_admin_key")));
  }, []);

  async function login() {
    setLoading(true);
    setLoginError("");
    try {
      if (SUPABASE_MODE) {
        const sb = getBrowserSupabase();
        if (!sb) throw new Error("Supabase not configured");
        const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(error.message);
        if (!data.session) throw new Error("No session returned");
        localStorage.setItem("lw_admin_token", data.session.access_token);
      } else {
        localStorage.setItem("lw_admin_key", password);
        await adminFetch("/api/admin/stats"); // verify
      }
      setAuthed(true);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("lw_admin_token");
    localStorage.removeItem("lw_admin_key");
    setAuthed(false);
  }

  if (!authed) {
    return (
      <main className="grid-line flex min-h-screen items-center justify-center px-5">
        <div className="glass w-full max-w-sm rounded-2xl p-8">
          <h1 className="text-xl font-bold text-ink">Admin dashboard</h1>
          <p className="mt-1 text-sm text-inkdim">
            {SUPABASE_MODE ? "Sign in with an admin account." : "Enter the admin key."}
          </p>
          <div className="mt-6 space-y-3">
            {SUPABASE_MODE && (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Admin email"
                autoComplete="email"
                className="w-full rounded-lg border border-line bg-panel-2 px-4 py-3 text-ink placeholder:text-inkfaint focus:outline-none focus:ring-2 focus:ring-neon"
              />
            )}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={SUPABASE_MODE ? "Password" : "Admin key"}
              autoComplete="current-password"
              className="w-full rounded-lg border border-line bg-panel-2 px-4 py-3 text-ink placeholder:text-inkfaint focus:outline-none focus:ring-2 focus:ring-neon"
            />
            {loginError && <p className="text-sm text-lose">{loginError}</p>}
            <button
              type="button"
              onClick={login}
              disabled={loading}
              className="neon-border w-full rounded-xl bg-neon/15 py-3 font-bold text-neon disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="grid-line min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <span className="neon-text mono text-lg font-black">ADMIN · LOGIC WAR</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={logout} className="glass rounded-lg px-3 py-1.5 text-sm text-inkdim hover:text-ink">
            Sign out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="mb-6 flex gap-2">
          {(["overview", "questions", "dialogue"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm capitalize transition-colors ${
                tab === t ? "bg-neon/15 text-neon neon-border" : "glass text-inkdim hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab />}
        {tab === "questions" && <QuestionsTab />}
        {tab === "dialogue" && <DialogueTab />}
      </section>
    </main>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    adminFetch<AdminStats>("/api/admin/stats")
      .then(setStats)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <p className="text-lose">{err}</p>;
  if (!stats) return <p className="text-inkdim">Loading…</p>;

  const card = (label: string, v: string | number, color?: string) => (
    <div className="glass rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wide text-inkdim">{label}</div>
      <div className="mono mt-1 text-2xl font-bold" style={{ color: color ?? "var(--ink)" }}>
        {v}
      </div>
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {card("Players", stats.players)}
        {card("Matches", stats.matches)}
        {card("M.A.X. win rate", `${stats.machineWinRate}%`, "var(--violet)")}
        {card("Questions (active)", `${stats.activeQuestions}/${stats.totalQuestions}`)}
      </div>

      <h2 className="mb-2 mt-8 text-lg font-bold text-ink">M.A.X. performance by mode</h2>
      <div className="glass overflow-hidden rounded-xl">
        <div className="grid grid-cols-4 gap-2 border-b border-line px-4 py-2 text-[11px] uppercase text-inkdim">
          <span>Mode</span>
          <span className="text-right">Matches</span>
          <span className="text-right">M.A.X. wins</span>
          <span className="text-right">Human wins</span>
        </div>
        {stats.byMode.length === 0 && <div className="px-4 py-4 text-sm text-inkdim">No data yet.</div>}
        {stats.byMode.map((m) => (
          <div key={m.mode} className="grid grid-cols-4 gap-2 px-4 py-2 text-sm">
            <span className="mono font-bold text-ink">{m.mode.toUpperCase()}</span>
            <span className="text-right text-inkdim">{m.matches}</span>
            <span className="text-right text-violet">{m.machineWins}</span>
            <span className="text-right text-neon">{m.humanWins}</span>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-8 text-lg font-bold text-ink">Most missed rounds</h2>
      <div className="space-y-1.5">
        {stats.mostMissed.length === 0 && <p className="text-sm text-inkdim">No wrong answers recorded yet.</p>}
        {stats.mostMissed.map((m, i) => (
          <div key={i} className="glass flex items-center justify-between rounded-lg px-4 py-2 text-sm">
            <span>
              <span className="rounded bg-panel-2 px-2 py-0.5 text-[11px] font-bold text-violet">{m.difficulty.toUpperCase()}</span>{" "}
              <span className="ml-1">{m.oddEmoji}</span>
            </span>
            <span className="mono text-lose">{m.missed} missed</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionsTab() {
  const [difficulty, setDifficulty] = useState("all");
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminFetch<{ rows: QuestionRow[]; count: number }>(`/api/admin/questions?difficulty=${difficulty}&limit=50`)
      .then((d) => setRows(d.rows))
      .catch(() => setRows([]));
  }, [difficulty]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(row: QuestionRow) {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/questions/${row.id}`, { method: "PATCH", body: JSON.stringify({ active: !row.active }) });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: QuestionRow) {
    if (!confirm(`Delete question ${row.id}?`)) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/questions/${row.id}`, { method: "DELETE" });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function generate(d: string) {
    setBusy(true);
    try {
      await adminFetch("/api/admin/questions", { method: "POST", body: JSON.stringify({ difficulty: d }) });
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {["all", "easy", "normal", "hard", "expert"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDifficulty(d)}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
              difficulty === d ? "bg-neon/15 text-neon neon-border" : "glass text-inkdim hover:text-ink"
            }`}
          >
            {d}
          </button>
        ))}
        <span className="mx-2 text-inkfaint">|</span>
        {["easy", "normal", "hard", "expert"].map((d) => (
          <button
            key={`g-${d}`}
            type="button"
            disabled={busy}
            onClick={() => generate(d)}
            className="glass rounded-lg px-3 py-1.5 text-sm text-inkdim hover:text-ink disabled:opacity-50"
          >
            + generate {d}
          </button>
        ))}
      </div>

      <div className="glass overflow-hidden rounded-xl">
        <div className="grid grid-cols-[3rem_1fr_5rem_4rem_auto] items-center gap-2 border-b border-line px-4 py-2 text-[11px] uppercase text-inkdim md:grid-cols-[8rem_1fr_5rem_5rem_auto]">
          <span>Difficulty</span>
          <span>Grid</span>
          <span className="text-right">Odd cell</span>
          <span className="text-right">Status</span>
          <span className="text-right">Actions</span>
        </div>
        {rows.length === 0 && <div className="px-4 py-6 text-sm text-inkdim">No questions.</div>}
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-[3rem_1fr_5rem_4rem_auto] items-center gap-2 border-b border-line/50 px-4 py-2 text-sm last:border-0 md:grid-cols-[8rem_1fr_5rem_5rem_auto]">
            <span className="rounded bg-panel-2 px-2 py-0.5 text-[11px] font-bold text-violet">{r.difficulty.toUpperCase()}</span>
            <span className="flex items-center gap-3 truncate">
              <MiniGrid cells={r.cells} size={r.grid_size} />
              <span className="mono hidden text-[11px] text-inkfaint md:block">{r.id}</span>
            </span>
            <span className="text-right text-inkdim">{r.odd_emoji}</span>
            <span className={`text-right text-xs ${r.active ? "text-win" : "text-inkfaint"}`}>
              {r.active ? "active" : "off"}
            </span>
            <span className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => toggle(r)} className="glass rounded px-2 py-1 text-xs text-inkdim hover:text-ink">
                {r.active ? "disable" : "enable"}
              </button>
              <button type="button" disabled={busy} onClick={() => remove(r)} className="glass rounded px-2 py-1 text-xs text-lose hover:text-ink">
                delete
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DialogueTab() {
  const [data, setData] = useState<{ total: number; dialogues: Record<string, string[]>; logs: Array<Record<string, unknown>> } | null>(null);

  useEffect(() => {
    adminFetch<{ total: number; dialogues: Record<string, string[]>; logs: Array<Record<string, unknown>> }>(
      "/api/admin/dialogue",
    )
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return <p className="text-inkdim">Loading…</p>;

  const entries = useMemo(() => Object.entries(data.dialogues), [data]);

  return (
    <div>
      <p className="mb-4 text-sm text-inkdim">
        {data.total} dialogue lines across {entries.length} triggers.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {entries.map(([trigger, lines]) => (
          <div key={trigger} className="glass rounded-xl p-4">
            <div className="mono mb-2 text-sm font-bold text-neon">{trigger}</div>
            <ul className="space-y-1 text-sm text-inkdim">
              {lines.map((l, i) => (
                <li key={i}>&ldquo;{l}&rdquo;</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {data.logs.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-bold text-ink">Recent personality logs</h3>
          <div className="space-y-1">
            {data.logs.map((l, i) => (
              <div key={i} className="glass flex items-center justify-between rounded-lg px-3 py-2 text-xs text-inkdim">
                <span>
                  <span className="mono text-violet">{String(l.trigger)}</span> · {String(l.line)}
                </span>
                <span className="mono">{String(l.confidence)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
