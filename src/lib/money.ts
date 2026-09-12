/** Parse a backend decimal string ("12.50") into a number; NaN-safe. */
export function num(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === "") return 0;
  const n = typeof raw === "number" ? raw : parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Two decimals as a string for API bodies. */
export function fixed(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** "12.50 ₾" */
export function money(raw: string | number | null | undefined): string {
  return `${num(raw).toFixed(2)} ₾`;
}

/** Cash-tender suggestions: exact, then the next round notes. */
export function tenderSuggestions(due: number): number[] {
  const out: number[] = [Math.ceil(due * 100) / 100];
  for (const step of [5, 10, 20, 50, 100]) {
    const candidate = Math.ceil(due / step) * step;
    if (candidate > due && !out.includes(candidate)) out.push(candidate);
    if (out.length >= 5) break;
  }
  return out;
}
