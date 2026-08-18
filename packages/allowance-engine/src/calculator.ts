import { Temporal } from '@js-temporal/polyfill';
import { getDaysInPeriod, getDaysElapsed } from './period';

// Types defined locally — keeps allowance-engine free of cross-package dependencies.
export type AllowancePeriod = 'weekly' | 'monthly';

export interface AllowanceTx {
  readonly type: string;
  readonly amount: number; // negative = outgoing, positive = incoming (parser convention)
  // Pending self-transfers are provisionally excluded from spendable_total.
  // They re-enter spending if their status later becomes 'expired'.
  readonly selfTransferStatus?: 'pending' | 'confirmed' | 'rejected' | 'expired' | '';
}

export interface CalculatorInput {
  readonly monthlyIncomeEstimate: number;
  readonly fixedMonthlyExpenses: number; // rent, bills, subscriptions — excluded before allowance
  readonly savingsGoalAmount: number;
  readonly period: AllowancePeriod;
  readonly alertThreshold: number; // e.g. 0.20 → alert when ≤ 20% remaining
  readonly transactions: ReadonlyArray<AllowanceTx>;
  readonly referenceDate?: Temporal.ZonedDateTime; // omit in production; inject in tests
}

export interface AllowanceState {
  readonly allowancePerPeriod: number;
  readonly dailyRate: number;
  readonly elapsedAllowance: number;
  readonly spendableTotal: number;
  readonly remainingAllowance: number;
  readonly overspend: boolean;
  readonly alertTriggered: boolean;
  // Period-level remaining — independent of elapsed time.
  // Answers "how much can I still spend this period total?" (can go negative).
  readonly remainingForPeriod: number;
  // Calendar days left until the period resets.
  readonly daysRemaining: number;
  // Adjusted daily budget given current spending pace.
  // Answers "what should I target per day for the rest of the period?"
  // Negative when remainingForPeriod < 0 (period budget fully exhausted).
  readonly adjustedDailyRate: number;
}

const SELF_TRANSFER_TYPES = new Set(['SELF_TRANSFER_OUT', 'SELF_TRANSFER_IN']);

// spendable_total = net outflow (positive means net spending). Outgoing
// amounts are negative per parser convention, so we negate the sum.
// Self-transfer types and pending self-transfers are always excluded.
// Extracted so M15's period-over-period comparisons (a closed prior period
// has no daily-rate/alert context to compute, just this one number) can
// reuse the exact same exclusion rules instead of re-implementing them.
export function computeSpendableTotal(transactions: readonly AllowanceTx[]): number {
  let rawSum = 0;
  for (const tx of transactions) {
    if (SELF_TRANSFER_TYPES.has(tx.type)) continue;
    if (tx.selfTransferStatus === 'pending') continue;
    rawSum += tx.amount;
  }
  return -rawSum;
}

export function calculateAllowance(input: CalculatorInput): AllowanceState {
  const {
    monthlyIncomeEstimate,
    fixedMonthlyExpenses,
    savingsGoalAmount,
    period,
    alertThreshold,
    transactions,
    referenceDate,
  } = input;

  const allowancePerPeriod = monthlyIncomeEstimate - fixedMonthlyExpenses - savingsGoalAmount;
  const daysInPeriod = getDaysInPeriod(period, referenceDate);
  const daysElapsed = getDaysElapsed(period, referenceDate);
  const dailyRate = allowancePerPeriod / daysInPeriod;
  const elapsedAllowance = dailyRate * daysElapsed;

  const spendableTotal = computeSpendableTotal(transactions);

  const remainingAllowance = elapsedAllowance - spendableTotal;
  const overspend = remainingAllowance < 0;

  // Guard against division by zero at the very start of a period.
  const alertTriggered =
    elapsedAllowance > 0 &&
    remainingAllowance / elapsedAllowance <= alertThreshold;

  const remainingForPeriod = allowancePerPeriod - spendableTotal;
  const daysRemaining = daysInPeriod - daysElapsed;
  // istanbul ignore next — daysRemaining ≤ 0 is unreachable in normal use;
  // period resets before elapsed can equal daysInPeriod.
  const adjustedDailyRate = daysRemaining > 0 ? remainingForPeriod / daysRemaining : 0;

  return {
    allowancePerPeriod,
    dailyRate,
    elapsedAllowance,
    spendableTotal,
    remainingAllowance,
    overspend,
    alertTriggered,
    remainingForPeriod,
    daysRemaining,
    adjustedDailyRate,
  };
}
