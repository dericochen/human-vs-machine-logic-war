// Answer normalization and comparison. Shared by validation (server), the
// M.A.X. solver, and unit tests so a "correct" answer is compared consistently.

export function normalizeAnswer(value: string | null | undefined): string {
  if (value == null) return "";
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]$/g, "");
}

function toNumber(value: string): number | null {
  const s = value.replace(/,/g, "").replace(/\s+/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compare two answers, tolerating numeric equivalence ("42" == "42.0") and
 * cosmetic whitespace/case differences for text answers.
 */
export function answersMatch(a: string, b: string): boolean {
  const na = normalizeAnswer(a);
  const nb = normalizeAnswer(b);
  if (na === nb) return true;

  const naNum = toNumber(na);
  const nbNum = toNumber(nb);
  if (naNum !== null && nbNum !== null) {
    // Tolerate tiny float drift from solver arithmetic.
    const tol = Math.max(1e-6, Math.abs(naNum) * 1e-9);
    return Math.abs(naNum - nbNum) < tol;
  }
  return false;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Format a number of milliseconds as seconds with one decimal. */
export function msToSec(ms: number): number {
  return round1(ms / 1000);
}
