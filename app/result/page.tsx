"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MaxCharacter from "@/components/MaxCharacter";
import { createRng, snapshot, DIFFICULTIES } from "@/lib/game";
import type { EmotionId, MatchSummary } from "@/lib/game";

export default function ResultPage() {
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [emotion, setEmotion] = useState<EmotionId>("idle");

  useEffect(() => {
    const raw = sessionStorage.getItem("lw_summary");
    const rk = sessionStorage.getItem("lw_rank");
    if (raw) setSummary(JSON.parse(raw) as MatchSummary);
    if (rk) setRank(Number(rk));

    if (raw) {
      const s = JSON.parse(raw) as MatchSummary;
      const rng = createRng("result");
      const trigger = s.winner === "human" ? "max_defeat" : s.winner === "machine" ? "max_victory" : "draw";
      const snap = snapshot(trigger, {
        trigger,
        playerScore: s.playerScore,
        maxScore: s.maxScore,
        scoreDiff: s.playerScore - s.maxScore,
        playerCorrect: s.correctCount,
        playerWrong: s.wrongCount,
        playerBlank: s.blankCount,
        streak: 0,
        maxStreak: 12,
        maxCorrect: 12,
        timeRemainingSec: 0,
        difficulty: null,
        confidence: 50,
      }, rng, new Set());
      setComment(snap.line);
      setEmotion(snap.emotion);
    }
  }, []);

  if (!summary) {
    return (
      <main className="grid-line flex min-h-screen items-center justify-center px-5">
        <div className="glass max-w-sm rounded-xl p-8 text-center">
          <p className="text-inkdim">No match result found.</p>
          <Link href="/lobby" className="neon-border mt-6 inline-block rounded-xl bg-neon/15 px-6 py-3 font-bold text-neon">
            Start a battle
          </Link>
        </div>
      </main>
    );
  }

  const won = summary.winner === "human";
  const title = won ? "YOU WIN" : summary.winner === "machine" ? "M.A.X. WINS" : "DRAW";
  const titleColor = won ? "var(--win)" : summary.winner === "machine" ? "var(--lose)" : "var(--ink-dim)";

  const stat = (label: string, value: string | number, accent?: string) => (
    <div className="glass rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wide text-inkdim">{label}</div>
      <div className="mono mt-1 text-xl font-bold tabular-nums" style={{ color: accent ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );

  return (
    <main className="grid-line min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
        <span className="neon-text mono text-lg font-black">HUMAN vs MACHINE</span>
        <Link href="/leaderboard" className="text-sm text-inkdim hover:text-ink">
          Leaderboard
        </Link>
      </header>

      <section className="mx-auto max-w-4xl px-5 pb-20">
        <div className="glass overflow-hidden rounded-2xl p-8 text-center">
          <MaxCharacter expression={emotion} size={110} className="mb-2" />
          <h1 className="text-5xl font-black tracking-tight" style={{ color: titleColor }}>
            {title}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-inkdim">&ldquo;{comment}&rdquo;</p>
          <div className="mt-6 flex items-center justify-center gap-6">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-inkdim">You</div>
              <div className="mono text-4xl font-black text-neon">{summary.playerScore}</div>
            </div>
            <div className="text-inkfaint">vs</div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-inkdim">M.A.X.</div>
              <div className="mono text-4xl font-black text-violet">{summary.maxScore}</div>
            </div>
          </div>
          {rank !== null && rank > 0 && (
            <p className="mt-4 text-sm text-inkdim">
              Leaderboard position: <span className="mono text-gold">#{rank}</span>
            </p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {stat("Correct", summary.correctCount, "var(--win)")}
          {stat("Wrong", summary.wrongCount, "var(--lose)")}
          {stat("Accuracy", `${summary.accuracy}%`)}
          {stat("Avg answer", `${(summary.avgAnswerMs / 1000).toFixed(1)}s`)}
          {stat("Best streak", summary.bestStreak)}
          {stat("Hardest solved", summary.hardestSolved ? DIFFICULTIES[summary.hardestSolved].label : "-")}
          {stat("M.A.X. mode", DIFFICULTIES[summary.maxMode]?.label ?? summary.maxMode)}
        </div>

        <div className="mt-8">
          <h2 className="mb-3 text-xl font-bold text-ink">Round breakdown</h2>
          <div className="space-y-2">
            {summary.breakdown.map((b) => (
              <div key={b.index} className="glass rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="mono text-inkdim">#{b.index + 1}</span>
                    <span className="rounded bg-panel-2 px-2 py-0.5 text-[11px] font-bold text-violet">
                      {DIFFICULTIES[b.difficulty]?.label ?? b.difficulty} · {b.gridSize}×{b.gridSize}
                    </span>
                    <span className="text-inkdim">
                      odd: <span className="text-ink">{b.oddEmoji}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="mono text-sm tabular-nums text-inkdim">{b.points > 0 ? `+${b.points}` : b.points}</span>
                    <span
                      className={`mono text-xs font-bold ${
                        b.outcome === "correct" ? "text-win" : b.outcome === "wrong" ? "text-lose" : "text-inkfaint"
                      }`}
                    >
                      {b.outcome.toUpperCase()}
                    </span>
                  </div>
                </div>
                {b.outcome !== "correct" && (
                  <p className="mt-2 text-xs text-inkdim">{b.explanation}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/lobby" className="neon-border rounded-xl bg-neon/15 px-8 py-3.5 font-bold text-neon transition-transform hover:scale-[1.03]">
            PLAY AGAIN
          </Link>
          <Link href="/leaderboard" className="glass rounded-xl px-8 py-3.5 font-bold text-ink transition-transform hover:scale-[1.03]">
            LEADERBOARD
          </Link>
        </div>
      </section>
    </main>
  );
}
