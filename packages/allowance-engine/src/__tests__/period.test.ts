import { Temporal } from '@js-temporal/polyfill';
import { getPeriodStart, getDaysInPeriod, getDaysElapsed, getPreviousPeriodBounds } from '../period';
import { calculateAllowance, getDaysInPeriod as indexDays } from '../index';

// Helper: build a UTC ZonedDateTime from an ISO-like string (no DST surprises in tests).
function dt(s: string): Temporal.ZonedDateTime {
  return Temporal.ZonedDateTime.from(`${s}[UTC]`);
}

// ── getPeriodStart ────────────────────────────────────────────────────────────

describe('getPeriodStart — weekly', () => {
  // April 14 2025 is a Monday; April 20 is the following Sunday.

  it('Tuesday → previous Monday', () => {
    const result = getPeriodStart('weekly', dt('2025-04-15T10:00:00'));
    expect(result.day).toBe(14);
    expect(result.month).toBe(4);
    expect(result.hour).toBe(0);
    expect(result.minute).toBe(0);
  });

  it('Monday → same Monday (daysFromMonday = 0)', () => {
    const result = getPeriodStart('weekly', dt('2025-04-14T15:30:00'));
    expect(result.day).toBe(14);
    expect(result.hour).toBe(0);
  });

  it('Sunday → six days back to Monday', () => {
    const result = getPeriodStart('weekly', dt('2025-04-20T08:00:00'));
    expect(result.day).toBe(14);
    expect(result.month).toBe(4);
    expect(result.hour).toBe(0);
  });

  it('Saturday → five days back to Monday', () => {
    const result = getPeriodStart('weekly', dt('2025-04-19T23:59:59'));
    expect(result.day).toBe(14);
  });

  it('crosses month boundary correctly (Mar 31 is Monday)', () => {
    // Apr 1 (Tue) → start = Mar 31
    const result = getPeriodStart('weekly', dt('2025-04-01T12:00:00'));
    expect(result.month).toBe(3);
    expect(result.day).toBe(31);
  });
});

describe('getPeriodStart — monthly', () => {
  it('mid-month → first of month at 00:00', () => {
    const result = getPeriodStart('monthly', dt('2025-04-15T10:00:00'));
    expect(result.day).toBe(1);
    expect(result.month).toBe(4);
    expect(result.hour).toBe(0);
  });

  it('first of month → same day (no change)', () => {
    const result = getPeriodStart('monthly', dt('2025-04-01T09:00:00'));
    expect(result.day).toBe(1);
    expect(result.month).toBe(4);
    expect(result.hour).toBe(0);
  });

  it('leap year February', () => {
    const result = getPeriodStart('monthly', dt('2024-02-15T12:00:00'));
    expect(result.day).toBe(1);
    expect(result.month).toBe(2);
    expect(result.year).toBe(2024);
  });

  it('year boundary — January 1', () => {
    const result = getPeriodStart('monthly', dt('2025-01-01T00:00:00'));
    expect(result.day).toBe(1);
    expect(result.month).toBe(1);
    expect(result.year).toBe(2025);
  });

  it('December 31 → December 1', () => {
    const result = getPeriodStart('monthly', dt('2025-12-31T23:59:59'));
    expect(result.day).toBe(1);
    expect(result.month).toBe(12);
  });
});

// ── getDaysInPeriod ───────────────────────────────────────────────────────────

describe('getDaysInPeriod', () => {
  it('weekly always returns 7 regardless of date', () => {
    expect(getDaysInPeriod('weekly', dt('2025-04-15T10:00:00'))).toBe(7);
    expect(getDaysInPeriod('weekly', dt('2025-02-01T00:00:00'))).toBe(7);
  });

  it('monthly April = 30 days', () => {
    expect(getDaysInPeriod('monthly', dt('2025-04-15T10:00:00'))).toBe(30);
  });

  it('monthly March = 31 days', () => {
    expect(getDaysInPeriod('monthly', dt('2025-03-15T10:00:00'))).toBe(31);
  });

  it('monthly January = 31 days', () => {
    expect(getDaysInPeriod('monthly', dt('2025-01-01T00:00:00'))).toBe(31);
  });

  it('monthly February non-leap year = 28 days', () => {
    expect(getDaysInPeriod('monthly', dt('2025-02-15T10:00:00'))).toBe(28);
  });

  it('monthly February leap year = 29 days', () => {
    expect(getDaysInPeriod('monthly', dt('2024-02-15T10:00:00'))).toBe(29);
  });
});

// ── getDaysElapsed ────────────────────────────────────────────────────────────

describe('getDaysElapsed — monthly', () => {
  it('April 1 00:00 → 0 days elapsed', () => {
    expect(getDaysElapsed('monthly', dt('2025-04-01T00:00:00'))).toBeCloseTo(0, 6);
  });

  it('April 1 12:00 → 0.5 days elapsed', () => {
    expect(getDaysElapsed('monthly', dt('2025-04-01T12:00:00'))).toBeCloseTo(0.5, 6);
  });

  it('April 10 12:00 → 9.5 days elapsed', () => {
    expect(getDaysElapsed('monthly', dt('2025-04-10T12:00:00'))).toBeCloseTo(9.5, 6);
  });

  it('April 30 23:59:59 → ~29.9999 days elapsed', () => {
    const elapsed = getDaysElapsed('monthly', dt('2025-04-30T23:59:59'));
    expect(elapsed).toBeGreaterThan(29.99);
    expect(elapsed).toBeLessThan(30);
  });
});

describe('getDaysElapsed — weekly', () => {
  it('Monday 00:00 → 0 days elapsed', () => {
    expect(getDaysElapsed('weekly', dt('2025-04-14T00:00:00'))).toBeCloseTo(0, 6);
  });

  it('Monday 12:00 → 0.5 days elapsed', () => {
    expect(getDaysElapsed('weekly', dt('2025-04-14T12:00:00'))).toBeCloseTo(0.5, 6);
  });

  it('Tuesday 12:00 → 1.5 days elapsed', () => {
    expect(getDaysElapsed('weekly', dt('2025-04-15T12:00:00'))).toBeCloseTo(1.5, 6);
  });

  it('Sunday 00:00 → 6.0 days elapsed', () => {
    expect(getDaysElapsed('weekly', dt('2025-04-20T00:00:00'))).toBeCloseTo(6.0, 6);
  });
});

// ── Live-clock branches (referenceDate omitted) ───────────────────────────────
// These cover the `referenceDate ?? Temporal.Now.zonedDateTimeISO()` branches.
// Assertions are loose since the result depends on the current wall-clock time.

describe('period functions — live clock (no referenceDate)', () => {
  it('getDaysInPeriod weekly returns 7', () => {
    expect(getDaysInPeriod('weekly')).toBe(7);
  });

  it('getDaysInPeriod monthly returns 28–31', () => {
    const days = getDaysInPeriod('monthly');
    expect(days).toBeGreaterThanOrEqual(28);
    expect(days).toBeLessThanOrEqual(31);
  });

  it('getPeriodStart monthly returns day 1', () => {
    expect(getPeriodStart('monthly').day).toBe(1);
  });

  it('getPeriodStart weekly returns a Monday', () => {
    expect(getPeriodStart('weekly').dayOfWeek).toBe(1);
  });

  it('getDaysElapsed monthly returns 0–31', () => {
    const e = getDaysElapsed('monthly');
    expect(e).toBeGreaterThanOrEqual(0);
    expect(e).toBeLessThan(31);
  });

  it('getDaysElapsed weekly returns 0–7', () => {
    const e = getDaysElapsed('weekly');
    expect(e).toBeGreaterThanOrEqual(0);
    expect(e).toBeLessThan(7);
  });

  it('getPreviousPeriodBounds monthly defaults to now and precedes the current month start', () => {
    const bounds = getPreviousPeriodBounds('monthly');
    const currentStart = getPeriodStart('monthly');
    expect(bounds.end.epochMilliseconds).toBe(currentStart.epochMilliseconds);
    expect(bounds.start.epochMilliseconds).toBeLessThan(bounds.end.epochMilliseconds);
  });

  it('getPreviousPeriodBounds weekly defaults to now and precedes the current week start', () => {
    const bounds = getPreviousPeriodBounds('weekly');
    const currentStart = getPeriodStart('weekly');
    expect(bounds.end.epochMilliseconds).toBe(currentStart.epochMilliseconds);
    expect(bounds.start.epochMilliseconds).toBeLessThan(bounds.end.epochMilliseconds);
  });
});

// ── getPreviousPeriodBounds (M15) ───────────────────────────────────────────────

describe('getPreviousPeriodBounds — monthly', () => {
  it('mid-month reference → previous calendar month, end is the current month start', () => {
    const bounds = getPreviousPeriodBounds('monthly', dt('2026-08-15T10:00:00'));
    expect(bounds.start.year).toBe(2026);
    expect(bounds.start.month).toBe(7);
    expect(bounds.start.day).toBe(1);
    expect(bounds.end.year).toBe(2026);
    expect(bounds.end.month).toBe(8);
    expect(bounds.end.day).toBe(1);
  });

  it('January reference → previous period is December of the prior year (year rollover)', () => {
    const bounds = getPreviousPeriodBounds('monthly', dt('2026-01-10T10:00:00'));
    expect(bounds.start.year).toBe(2025);
    expect(bounds.start.month).toBe(12);
    expect(bounds.start.day).toBe(1);
    expect(bounds.end.year).toBe(2026);
    expect(bounds.end.month).toBe(1);
    expect(bounds.end.day).toBe(1);
  });

  it('the 1st itself → previous period is still the prior month, not the current one', () => {
    const bounds = getPreviousPeriodBounds('monthly', dt('2026-03-01T00:00:01'));
    expect(bounds.start.month).toBe(2);
    expect(bounds.end.month).toBe(3);
  });

  it('bounds never overlap: end equals the current period start exactly', () => {
    const ref = dt('2026-05-20T12:00:00');
    const bounds = getPreviousPeriodBounds('monthly', ref);
    const currentStart = getPeriodStart('monthly', ref);
    expect(bounds.end.epochMilliseconds).toBe(currentStart.epochMilliseconds);
  });
});

describe('getPreviousPeriodBounds — weekly', () => {
  it('returns exactly 7 days ending at the current week start', () => {
    // 2025-04-15 is a Tuesday; current week starts Monday 2025-04-14.
    const bounds = getPreviousPeriodBounds('weekly', dt('2025-04-15T10:00:00'));
    expect(bounds.start.day).toBe(7);
    expect(bounds.start.month).toBe(4);
    expect(bounds.end.day).toBe(14);
    expect(bounds.end.month).toBe(4);
  });

  it('crosses a month boundary correctly', () => {
    // 2026-05-04 is a Monday -> current week starts 2026-05-04, previous starts 2026-04-27.
    const bounds = getPreviousPeriodBounds('weekly', dt('2026-05-04T00:00:00'));
    expect(bounds.start.month).toBe(4);
    expect(bounds.start.day).toBe(27);
    expect(bounds.end.month).toBe(5);
    expect(bounds.end.day).toBe(4);
  });
});

// ── Index re-exports ──────────────────────────────────────────────────────────

describe('index re-exports', () => {
  it('exports getDaysInPeriod', () => {
    expect(typeof indexDays).toBe('function');
  });

  it('exports calculateAllowance', () => {
    expect(typeof calculateAllowance).toBe('function');
  });
});
