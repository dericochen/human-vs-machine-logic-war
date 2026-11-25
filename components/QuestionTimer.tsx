"use client";

import { useEffect, useRef, useState } from "react";

interface QuestionTimerProps {
  resetKey: number;
  timeLimitSec: number;
  onExpire: () => void;
}

/** Isolated per-question timer with a shrinking progress bar. */
export default function QuestionTimer({ resetKey, timeLimitSec, onExpire }: QuestionTimerProps) {
  const [frac, setFrac] = useState(1);
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    firedRef.current = false;
    setFrac(1);
  }, [resetKey]);

  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => {
      const elapsed = Date.now() - start;
      const f = Math.max(0, 1 - elapsed / (timeLimitSec * 1000));
      setFrac(f);
      if (f <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current();
        clearInterval(iv);
      }
    }, 60);
    return () => clearInterval(iv);
  }, [resetKey, timeLimitSec]);

  const pct = Math.round(frac * 100);
  const critical = pct <= 25;

  return (
    <div className="w-full" role="timer" aria-label={`${pct}% time left`}>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--panel-2)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: critical ? "var(--alarm)" : "var(--neon)",
            transition: "width 60ms linear",
          }}
        />
      </div>
    </div>
  );
}
