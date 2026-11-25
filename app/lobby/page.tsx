"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MaxCharacter from "@/components/MaxCharacter";
import { AVATARS, apiFetch, getOrCreatePlayerId } from "@/lib/client";
import { MAX_MODES, MAX_MODE_DESC, MAX_MODE_LABEL } from "@/lib/game";
import type { MaxMode, PublicRound } from "@/lib/game";
import type { StartMatchResponse } from "@/lib/db/match-service";

export default function LobbyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [maxMode, setMaxMode] = useState<MaxMode>("normal");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    const clean = name.trim();
    if (!clean) {
      setError("Enter a name to battle.");
      return;
    }
    setStarting(true);
    setError("");
    try {
      const playerId = getOrCreatePlayerId();
      const res = await apiFetch<StartMatchResponse>("/api/match/start", {
        playerId,
        playerName: clean,
        avatar,
        maxMode,
      });
      sessionStorage.setItem(
        "lw_match",
        JSON.stringify({ sessionId: res.sessionId, startedAt: res.startedAt, maxMode: res.maxMode, rounds: res.rounds }),
      );
      router.push(`/battle?session=${encodeURIComponent(res.sessionId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the match.");
      setStarting(false);
    }
  }

  return (
    <main className="grid-line min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
        <span className="neon-text mono text-lg font-black">HUMAN vs MACHINE</span>
      </header>

      <section className="mx-auto max-w-4xl px-5 pb-20">
        <h1 className="text-3xl font-black text-ink">Battle setup</h1>
        <p className="mt-1 text-inkdim">Pick a name, an avatar, and how hard M.A.X. should try.</p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="glass rounded-xl p-6">
            <label htmlFor="name" className="mb-2 block text-sm font-medium text-ink">
              Your name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="Enter a name"
              className="w-full rounded-lg border border-line bg-panel-2 px-4 py-3 text-ink placeholder:text-inkfaint focus:outline-none focus:ring-2 focus:ring-neon"
            />

            <div className="mt-5">
              <div className="mb-2 text-sm font-medium text-ink">Avatar</div>
              <div className="flex flex-wrap gap-2">
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAvatar(a)}
                    aria-pressed={avatar === a}
                    className={`flex h-12 w-12 items-center justify-center rounded-lg border text-2xl transition-transform ${
                      avatar === a ? "neon-border border-neon" : "border-line bg-panel-2 hover:scale-105"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <div className="mb-2 text-sm font-medium text-ink">M.A.X. difficulty</div>
            <div className="space-y-2">
              {MAX_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMaxMode(m)}
                  aria-pressed={maxMode === m}
                  className={`block w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                    maxMode === m ? "neon-border border-neon bg-neon/10" : "border-line bg-panel-2 hover:bg-panel"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="mono font-bold text-ink">{MAX_MODE_LABEL[m]}</span>
                    <span className="text-[11px] text-inkdim">M.A.X.</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-inkdim">{MAX_MODE_DESC[m]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="text-sm text-inkdim">
            <span className="mono text-ink">5 min</span> · 12 rounds · grids 2×2 → 5×5
          </div>
          <div className="flex items-center gap-3">
            <MaxCharacter expression={maxMode === "expert" ? "confident" : "idle"} size={72} />
            <button
              type="button"
              onClick={start}
              disabled={starting}
              className="neon-border rounded-xl bg-neon/15 px-8 py-3.5 text-base font-bold text-neon transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50"
            >
              {starting ? "STARTING…" : "START"}
            </button>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-lose">{error}</p>}
      </section>
    </main>
  );
}
