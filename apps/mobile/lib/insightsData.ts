import type { TransactionTableRow } from '@finwiz/obsidian-client';
import type { TransactionRecord } from './transactionUtils';

const SELF_TRANSFER_TYPES = new Set(['SELF_TRANSFER_OUT', 'SELF_TRANSFER_IN']);

// M15 — Insights chart bucketing, bar coloring, and the two installment
// bullets. Pure functions over already-fetched transaction rows: date-range
// SQL and React Query orchestration stay in hooks/useInsights.ts, mirroring
// the rest of this codebase's split (lib/ = pure & unit-testable,
// hooks/app = data-fetching & rendering).

export type ChartGranularity = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'lifetime';

export interface PeriodBucket {
  readonly key: string; // sortable, unique within a bucket list
  readonly label: string; // short display label, e.g. "Aug", "Q3 26", "2026"
  readonly startDate: string; // YYYY-MM-DD, inclusive
  readonly endDate: string; // YYYY-MM-DD, exclusive
  readonly spent: number; // net spend excl. self-transfers, positive number
  // allowancePerPeriod - spent (same quantity calculator.ts calls
  // remainingForPeriod — kept as the one definition of "saved" throughout
  // M15: this bucket's bar height on the Money Saved chart, its pass/fail
  // signal for that chart's coloring, and the exact figure summed into the
  // Total Savings row via allowance-engine's getLifetimeSavings(). One
  // number, three places, deliberately never redefined differently between
  // them (the savingsGoalAmount itself was already carved out of income
  // before allowancePerPeriod was computed, so it doesn't need to be added
  // back in here — see calculator.ts's own formula).
  readonly remainingForPeriod: number;
  readonly allowancePerPeriod: number;
  readonly savingsGoalAmount: number;
  readonly isCurrent: boolean; // the in-progress (partial) bucket
}

export type UsageColor = 'success' | 'alert' | 'primary' | 'primaryDark';
export type SavedColor = 'success' | 'alert' | 'primaryDark';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Local-date formatting (not toISOString, which shifts to UTC and can land
// on the wrong calendar day for negative-UTC-offset timezones like BRT).
// Matches the convention ingestionPipeline.ts's transactionToRow already
// established for the `date` column itself.
function toDateString(d: Date): string {
  return `${String(d.getFullYear())}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Monday-start-of-week, matching allowance-engine's weekly period
// convention (period.ts: Temporal dayOfWeek Mon=1..Sun=7, translated here to
// JS Date's Sun=0..Sat=6).
function mondayOf(d: Date): Date {
  const day = d.getDay();
  const diffFromMonday = day === 0 ? 6 : day - 1;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diffFromMonday);
}

interface BucketRange {
  key: string;
  label: string;
  start: Date;
  end: Date; // exclusive
}

// Returns `count` trailing bucket ranges, oldest first, ending with the
// bucket that contains `referenceDate`. 'lifetime' always returns exactly
// one bucket spanning all of history, regardless of `count`.
function bucketRanges(granularity: ChartGranularity, count: number, referenceDate: Date): BucketRange[] {
  if (granularity === 'lifetime') {
    return [
      {
        key: 'lifetime',
        label: 'All time',
        start: new Date(1970, 0, 1),
        end: new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() + 1),
      },
    ];
  }

  const ranges: BucketRange[] = [];

  for (let i = count - 1; i >= 0; i--) {
    if (granularity === 'monthly') {
      const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
      const monthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i + 1, 1);
      ranges.push({
        key: `${String(monthStart.getFullYear())}-${pad2(monthStart.getMonth() + 1)}`,
        label: MONTH_LABELS[monthStart.getMonth()] ?? '',
        start: monthStart,
        end: monthEnd,
      });
    } else if (granularity === 'weekly') {
      const start = new Date(mondayOf(referenceDate));
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      ranges.push({
        key: toDateString(start),
        label: `${MONTH_LABELS[start.getMonth()] ?? ''} ${String(start.getDate())}`,
        start,
        end,
      });
    } else if (granularity === 'quarterly') {
      const refQuarterIndex = Math.floor(referenceDate.getMonth() / 3) - i;
      const start = new Date(referenceDate.getFullYear(), refQuarterIndex * 3, 1);
      const end = new Date(referenceDate.getFullYear(), refQuarterIndex * 3 + 3, 1);
      const quarterNum = Math.floor(start.getMonth() / 3) + 1;
      ranges.push({
        key: `${String(start.getFullYear())}-Q${String(quarterNum)}`,
        label: `Q${String(quarterNum)} '${String(start.getFullYear()).slice(2)}`,
        start,
        end,
      });
    } else {
      // yearly
      const start = new Date(referenceDate.getFullYear() - i, 0, 1);
      const end = new Date(referenceDate.getFullYear() - i + 1, 0, 1);
      ranges.push({ key: String(start.getFullYear()), label: String(start.getFullYear()), start, end });
    }
  }

  return ranges;
}

// The date range a caller needs to query from SQLite to have enough rows to
// bucket `count` trailing periods of `granularity` — reuses the exact same
// range math bucketTransactions() itself uses, so the two never drift.
export function getChartDateRange(
  granularity: ChartGranularity,
  count: number,
  referenceDate: Date = new Date(),
): { start: string; end: string } {
  const ranges = bucketRanges(granularity, granularity === 'lifetime' ? 1 : count, referenceDate);
  return {
    start: toDateString(ranges[0].start),
    end: toDateString(ranges[ranges.length - 1].end),
  };
}

function isSpendable(type: string): boolean {
  return !SELF_TRANSFER_TYPES.has(type);
}

export interface BucketConfig {
  readonly allowancePerPeriod: number;
  readonly savingsGoalAmount: number;
}

// Buckets `txs` into `count` trailing periods of the given granularity,
// ending with whichever bucket contains `referenceDate` (marked isCurrent).
// `config` (the user's *current* allowance settings) is applied uniformly
// across every bucket, including historical ones — the app doesn't keep a
// history of past config values, so a past income/savings-goal change isn't
// reflected retroactively in older bars. Documented simplification, not an
// oversight: tracked as a known limitation rather than fabricated history.
export function bucketTransactions(
  txs: readonly Pick<TransactionTableRow, 'date' | 'type' | 'amount'>[],
  granularity: ChartGranularity,
  count: number,
  config: BucketConfig,
  referenceDate: Date = new Date(),
): PeriodBucket[] {
  const ranges = bucketRanges(granularity, granularity === 'lifetime' ? 1 : count, referenceDate);
  const todayStr = toDateString(referenceDate);

  return ranges.map((range) => {
    const startStr = toDateString(range.start);
    const endStr = toDateString(range.end);
    let spent = 0;
    for (const tx of txs) {
      if (!isSpendable(tx.type)) continue;
      if (tx.date >= startStr && tx.date < endStr) {
        spent += -tx.amount; // outgoing amounts are negative per parser convention
      }
    }
    const remainingForPeriod = config.allowancePerPeriod - spent;
    return {
      key: range.key,
      label: range.label,
      startDate: startStr,
      endDate: endStr,
      spent,
      remainingForPeriod,
      allowancePerPeriod: config.allowancePerPeriod,
      savingsGoalAmount: config.savingsGoalAmount,
      isCurrent: todayStr >= startStr && todayStr < endStr,
    };
  });
}

// Allowance Usage chart color: the in-progress period is always primaryDark
// regardless of pace so far; a closed period with no spending at all reads
// as neutral (primary) rather than a false "success"; otherwise success/alert
// by over- or under-budget.
export function usageColor(bucket: PeriodBucket): UsageColor {
  if (bucket.isCurrent) return 'primaryDark';
  if (bucket.spent === 0) return 'primary';
  return bucket.spent <= bucket.allowancePerPeriod ? 'success' : 'alert';
}

// Money Saved chart color: goal met when the period didn't dip into (or
// past) the savings goal that was already carved out of allowancePerPeriod
// — i.e. remainingForPeriod >= 0, the same "not overspent" condition
// calculator.ts's own `overspend` flag uses for the live period.
export function savedColor(bucket: PeriodBucket): SavedColor {
  if (bucket.isCurrent) return 'primaryDark';
  return bucket.remainingForPeriod >= 0 ? 'success' : 'alert';
}

export interface InstallmentStats {
  readonly hasInstallments: boolean;
  readonly totalInstallmentAmount: number;
}

// M15-T10 — the two installment insight bullets, computed from the manual
// `installments` field (M13). Scoped to whatever transaction list the
// caller passes in (the current *allowance* period's transactions, not the
// chart's filter granularity — see the M15 plan note on why those two
// scopes are kept independent).
export function computeInstallmentStats(
  txs: readonly Pick<TransactionRecord, 'amount' | 'installments'>[],
): InstallmentStats {
  let total = 0;
  let has = false;
  for (const tx of txs) {
    if (tx.installments > 1) {
      has = true;
      total += Math.abs(tx.amount);
    }
  }
  return { hasInstallments: has, totalInstallmentAmount: total };
}
