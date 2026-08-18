import { Temporal } from '@js-temporal/polyfill';

// All date arithmetic uses the Temporal API. Do not use moment.js or date-fns.
// All calculations use the device's local timezone — no UTC conversion.
// Pass an explicit referenceDate in tests to keep them deterministic.

export function getPeriodStart(
  period: 'weekly' | 'monthly',
  referenceDate?: Temporal.ZonedDateTime,
): Temporal.ZonedDateTime {
  const now = referenceDate ?? Temporal.Now.zonedDateTimeISO();

  if (period === 'monthly') {
    return now.startOfDay().with({ day: 1 });
  }

  // Weekly: most recent Monday 00:00 local time.
  // Temporal ISO dayOfWeek: Mon=1 … Sun=7
  const daysFromMonday = now.dayOfWeek - 1;
  return now.startOfDay().subtract({ days: daysFromMonday });
}

export function getDaysInPeriod(
  period: 'weekly' | 'monthly',
  referenceDate?: Temporal.ZonedDateTime,
): number {
  if (period === 'weekly') return 7;

  const ref = referenceDate ?? Temporal.Now.zonedDateTimeISO();
  return ref.daysInMonth;
}

export function getDaysElapsed(
  period: 'weekly' | 'monthly',
  referenceDate?: Temporal.ZonedDateTime,
): number {
  const now = referenceDate ?? Temporal.Now.zonedDateTimeISO();
  const start = getPeriodStart(period, now);

  // Epoch milliseconds gives sub-day precision without Temporal Duration arithmetic.
  return (now.epochMilliseconds - start.epochMilliseconds) / 86_400_000;
}

// M15 (period-over-period comparisons): bounds of the period immediately
// preceding the one referenceDate falls in. `end` is exclusive — it's
// exactly the current period's own start, so [start, end) never overlaps
// the current period and never skips a day at the boundary.
export interface PeriodBounds {
  readonly start: Temporal.ZonedDateTime;
  readonly end: Temporal.ZonedDateTime;
}

export function getPreviousPeriodBounds(
  period: 'weekly' | 'monthly',
  referenceDate?: Temporal.ZonedDateTime,
): PeriodBounds {
  const now = referenceDate ?? Temporal.Now.zonedDateTimeISO();
  const currentStart = getPeriodStart(period, now);

  if (period === 'weekly') {
    return { start: currentStart.subtract({ days: 7 }), end: currentStart };
  }

  // Monthly: step one day before the current month's 1st to land in the
  // previous month (handles year rollover — Jan 1 -> Dec of the prior
  // year — for free, since subtract({days:1}) does real calendar math),
  // then snap that to its own month start.
  const dayInPreviousMonth = currentStart.subtract({ days: 1 });
  return { start: getPeriodStart('monthly', dayInPreviousMonth), end: currentStart };
}
