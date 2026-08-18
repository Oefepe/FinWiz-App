import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  comparePeriods,
  computeSpendableTotal,
  getDaysInPeriod,
  getLifetimeSavings,
  getPreviousPeriodBounds,
  type AllowanceState,
  type PeriodComparison,
  type PeriodSnapshot,
} from '@finwiz/allowance-engine';
import { getAllowanceConfig, queryAllowanceTransactionsInRange, queryTransactionsInRange } from '../lib/database';
import { useTransactions } from './useTransactions';
import {
  bucketTransactions,
  computeInstallmentStats,
  getChartDateRange,
  type BucketConfig,
  type ChartGranularity,
  type InstallmentStats,
  type PeriodBucket,
} from '../lib/insightsData';

const CHART_BUCKET_COUNT = 7;
// Beta apps realistically won't have more than a few years of local
// history (the app itself is new); a fixed lookback keeps the lifetime
// aggregate cheap without a separate MIN(date) query. Revisit with a real
// "first transaction" query if this ever becomes limiting.
const LIFETIME_LOOKBACK_BUCKETS: Record<'weekly' | 'monthly', number> = { weekly: 260, monthly: 60 };

async function currentBucketConfig(): Promise<BucketConfig> {
  const config = await getAllowanceConfig();
  return {
    allowancePerPeriod: config.monthlyIncomeEstimate - config.fixedMonthlyExpenses - config.savingsGoalAmount,
    savingsGoalAmount: config.savingsGoalAmount,
  };
}

// M15-T2/T3/T4 — the two swipeable charts' bucketed data, re-fetched
// whenever the Filter granularity changes.
export function useChartBuckets(granularity: ChartGranularity) {
  return useQuery({
    queryKey: ['insightsChart', granularity],
    queryFn: async (): Promise<PeriodBucket[]> => {
      const bucketConfig = await currentBucketConfig();
      const referenceDate = new Date();
      const { start, end } = getChartDateRange(granularity, CHART_BUCKET_COUNT, referenceDate);
      const txs = await queryTransactionsInRange(start, end);
      return bucketTransactions(txs, granularity, CHART_BUCKET_COUNT, bucketConfig, referenceDate);
    },
  });
}

// M15-T5 — Total Savings row. Always bucketed at the user's own configured
// allowance cadence (weekly/monthly), independent of the chart's display
// granularity — remainingForPeriod is only a meaningful figure at the
// cadence the allowance was actually set against.
export function useLifetimeSavings() {
  return useQuery({
    queryKey: ['lifetimeSavings'],
    queryFn: async (): Promise<number> => {
      const config = await getAllowanceConfig();
      const bucketConfig = await currentBucketConfig();
      const referenceDate = new Date();
      const count = LIFETIME_LOOKBACK_BUCKETS[config.period];
      const { start, end } = getChartDateRange(config.period, count, referenceDate);
      const txs = await queryTransactionsInRange(start, end);
      const buckets = bucketTransactions(txs, config.period, count, bucketConfig, referenceDate);
      // Only closed periods count toward "lifetime" savings — the
      // in-progress period hasn't finished yet.
      const closed = buckets.filter((b) => !b.isCurrent);
      return getLifetimeSavings(closed.map((b) => b.remainingForPeriod));
    },
  });
}

// M15-T7/T8 — the three period-over-period comparison bullets, scoped to
// the user's actual allowance period (not the chart filter — see the M15
// plan note on why those two scopes are kept independent). Takes the
// already-computed current AllowanceState (from useAllowance()) rather than
// recomputing it, so this always agrees with whatever the rest of the
// screen is already showing for "this period."
export function usePeriodComparison(allowance: AllowanceState | undefined) {
  return useQuery({
    queryKey: ['periodComparison', allowance?.spendableTotal, allowance?.allowancePerPeriod],
    enabled: allowance !== undefined,
    queryFn: async (): Promise<PeriodComparison> => {
      // `enabled` guarantees this runs only once `allowance` is defined —
      // react-query doesn't narrow the outer closure's type for us, so this
      // guard exists purely to avoid a non-null assertion, not because it's
      // expected to ever actually throw.
      if (allowance === undefined) {
        throw new Error('usePeriodComparison: queryFn ran while disabled');
      }
      const state = allowance;
      const config = await getAllowanceConfig();

      const daysElapsed = state.dailyRate > 0 ? state.elapsedAllowance / state.dailyRate : 0;
      const daysInPeriod = daysElapsed + state.daysRemaining;
      const current: PeriodSnapshot = {
        spendableTotal: state.spendableTotal,
        allowancePerPeriod: state.allowancePerPeriod,
        daysElapsed,
        daysInPeriod,
      };

      const bounds = getPreviousPeriodBounds(config.period);
      const prevStart = bounds.start.toPlainDate().toString();
      const prevEnd = bounds.end.toPlainDate().toString();
      const prevTxs = await queryAllowanceTransactionsInRange(prevStart, prevEnd);
      const prevDaysInPeriod = getDaysInPeriod(config.period, bounds.start);
      // Same simplification as the charts: the previous (closed) period is
      // evaluated against the user's *current* allowancePerPeriod, since
      // the app doesn't keep a history of past config values.
      const previous: PeriodSnapshot = {
        spendableTotal: computeSpendableTotal(prevTxs),
        allowancePerPeriod: state.allowancePerPeriod,
        daysElapsed: prevDaysInPeriod,
        daysInPeriod: prevDaysInPeriod,
      };

      return comparePeriods(current, previous);
    },
  });
}

// M15-T10 — the two installment bullets, scoped to the current allowance
// period's transactions (reuses useTransactions()'s existing current-month
// scoping — the same simplification the rest of the app already makes for
// weekly-period users; not something new introduced here).
export function useInstallmentStats(): InstallmentStats {
  const { data: txs } = useTransactions();
  return useMemo(() => computeInstallmentStats(txs ?? []), [txs]);
}
