import {
  bucketTransactions,
  usageColor,
  savedColor,
  computeInstallmentStats,
  type PeriodBucket,
  type BucketConfig,
} from '../lib/insightsData';

const CONFIG: BucketConfig = { allowancePerPeriod: 2000, savingsGoalAmount: 500 };
const REF = new Date(2026, 7, 20); // Aug 20 2026 (JS months are 0-indexed)

function tx(date: string, amount: number, type = 'PIX_OUT') {
  return { date, amount, type };
}

describe('bucketTransactions — monthly', () => {
  it('returns `count` trailing monthly buckets ending at the reference month', () => {
    const buckets = bucketTransactions([], 'monthly', 3, CONFIG, REF);
    expect(buckets.map((b) => b.key)).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(buckets.map((b) => b.label)).toEqual(['Jun', 'Jul', 'Aug']);
  });

  it('marks only the bucket containing the reference date as current', () => {
    const buckets = bucketTransactions([], 'monthly', 3, CONFIG, REF);
    expect(buckets.map((b) => b.isCurrent)).toEqual([false, false, true]);
  });

  it('sums spend into the correct bucket and excludes self-transfers', () => {
    const txs = [
      tx('2026-07-15', -100), // July
      tx('2026-08-05', -300), // Aug
      tx('2026-08-06', -50, 'SELF_TRANSFER_OUT'), // excluded
      tx('2026-08-07', 200, 'PIX_IN'), // incoming reduces net spend
    ];
    const buckets = bucketTransactions(txs, 'monthly', 2, CONFIG, REF);
    const july = buckets.find((b) => b.key === '2026-07')!;
    const aug = buckets.find((b) => b.key === '2026-08')!;
    expect(july.spent).toBe(100);
    expect(aug.spent).toBe(100); // 300 - 200 (incoming offsets outgoing)
  });

  it('excludes transactions outside every bucket range', () => {
    const txs = [tx('2026-01-01', -1000)];
    const buckets = bucketTransactions(txs, 'monthly', 2, CONFIG, REF);
    expect(buckets.reduce((sum, b) => sum + b.spent, 0)).toBe(0);
  });

  it('computes remainingForPeriod = allowancePerPeriod - spent', () => {
    const buckets = bucketTransactions([tx('2026-08-01', -200)], 'monthly', 1, CONFIG, REF);
    expect(buckets[0].remainingForPeriod).toBe(2000 - 200);
  });

  it('handles a year rollover in the trailing window', () => {
    const ref = new Date(2026, 1, 10); // Feb 2026
    const buckets = bucketTransactions([], 'monthly', 3, CONFIG, ref);
    expect(buckets.map((b) => b.key)).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});

describe('bucketTransactions — weekly', () => {
  it('buckets start on Monday and are 7 days wide', () => {
    const buckets = bucketTransactions([], 'weekly', 2, CONFIG, REF); // Aug 20 2026 is a Thursday
    expect(buckets).toHaveLength(2);
    const last = buckets[buckets.length - 1];
    const start = new Date(last.startDate);
    const end = new Date(last.endDate);
    expect((end.getTime() - start.getTime()) / 86_400_000).toBe(7);
  });
});

describe('bucketTransactions — quarterly / yearly', () => {
  it('quarterly buckets span 3 months and label with the quarter number', () => {
    const buckets = bucketTransactions([], 'quarterly', 2, CONFIG, REF); // Aug -> Q3
    expect(buckets[buckets.length - 1].label).toContain('Q3');
  });

  it('yearly buckets span a full calendar year', () => {
    const buckets = bucketTransactions([], 'yearly', 2, CONFIG, REF);
    expect(buckets.map((b) => b.key)).toEqual(['2025', '2026']);
  });
});

describe('bucketTransactions — lifetime', () => {
  it('always returns exactly one bucket regardless of requested count', () => {
    const buckets = bucketTransactions([], 'lifetime', 7, CONFIG, REF);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].key).toBe('lifetime');
    expect(buckets[0].isCurrent).toBe(true);
  });

  it('sums spend across all history into the single bucket', () => {
    const txs = [tx('2020-01-01', -500), tx('2026-08-01', -300)];
    const buckets = bucketTransactions(txs, 'lifetime', 7, CONFIG, REF);
    expect(buckets[0].spent).toBe(800);
  });
});

function bucket(overrides: Partial<PeriodBucket> = {}): PeriodBucket {
  return {
    key: 'k',
    label: 'L',
    startDate: '2026-08-01',
    endDate: '2026-09-01',
    spent: 0,
    remainingForPeriod: 0,
    allowancePerPeriod: 2000,
    savingsGoalAmount: 500,
    isCurrent: false,
    ...overrides,
  };
}

describe('usageColor', () => {
  it('is always primaryDark for the current (in-progress) bucket', () => {
    expect(usageColor(bucket({ isCurrent: true, spent: 5000 }))).toBe('primaryDark');
  });

  it('is primary (neutral) for a closed bucket with zero spend', () => {
    expect(usageColor(bucket({ spent: 0 }))).toBe('primary');
  });

  it('is success when a closed bucket stayed under budget', () => {
    expect(usageColor(bucket({ spent: 1000, allowancePerPeriod: 2000 }))).toBe('success');
  });

  it('is alert when a closed bucket went over budget', () => {
    expect(usageColor(bucket({ spent: 2500, allowancePerPeriod: 2000 }))).toBe('alert');
  });

  it('treats spending exactly the allowance as success (not alert)', () => {
    expect(usageColor(bucket({ spent: 2000, allowancePerPeriod: 2000 }))).toBe('success');
  });
});

describe('savedColor', () => {
  it('is always primaryDark for the current bucket', () => {
    expect(savedColor(bucket({ isCurrent: true, remainingForPeriod: -9999 }))).toBe('primaryDark');
  });

  it('is success when the period stayed within its allowance (goal met)', () => {
    expect(savedColor(bucket({ remainingForPeriod: 300 }))).toBe('success');
  });

  it('is alert when the period went over its allowance (goal missed)', () => {
    expect(savedColor(bucket({ remainingForPeriod: -50 }))).toBe('alert');
  });

  it('treats exactly zero remaining as success (goal exactly met)', () => {
    expect(savedColor(bucket({ remainingForPeriod: 0 }))).toBe('success');
  });
});

describe('computeInstallmentStats', () => {
  it('returns hasInstallments: false and total 0 when there are no installment transactions', () => {
    const txs = [{ amount: -100, installments: 1 }, { amount: 50, installments: 1 }];
    expect(computeInstallmentStats(txs)).toEqual({ hasInstallments: false, totalInstallmentAmount: 0 });
  });

  it('detects a single installment transaction', () => {
    const txs = [{ amount: -300, installments: 3 }];
    expect(computeInstallmentStats(txs)).toEqual({ hasInstallments: true, totalInstallmentAmount: 300 });
  });

  it('sums multiple installment transactions', () => {
    const txs = [
      { amount: -300, installments: 3 },
      { amount: -600, installments: 6 },
    ];
    expect(computeInstallmentStats(txs)).toEqual({ hasInstallments: true, totalInstallmentAmount: 900 });
  });

  it('sums only installment transactions when mixed with non-installment ones', () => {
    const txs = [
      { amount: -300, installments: 3 },
      { amount: -50, installments: 1 },
      { amount: 200, installments: 1 },
    ];
    expect(computeInstallmentStats(txs)).toEqual({ hasInstallments: true, totalInstallmentAmount: 300 });
  });

  it('uses the absolute amount so an incoming installment-tagged transaction still counts positively', () => {
    const txs = [{ amount: 400, installments: 2 }];
    expect(computeInstallmentStats(txs).totalInstallmentAmount).toBe(400);
  });

  it('treats installments === 0 the same as 1 (not an installment)', () => {
    const txs = [{ amount: -100, installments: 0 }];
    expect(computeInstallmentStats(txs).hasInstallments).toBe(false);
  });
});
