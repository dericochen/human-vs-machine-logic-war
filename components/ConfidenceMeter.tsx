"use client";

interface ConfidenceMeterProps {
  value: number; // 0..100
}

export default function ConfidenceMeter({ value }: ConfidenceMeterProps) {
  const v = Math.max(5, Math.min(95, value));
  const color = v >= 60 ? "var(--neon)" : v >= 40 ? "var(--violet)" : "var(--alarm)";
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-inkdim">
        <span>M.A.X. confidence</span>
        <span className="mono tabular-nums" style={{ color }}>
          {v}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--panel-2)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${v}%`, background: color, transition: "width 0.4s ease, background 0.4s ease" }}
        />
      </div>
    </div>
  );
}
