// M15 — period-over-period comparisons and the lifetime savings aggregate.
// Pure numeric functions only: date/transaction bucketing (which periods
// exist, which transactions fall in which one) is the caller's job — same
// division of labor the rest of this package already uses (calculator.ts
// takes a flat transaction list + a referenceDate, not raw notification
// data). Keeps this package free of any DB/date-bucketing dependency.

// A reduced numeric snapshot of one period — either the in-progress current
// period or an already-closed one. For a closed period, daysElapsed ==
// daysInPeriod (the period fully ran its course).
export interface PeriodSnapshot {
  readonly spendableTotal: number; // net spend so far, excl. self-transfers (calculator.ts convention)
  readonly allowancePerPeriod: number;
  readonly daysElapsed: number;
  readonly daysInPeriod: number;
}

export interface PeriodComparison {
  // Percent change vs. the previous period; null when there is no previous
  // period to compare against, or the previous value was exactly zero (a
  // percent change against zero is undefined, not "infinite" or "0%").
  readonly savingsChangePct: number | null;
  readonly spendVelocityChangePct: number | null;
  readonly projectedSavingsChangePct: number | null;
}

// "Money actually saved" for a period = the savings goal, plus whatever
// allowance went unspent (or minus whatever was overspent past it). This is
// the same quantity calculator.ts calls remainingForPeriod, redefined here
// in pure snapshot terms since a closed period never produces an
// AllowanceState (no live daily-rate/alert context to compute).
function periodSavings(s: PeriodSnapshot): number {
  return s.allowancePerPeriod - s.spendableTotal;
}

// Spend pace so far this period — mirrors calculator.ts's dailyRate/adjustedDailyRate
// framing but as "actual spend per day elapsed" rather than "budgeted spend per day".
function spendVelocity(s: PeriodSnapshot): number {
  return s.daysElapsed > 0 ? s.spendableTotal / s.daysElapsed : 0;
}

// If the current pace holds for the rest of the period, what will total
// savings look like at period-end?
function projectedSavings(s: PeriodSnapshot): number {
  const projectedSpend = spendVelocity(s) * s.daysInPeriod;
  return s.allowancePerPeriod - projectedSpend;
}

// Denominator uses Math.abs so the sign of the result always means
// "improved" (positive) / "worsened" (negative) even when the previous
// period's figure was itself negative (e.g. recovering from an overspent
// previous period reads as a large positive change, not a sign-flipped one).
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function comparePeriods(
  current: PeriodSnapshot,
  previous: PeriodSnapshot | null,
): PeriodComparison {
  if (previous === null) {
    return { savingsChangePct: null, spendVelocityChangePct: null, projectedSavingsChangePct: null };
  }

  return {
    savingsChangePct: pctChange(periodSavings(current), periodSavings(previous)),
    spendVelocityChangePct: pctChange(spendVelocity(current), spendVelocity(previous)),
    projectedSavingsChangePct: pctChange(projectedSavings(current), projectedSavings(previous)),
  };
}

// Sum of realized per-period savings across however many closed periods the
// caller supplies (each figure is that period's periodSavings(), i.e. what
// remainingForPeriod would have been for that period). A simple sum, kept as
// a named function so callers don't reimplement "what does lifetime savings
// mean" independently — matches the M15-T5 spec (M15's Total Savings row).
export function getLifetimeSavings(periodSavingsAmounts: readonly number[]): number {
  return periodSavingsAmounts.reduce((sum, amount) => sum + amount, 0);
}
