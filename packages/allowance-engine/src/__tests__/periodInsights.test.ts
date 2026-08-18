import { comparePeriods, getLifetimeSavings, type PeriodSnapshot } from '../periodInsights';

function snap(overrides: Partial<PeriodSnapshot> = {}): PeriodSnapshot {
  return {
    spendableTotal: 1000,
    allowancePerPeriod: 2000,
    daysElapsed: 15,
    daysInPeriod: 30,
    ...overrides,
  };
}

describe('comparePeriods', () => {
  it('returns all-null when there is no previous period (first-ever period)', () => {
    expect(comparePeriods(snap(), null)).toEqual({
      savingsChangePct: null,
      spendVelocityChangePct: null,
      projectedSavingsChangePct: null,
    });
  });

  it('computes a positive savings change when this period is saving more than the last', () => {
    // periodSavings = allowancePerPeriod - spendableTotal
    const current = snap({ spendableTotal: 500 }); // savings = 1500
    const previous = snap({ spendableTotal: 1000, daysElapsed: 30 }); // savings = 1000, closed
    const result = comparePeriods(current, previous);
    expect(result.savingsChangePct).toBeCloseTo(50, 5); // (1500-1000)/1000 * 100
  });

  it('computes a negative savings change when this period is saving less than the last', () => {
    const current = snap({ spendableTotal: 1500 }); // savings = 500
    const previous = snap({ spendableTotal: 1000, daysElapsed: 30 }); // savings = 1000
    const result = comparePeriods(current, previous);
    expect(result.savingsChangePct).toBeCloseTo(-50, 5);
  });

  it('returns null savingsChangePct when the previous period broke exactly even (division by zero)', () => {
    const current = snap({ spendableTotal: 500 });
    const previous = snap({ spendableTotal: 2000, daysElapsed: 30 }); // savings = 0
    expect(comparePeriods(current, previous).savingsChangePct).toBeNull();
  });

  it('uses the absolute value of the previous savings as the denominator, so recovering from an overspent period reads as a large positive change', () => {
    const current = snap({ spendableTotal: 1800 }); // savings = 200
    const previous = snap({ spendableTotal: 2500, daysElapsed: 30 }); // savings = -500 (overspent)
    const result = comparePeriods(current, previous);
    // (200 - (-500)) / abs(-500) * 100 = 700/500*100 = 140
    expect(result.savingsChangePct).toBeCloseTo(140, 5);
  });

  it('computes spend velocity change (spend per day elapsed)', () => {
    const current = snap({ spendableTotal: 600, daysElapsed: 10 }); // velocity 60/day
    const previous = snap({ spendableTotal: 900, daysElapsed: 30 }); // velocity 30/day
    const result = comparePeriods(current, previous);
    expect(result.spendVelocityChangePct).toBeCloseTo(100, 5); // pace doubled
  });

  it('returns 0 velocity (not NaN) when daysElapsed is 0, and null change if previous velocity was also 0', () => {
    const current = snap({ spendableTotal: 0, daysElapsed: 0 });
    const previous = snap({ spendableTotal: 0, daysElapsed: 30 }); // velocity 0
    expect(comparePeriods(current, previous).spendVelocityChangePct).toBeNull();
  });

  it('computes projected savings change (extrapolating current pace to period end)', () => {
    // current: velocity 50/day * 30 days = projected spend 1500; savings = 2000-1500=500
    const current = snap({ spendableTotal: 500, daysElapsed: 10, daysInPeriod: 30, allowancePerPeriod: 2000 });
    // previous (closed): actual spend 1000 over 30 days = projected savings 2000-1000=1000
    const previous = snap({ spendableTotal: 1000, daysElapsed: 30, daysInPeriod: 30, allowancePerPeriod: 2000 });
    const result = comparePeriods(current, previous);
    expect(result.projectedSavingsChangePct).toBeCloseTo(-50, 5); // (500-1000)/1000*100
  });

  it('treats a fully-closed previous period consistently (daysElapsed === daysInPeriod)', () => {
    const previous = snap({ spendableTotal: 1200, daysElapsed: 30, daysInPeriod: 30 });
    const current = snap({ spendableTotal: 600, daysElapsed: 15, daysInPeriod: 30 });
    const result = comparePeriods(current, previous);
    expect(result.savingsChangePct).not.toBeNull();
    expect(result.spendVelocityChangePct).not.toBeNull();
    expect(result.projectedSavingsChangePct).not.toBeNull();
  });
});

describe('getLifetimeSavings', () => {
  it('returns 0 for an empty history', () => {
    expect(getLifetimeSavings([])).toBe(0);
  });

  it('sums a single period', () => {
    expect(getLifetimeSavings([250])).toBe(250);
  });

  it('sums multiple periods, including negative (overspent) ones', () => {
    expect(getLifetimeSavings([250, -100, 300, 50])).toBe(500);
  });
});
