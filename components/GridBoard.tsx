"use client";

const GRID_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};
// Emoji glyphs scale with the grid so subtle differences stay visible and each
// cell is a large, easy tap target.
const CELL_TEXT: Record<number, string> = {
  2: "text-7xl sm:text-8xl",
  3: "text-6xl sm:text-7xl",
  4: "text-5xl sm:text-6xl",
  5: "text-4xl sm:text-5xl",
};

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
  const cellText = CELL_TEXT[gridSize] ?? "text-4xl";

  return (
    <div className={`mx-auto grid w-full max-w-[560px] touch-manipulation select-none gap-1.5 sm:gap-2 ${cols}`}>
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
            className={`flex aspect-square items-center justify-center rounded-xl border leading-none transition-colors ${
              isOdd
                ? "border-win bg-win/15"
                : isWrongPick
                  ? "border-lose bg-lose/15"
                  : "border-line bg-panel-2 hover:bg-panel active:bg-neon/15"
            } ${disabled || reveal ? "" : "cursor-pointer"}`}
          >
            <span className={`${cellText} leading-none`} style={{ transform: isOdd || isWrongPick ? "scale(1.08)" : undefined }}>
              {cell}
            </span>
          </button>
        );
      })}
    </div>
  );
}
