"use client";

import { useEffect, useRef, useState } from "react";
import { MATCH_DURATION_SEC } from "@/lib/game";

interface GameTimerProps {
  startedAt: string;
  onExpire: () => void;
  onFinalCountdown?: () => void;
}

/** Isolated 5-minute match timer. Re-renders only itself, not the page. */
export default function GameTimer({ startedAt, onExpire, onFinalCountdown }: GameTimerProps) {
  const [remaining, setRemaining] = useState(MATCH_DURATION_SEC);
  const expiredRef = useRef(false);
  const finalRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  const onFinalRef = useRef(onFinalCountdown);
  onExpireRef.current = onExpire;
  onFinalRef.current = onFinalCountdown;

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => {
      const r = Math.max(0, Math.ceil((MATCH_DURATION_SEC * 1000 - (Date.now() - start)) / 1000));
      setRemaining(r);
      if (r <= 10 && !finalRef.current) {
        finalRef.current = true;
        onFinalRef.current?.();
      }
      if (r <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current();
      }
    };
    tick();
    const iv = setInterval(tick, 200);
    return () => clearInterval(iv);
  }, [startedAt]);

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const critical = remaining <= 10;

  return (
    <div
      className={`mono flex items-center gap-1 rounded-lg px-3 py-1.5 text-xl font-semibold tabular-nums ${
        critical ? "text-alarm animate-blink-soft" : "text-neon"
      }`}
      role="timer"
      aria-live="off"
    >
      <span className="text-inkdim text-xs">MATCH</span>
      {mm}:{String(ss).padStart(2, "0")}
    </div>
  );
}
