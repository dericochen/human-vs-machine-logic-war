"use client";

import { motion } from "framer-motion";
import type { EmotionId } from "@/lib/game";

interface MaxCharacterProps {
  expression: EmotionId;
  size?: number; // px for the core
  className?: string;
}

const GLOW: Record<EmotionId, string> = {
  idle: "var(--neon)",
  thinking: "var(--neon)",
  confident: "var(--neon)",
  laughing: "var(--neon)",
  surprised: "var(--violet)",
  angry: "var(--alarm)",
  victory: "var(--gold)",
  defeated: "var(--ink-dim)",
};

function Eyes({ expression }: { expression: EmotionId }) {
  const color = GLOW[expression];
  const base = {
    display: "inline-block",
    background: color,
    transition: "background 0.3s ease, transform 0.3s ease, opacity 0.3s ease",
  } as const;

  switch (expression) {
    case "surprised":
      return (
        <span className="flex items-center gap-2">
          <span style={{ ...base, width: 14, height: 14, borderRadius: "50%" }} />
          <span style={{ ...base, width: 14, height: 14, borderRadius: "50%" }} />
        </span>
      );
    case "angry":
      return (
        <span className="flex items-center gap-2">
          <span style={{ ...base, width: 16, height: 4, borderRadius: 2, transform: "rotate(22deg)" }} />
          <span style={{ ...base, width: 16, height: 4, borderRadius: 2, transform: "rotate(-22deg)" }} />
        </span>
      );
    case "defeated":
      return (
        <span className="flex items-center gap-2 opacity-70">
          <span style={{ ...base, width: 16, height: 3, borderRadius: 2, transform: "rotate(-18deg)" }} />
          <span style={{ ...base, width: 16, height: 3, borderRadius: 2, transform: "rotate(18deg)" }} />
        </span>
      );
    case "laughing":
      return (
        <span className="flex items-center gap-2">
          <span style={{ width: 18, height: 9, borderRadius: "18px 18px 0 0", borderTop: `3px solid ${color}` }} />
          <span style={{ width: 18, height: 9, borderRadius: "18px 18px 0 0", borderTop: `3px solid ${color}` }} />
        </span>
      );
    case "confident":
      return (
        <span className="flex items-center gap-2">
          <span style={{ ...base, width: 18, height: 5, borderRadius: 3, transform: "translateY(-2px)" }} />
          <span style={{ ...base, width: 18, height: 5, borderRadius: 3, transform: "translateY(-2px)" }} />
        </span>
      );
    case "victory":
      return (
        <span className="flex items-center gap-2">
          <motion.span
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 0.6, repeat: Infinity }}
            style={{ ...base, width: 16, height: 6, borderRadius: 3, transform: "translateY(-3px)" }}
          />
          <motion.span
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
            style={{ ...base, width: 16, height: 6, borderRadius: 3, transform: "translateY(-3px)" }}
          />
        </span>
      );
    case "thinking":
      return (
        <span className="flex items-center gap-2">
          <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }} style={{ ...base, width: 12, height: 12, borderRadius: "50%" }} />
          <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }} style={{ ...base, width: 12, height: 12, borderRadius: "50%" }} />
        </span>
      );
    case "idle":
    default:
      return (
        <span className="flex items-center gap-2">
          <span className="animate-pulse-soft" style={{ ...base, width: 18, height: 5, borderRadius: 3 }} />
          <span className="animate-pulse-soft" style={{ ...base, width: 18, height: 5, borderRadius: 3 }} />
        </span>
      );
  }
}

export default function MaxCharacter({ expression, size = 96, className = "" }: MaxCharacterProps) {
  const glow = GLOW[expression];
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size * 1.7, height: size * 1.7 }} aria-label={`M.A.X. ${expression}`} role="img">
      {/* rotating scan ring */}
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ border: `1px dashed ${glow}`, opacity: 0.5 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />
      {/* glow halo */}
      <motion.span
        className="absolute rounded-full"
        style={{ width: size * 1.3, height: size * 1.3, background: glow, filter: "blur(28px)", opacity: 0.22 }}
        animate={{ opacity: expression === "victory" || expression === "angry" ? [0.22, 0.4, 0.22] : 0.22 }}
        transition={{ duration: 1.6, repeat: Infinity }}
      />
      {/* core */}
      <motion.div
        className="relative flex items-center justify-center"
        style={{
          width: size,
          height: size,
          borderRadius: "24%",
          background: "linear-gradient(180deg, var(--panel-2), var(--panel))",
          border: `1px solid ${glow}`,
          boxShadow: `0 0 0 1px ${glow}22, 0 0 26px -4px ${glow}66`,
          clipPath: "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
        }}
        animate={{ scale: expression === "victory" ? [1, 1.06, 1] : expression === "defeated" ? [1, 0.97, 1] : 1 }}
        transition={{ duration: 1.4, repeat: Infinity }}
      >
        {/* scanning line */}
        <span className="pointer-events-none absolute inset-0 overflow-hidden" style={{ borderRadius: "24%" }}>
          <span className="animate-scanline absolute inset-x-0 h-1/2" style={{ background: `linear-gradient(180deg, transparent, ${glow}33, transparent)` }} />
        </span>
        <Eyes expression={expression} />
      </motion.div>
    </div>
  );
}
