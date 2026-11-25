"use client";

const GRID_COLS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" };
const CELL_TEXT: Record<number, string> = { 2: "text-5xl", 3: "text-4xl", 4: "text-3xl", 5: "text-2xl" };

interface GridBoardProps {
  cells: string[];
  gridSize: number;
  disabled?: boolean;
  onPick?: (index: number) => void;
  /** When set, reveal mode: highlight the odd cell (green) and a wrong pick (red). */
  oddIndex?: number | null;
  pickedIndex?: number | null;
}

export default function GridBoard({ cells, gridSize, disabled, onPick, oddIndex, pickedIndex }: GridBoardProps) {
  const reveal = oddIndex !== null && oddIndex !== undefined;
  const cols = GRID_COLS[gridSize] ?? "grid-cols-5";
  const cellText = CELL_TEXT[gridSize] ?? "text-2xl";

  return (
    <div className={`grid ${cols} gap-2`}>
      {cells.map((cell, i) => {
        const isOdd = reveal && i === oddIndex;
        const isWrongPick = reveal && i === pickedIndex && i !== oddIndex;
        return (
          <button
            key={i}
            type="button"
            disabled={disabled || reveal}
            onClick={() => onPick?.(i)}
            aria-label={`cell ${i + 1}`}
            className={`flex aspect-square items-center justify-center rounded-xl border transition-transform ${
              isOdd
                ? "border-win bg-win/10"
                : isWrongPick
                  ? "border-lose bg-lose/10"
                  : "border-line bg-panel-2 hover:bg-panel"
            } ${disabled || reveal ? "" : "active:scale-95"}`}
            style={{ transform: isOdd || isWrongPick ? "scale(1.03)" : undefined }}
          >
            <span className={cellText}>{cell}</span>
          </button>
        );
      })}
    </div>
  );
}
