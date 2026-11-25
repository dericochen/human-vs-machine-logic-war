"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MaxCharacter from "@/components/MaxCharacter";
import GameTimer from "@/components/GameTimer";
import QuestionTimer from "@/components/QuestionTimer";
import ConfidenceMeter from "@/components/ConfidenceMeter";
import DialogueBubble from "@/components/DialogueBubble";
import GridBoard from "@/components/GridBoard";
import Countdown from "@/components/Countdown";
import MuteControls from "@/components/MuteControls";
import { useAudio } from "@/components/AudioProvider";
import { apiFetch } from "@/lib/client";
import {
  DIFFICULTIES,
  MATCH_DURATION_SEC,
  createRng,
  difficultyForIndex,
  snapshot,
} from "@/lib/game";
import type { AnswerOutcome, DialogueContext, DialogueTrigger, EmotionId, MaxMode, PublicRound } from "@/lib/game";
import type { AnswerResponse, FinishResponse, RecoverResponse } from "@/lib/db/match-service";

type Phase = "loading" | "countdown" | "playing" | "error";

interface StoredMatch {
  sessionId: string;
  startedAt: string;
  maxMode: MaxMode;
  rounds: PublicRound[];
}

export default function BattlePage() {
  const router = useRouter();
  const audio = useAudio();

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [rounds, setRounds] = useState<PublicRound[]>([]);
  const [maxMode, setMaxMode] = useState<MaxMode>("normal");
  const [sessionId, setSessionId] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  const [maxConfidence, setMaxConfidence] = useState(50);
  const [emotion, setEmotion] = useState<EmotionId>("idle");
  const [line, setLine] = useState("Ready when you are.");
  const [reveal, setReveal] = useState<{ oddIndex: number; pickedIndex: number | null } | null>(null);
  const [flash, setFlash] = useState<AnswerOutcome | null>(null);

  // player + max counters (for dialogue context)
  const [playerCorrect, setPlayerCorrect] = useState(0);
  const [playerWrong, setPlayerWrong] = useState(0);
  const [playerBlank, setPlayerBlank] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxCorrect, setMaxCorrect] = useState(0);

  const answeringRef = useRef(false);
  const finishingRef = useRef(false);
  const rngRef = useRef(createRng("battle-dialogue"));
  const usedRef = useRef(new Set<string>());

  const latest = useRef({ playerScore: 0, maxScore: 0, playerCorrect: 0, playerWrong: 0, playerBlank: 0, streak: 0, maxCorrect: 0, currentIndex: 0 });
  latest.current = { playerScore, maxScore, playerCorrect, playerWrong, playerBlank, streak, maxCorrect, currentIndex };

  function say(trigger: DialogueTrigger, extra?: Partial<DialogueContext>) {
    const l = latest.current;
    const ctx: DialogueContext = {
      trigger,
      playerScore: l.playerScore,
      maxScore: l.maxScore,
      scoreDiff: l.playerScore - l.maxScore,
      playerCorrect: l.playerCorrect,
      playerWrong: l.playerWrong,
      playerBlank: l.playerBlank,
      streak: l.streak,
      maxStreak: 0,
      maxCorrect: l.maxCorrect,
      timeRemainingSec: extra?.timeRemainingSec ?? 300,
      difficulty: extra?.difficulty ?? (rounds[l.currentIndex]?.difficulty ?? null),
      confidence: 50,
    };
    const s = snapshot(trigger, ctx, rngRef.current, usedRef.current);
    setEmotion(s.emotion);
    setLine(s.line);
  }

  async function finishMatch() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    try {
      const res = await apiFetch<FinishResponse>("/api/match/finish", { sessionId });
      audio.stopMusic();
      audio.play(res.summary.winner === "human" ? "victory" : res.summary.winner === "machine" ? "defeat" : "click");
      sessionStorage.setItem("lw_summary", JSON.stringify(res.summary));
      sessionStorage.setItem("lw_rank", String(res.rank ?? ""));
      sessionStorage.removeItem("lw_match");
      router.replace("/result");
    } catch (e) {
      finishingRef.current = false;
      setError(e instanceof Error ? e.message : "Could not finish the match.");
    }
  }

  async function submit(cellIndex: number | null) {
    if (phase !== "playing" || answeringRef.current || reveal) return;
    answeringRef.current = true;
    const round = rounds[currentIndex];
    const prePlayer = latest.current.playerScore;
    const preMax = latest.current.maxScore;
    try {
      const res = await apiFetch<AnswerResponse>("/api/match/answer", {
        sessionId,
        index: currentIndex,
        cellIndex,
      });

      const isCorrect = res.outcome === "correct";
      const nStreak = isCorrect ? streak + 1 : 0;
      const nCorrect = playerCorrect + (isCorrect ? 1 : 0);
      const nWrong = playerWrong + (res.outcome === "wrong" ? 1 : 0);
      const nBlank = playerBlank + (res.outcome === "blank" ? 1 : 0);
      const nMaxCorrect = maxCorrect + (res.maxResult?.outcome === "correct" ? 1 : 0);

      setPlayerCorrect(nCorrect);
      setPlayerWrong(nWrong);
      setPlayerBlank(nBlank);
      setStreak(nStreak);
      setMaxCorrect(nMaxCorrect);
      setPlayerScore(res.playerScore);
      setMaxScore(res.maxScore);
      setMaxConfidence(res.maxConfidence);
      setReveal({ oddIndex: res.oddIndex, pickedIndex: cellIndex });
      setFlash(res.outcome);

      audio.play(res.outcome === "correct" ? "correct" : res.outcome === "wrong" ? "wrong" : "click");

      // overtake detection
      const wasLeading = prePlayer > preMax;
      const isLeading = res.playerScore > res.maxScore;
      if (wasLeading !== isLeading) {
        say(isLeading ? "player_overtake" : "max_overtake", { playerScore: res.playerScore, maxScore: res.maxScore });
      } else {
        say(res.outcome === "correct" ? "player_correct" : res.outcome === "wrong" ? "player_wrong" : "player_blank", {
          playerScore: res.playerScore,
          maxScore: res.maxScore,
        });
      }

      const nextDifficulty = res.nextIndex < rounds.length ? rounds[res.nextIndex].difficulty : null;

      setTimeout(() => {
        if (res.finished) {
          finishMatch();
        } else {
          setReveal(null);
          setFlash(null);
          setCurrentIndex(res.nextIndex);
          if (nextDifficulty && nextDifficulty !== round.difficulty) {
            audio.play("stageUp");
            say("stage_up", { difficulty: nextDifficulty });
          }
          answeringRef.current = false;
        }
      }, 950);
    } catch (e) {
      answeringRef.current = false;
      setError(e instanceof Error ? e.message : "Connection issue. Check your network.");
    }
  }

  // Recover authoritative state on mount (or on refresh / reconnect).
  useEffect(() => {
    let cancelled = false;
    const storedRaw = sessionStorage.getItem("lw_match");
    const stored: StoredMatch | null = storedRaw ? (JSON.parse(storedRaw) as StoredMatch) : null;
    const sid = stored?.sessionId;
    if (!sid) {
      setPhase("error");
      setError("No active match. Start a new battle.");
      return;
    }
    setSessionId(sid);
    apiFetch<RecoverResponse>("/api/match/recover", { sessionId: sid })
      .then((r) => {
        if (cancelled) return;
        if (r.status === "finished" && r.summary) {
          sessionStorage.setItem("lw_summary", JSON.stringify(r.summary));
          sessionStorage.removeItem("lw_match");
          router.replace("/result");
          return;
        }
        if (r.status === "active" && r.rounds) {
          setRounds(r.rounds);
          setStartedAt(r.startedAt ?? stored?.startedAt ?? new Date().toISOString());
          setMaxMode(r.maxMode ?? stored?.maxMode ?? "normal");
          setCurrentIndex(r.currentIndex ?? 0);
          setPlayerScore(r.playerScore ?? 0);
          setMaxScore(r.maxScore ?? 0);
          setMaxConfidence(r.maxConfidence ?? 50);
          setPhase((r.currentIndex ?? 0) === 0 ? "countdown" : "playing");
          if ((r.currentIndex ?? 0) > 0) {
            setLine("Reconnected. Where were we?");
            setEmotion("thinking");
          }
        } else {
          setPhase("error");
          setError("Could not load the match.");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setPhase("error");
          setError(e instanceof Error ? e.message : "Could not reconnect.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleCountdownDone() {
    setPhase("playing");
    audio.startMusic();
    audio.play("start");
    say("match_start");
  }

  function handleMatchExpire() {
    audio.setIntensity(10);
    finishMatch();
  }

  function handleFinalCountdown() {
    audio.setIntensity(10);
    say("final_countdown", { timeRemainingSec: 10 });
  }

  if (phase === "loading") {
    return (
      <main className="grid-line flex min-h-screen items-center justify-center">
        <div className="text-center">
          <MaxCharacter expression="thinking" size={96} />
          <p className="mt-4 text-sm text-inkdim">Loading battle…</p>
        </div>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="grid-line flex min-h-screen items-center justify-center px-5">
        <div className="glass max-w-sm rounded-xl p-8 text-center">
          <MaxCharacter expression="defeated" size={80} className="mb-4" />
          <p className="text-lose">{error || "Something went wrong."}</p>
          <a href="/lobby" className="neon-border mt-6 inline-block rounded-xl bg-neon/15 px-6 py-3 font-bold text-neon">
            Back to lobby
          </a>
        </div>
      </main>
    );
  }

  if (phase === "countdown") {
    return (
      <main className="grid-line min-h-screen">
        <Countdown onDone={handleCountdownDone} />
      </main>
    );
  }

  const round = rounds[currentIndex];
  const lead = playerScore > maxScore ? "YOU LEAD" : playerScore < maxScore ? "M.A.X. LEADS" : "TIED";
  const leadColor = playerScore > maxScore ? "var(--neon)" : playerScore < maxScore ? "var(--violet)" : "var(--ink-dim)";

  return (
    <main className="grid-line min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="neon-text mono hidden text-sm font-black sm:block">HUMAN vs MACHINE</span>
          <GameTimer startedAt={startedAt} onExpire={handleMatchExpire} onFinalCountdown={handleFinalCountdown} />
        </div>
        <div className="flex items-center gap-3">
          <span className="mono rounded-lg bg-panel-2 px-3 py-1.5 text-sm tabular-nums text-inkdim">
            ROUND {currentIndex + 1}/{rounds.length}
          </span>
          <span className="rounded-lg bg-panel-2 px-3 py-1.5 text-xs font-bold text-violet">
            {DIFFICULTIES[round?.difficulty]?.label ?? "EASY"} · {round?.gridSize}×{round?.gridSize}
          </span>
          <MuteControls />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-2">
        {/* Scoreboard — always visible, compact */}
        <div className="glass mb-3 flex items-center gap-4 rounded-xl px-4 py-2.5">
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-wide text-inkdim">You</div>
            <div className="mono text-2xl font-black tabular-nums text-neon">{playerScore}</div>
          </div>
          <div className="text-center text-[11px] uppercase tracking-wide" style={{ color: leadColor }}>
            {lead}
          </div>
          <div className="flex-1 text-right">
            <div className="text-[11px] uppercase tracking-wide text-inkdim">M.A.X.</div>
            <div className="mono text-2xl font-black tabular-nums text-violet">{maxScore}</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)] lg:items-start">
          {/* Grid — the main stage. First on mobile, right column on desktop. */}
          <div className="order-1 lg:order-2">
            <div className="mb-2 flex items-center justify-between text-xs text-inkdim">
              <span className="uppercase tracking-wide">Find the different emoji</span>
              {flash && (
                <span
                  className={`mono text-sm font-bold ${
                    flash === "correct" ? "text-win" : flash === "wrong" ? "text-lose" : "text-inkdim"
                  }`}
                >
                  {flash === "correct" ? "CORRECT" : flash === "wrong" ? "WRONG" : "TIME UP"}
                </span>
              )}
            </div>
            <GridBoard
              cells={round?.cells ?? []}
              gridSize={round?.gridSize ?? 2}
              onPick={submit}
              disabled={!!reveal}
              oddIndex={reveal?.oddIndex ?? null}
              pickedIndex={reveal?.pickedIndex ?? null}
            />
            <div className="mt-3">
              <QuestionTimer
                resetKey={currentIndex}
                timeLimitSec={round?.timeLimitSec ?? MATCH_DURATION_SEC}
                onExpire={() => submit(null)}
              />
            </div>
          </div>

          {/* M.A.X. panel — below grid on mobile, left column on desktop. */}
          <div className="order-2 lg:order-1">
            <div className="glass rounded-xl p-3.5">
              <div className="flex items-center gap-3">
                <MaxCharacter expression={emotion} size={88} />
                <div className="min-w-0 flex-1">
                  <DialogueBubble line={line} emotion={emotion} />
                </div>
              </div>
              <div className="mt-3">
                <ConfidenceMeter value={maxConfidence} />
              </div>
            </div>
            <div className="glass mt-4 hidden rounded-xl p-4 lg:block">
              <h2 className="mb-2 text-sm font-bold text-ink">How to win</h2>
              <ul className="space-y-2 text-sm text-inkdim">
                <li>Tap the one emoji that is different from the rest.</li>
                <li>Faster taps earn a speed bonus; streaks add more.</li>
                <li>M.A.X. runs at maximum ability — its time is simulated.</li>
                <li>12 rounds. 5 minutes. Whoever scores more, wins.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
