"use client";

import type { EmotionId } from "@/lib/game";

interface DialogueBubbleProps {
  line: string;
  emotion: EmotionId;
}

export default function DialogueBubble({ line, emotion }: DialogueBubbleProps) {
  return (
    <div className="glass relative rounded-xl px-4 py-3 text-sm text-ink" role="status">
      <span className="mono mb-1 block text-[10px] uppercase tracking-wide text-inkdim">
        M.A.X. · {emotion}
      </span>
      <p className="leading-snug">&ldquo;{line}&rdquo;</p>
    </div>
  );
}
