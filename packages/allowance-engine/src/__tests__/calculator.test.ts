import { Temporal } from '@js-temporal/polyfill';
import { calculateAllowance } from '../calculator';
import type { CalculatorInput, AllowanceTx } from '../calculator';

function dt(s: string): Temporal.ZonedDateTime {
  return Temporal.ZonedDateTime.from(`${s}[UTC]`);
}

// April 10 2025, noon UTC — 9.5 days into a 30-day month.
// allowancePerPeriod = 5000 - 1000 = 4000
// dailyRate          = 4000 / 30 ≈ 133.333
// elapsedAllowance   = 133.333 × 9.5 ≈ 1266.667
const REF = dt('2025-04-10T12:00:00');

const BASE: CalculatorInput = {
  monthlyIncomeEstimate: 5000,
  fixedMonthlyExpenses: 0,
  savingsGoalAmount: 1000,
  period: 'monthly',
  alertThreshold: 0.2,
  transactions: [],
  referenceDate: REF,
};

function tx(amount: number, type = 'DEBIT', selfTransferStatus?: AllowanceTx['selfTransferStatus']): AllowanceTx {
  return selfTransferStatus !== undefined
    ? { type, amount, selfTransferStatus }
    : { type, amount };
}

// ── Fixed monthly expenses ────────────────────────────────────────────────────

describe('calculateAllowance — fixedMonthlyExpenses', () => {
  it('allowancePerPeriod = income − fixed − savings', () => {
    // income 5000, fixed 2000, savings 500 → spendable allowance 2500
    const state = calculateAllowance({
      ...BASE,
      monthlyIncomeEstimate: 5000,
      fixedMonthlyExpenses: 2000,
      savingsGoalAmount: 500,
    });
    expect(state.allowancePerPeriod).toBeCloseTo(2500, 4);
    expect(state.dailyRate).toBeCloseTo(2500 / 30, 4);
  });

  it('zero fixedMonthlyExpenses preserves existing behaviour', () => {
    // Matches the original formula when no fixed expenses are set
    const state = calculateAllowance(BASE);
    expect(state.allowancePerPeriod).toBeCloseTo(4000, 4);
  });
});

// ── Core formula ──────────────────────────────────────────────────────────────

describe('calculateAllowance — core formula', () => {
  it('zero transactions: spendableTotal = 0, remainingAllowance = elapsedAllowance', () => {
    const state = calculateAllowance(BASE);
    expect(state.allowancePerPeriod).toBeCloseTo(4000);
    expect(state.dailyRate).toBeCloseTo(4000 / 30, 4);
    expect(state.elapsedAllowance).toBeCloseTo((4000 / 30) * 9.5, 4);
    expect(state.spendableTotal).toBeCloseTo(0);
    expect(state.remainingAllowance).toBeCloseTo(state.elapsedAllowance);
    expect(state.overspend).toBe(false);
  });

  it('standard spending: remainingAllowance = elapsedAllowance - spent', () => {
    const state = calculateAllowance({
      ...BASE,
      transactions: [tx(-300, 'DEBIT'), tx(-200, 'PIX_OUT')],
    });
    expect(state.spendableTotal).toBeCloseTo(500);
    expect(state.remainingAllowance).toBeCloseTo(state.elapsedAllowance - 500, 4);
    expect(state.overspend).toBe(false);
  });

  it('mid-period income (PIX_IN) offsets spendableTotal', () => {
    const state = calculateAllowance({
      ...BASE,
      // Spent 600, received 200 mid-period → net outflow = 400
      transactions: [tx(-600, 'PIX_OUT'), tx(200, 'PIX_IN')],
    });
    expect(state.spendableTotal).toBeCloseTo(400, 4);
  });
});

// ── Overspend ─────────────────────────────────────────────────────────────────

describe('calculateAllowance — overspend', () => {
  it('remainingAllowance < 0 when spending exceeds elapsedAllowance', () => {
    // elapsedAllowance ≈ 1266.67; spend 2000 → overspend
    const state = calculateAllowance({
      ...BASE,
      transactions: [tx(-2000, 'DEBIT')],
    });
    expect(state.remainingAllowance).toBeLessThan(0);
    expect(state.overspend).toBe(true);
  });

  it('exactly at elapsedAllowance: overspend = false', () => {
    const elapsed = (4000 / 30) * 9.5;
    const state = calculateAllowance({
      ...BASE,
      transactions: [tx(-elapsed, 'DEBIT')],
    });
    expect(state.overspend).toBe(false);
    expect(state.remainingAllowance).toBeCloseTo(0, 4);
  });
});

// ── Alert threshold ───────────────────────────────────────────────────────────

describe('calculateAllowance — alert threshold', () => {
  it('alert triggered when remaining ≤ 20% of elapsed', () => {
    // elapsedAllowance ≈ 1266.67 → 20% ≈ 253.33
    // spend 1050 → remaining ≈ 216.67 < 253.33 → alert
    const state = calculateAllowance({
      ...BASE,
      transactions: [tx(-1050, 'DEBIT')],
    });
    expect(state.alertTriggered).toBe(true);
  });

  it('alert NOT triggered when remaining > 20% of elapsed', () => {
    // spend 200 → remaining ≈ 1066 >> 20% of 1266 → no alert
    const state = calculateAllowance({
      ...BASE,
      transactions: [tx(-200, 'DEBIT')],
    });
    expect(state.alertTriggered).toBe(false);
  });

  it('alert NOT triggered at period start (elapsedAllowance = 0)', () => {
    const state = calculateAllowance({
      ...BASE,
      referenceDate: dt('2025-04-01T00:00:00'), // exactly at start
      transactions: [],
    });
    expect(state.elapsedAllowance).toBeCloseTo(0, 4);
    expect(state.alertTriggered).toBe(false); // no division by zero
  });

  it('configurable threshold: 10% fires later than 20%', () => {
    const spend = [tx(-1050, 'DEBIT')];
    const alert20 = calculateAllowance({ ...BASE, alertThreshold: 0.2, transactions: spend });
    const alert10 = calculateAllowance({ ...BASE, alertThreshold: 0.1, transactions: spend });
    expect(alert20.alertTriggered).toBe(true);
    expect(alert10.alertTriggered).toBe(false);
  });
});

// ── Self-transfer exclusion ───────────────────────────────────────────────────

describe('calculateAllowance — self-transfer exclusion', () => {
  it('SELF_TRANSFER_OUT excluded from spendableTotal', () => {
    const state = calculateAllowance({
      ...BASE,
      transactions: [tx(-500, 'SELF_TRANSFER_OUT')],
    });
    expect(state.spendableTotal).toBeCloseTo(0);
  });

  it('SELF_TRANSFER_IN excluded from spendableTotal', () => {
    const state = calculateAllowance({
      ...BASE,
      transactions: [tx(500, 'SELF_TRANSFER_IN')],
    });
    expect(state.spendableTotal).toBeCloseTo(0);
  });

  it('all transactions are self-transfers: spendableTotal = 0', () => {
    const state = calculateAllowance({
      ...BASE,
      transactions: [
        tx(-1000, 'SELF_TRANSFER_OUT'),
        tx(1000, 'SELF_TRANSFER_IN'),
      ],
    });
    expect(state.spendableTotal).toBeCloseTo(0);
  });

  it('pending self-transfer provisionally excluded', () => {
    const state = calculateAllowance({
      ...BASE,
      transactions: [
        tx(-500, 'PIX_OUT', 'pending'),   // excluded until confirmed/expired
        tx(-200, 'DEBIT'),                 // normal — included
      ],
    });
    expect(state.spendableTotal).toBeCloseTo(200, 4);
  });

  it('expired self-transfer re-included in spendableTotal', () => {
    const state = calculateAllowance({
      ...BASE,
      transactions: [
        tx(-500, 'PIX_OUT', 'expired'),   // expired → counts as spending
        tx(-200, 'DEBIT'),
      ],
    });
    expect(state.spendableTotal).toBeCloseTo(700, 4);
  });

  it('confirmed self-transfer type is excluded regardless of status field', () => {
    // type = SELF_TRANSFER_OUT overrides any status
    const state = calculateAllowance({
      ...BASE,
      transactions: [tx(-500, 'SELF_TRANSFER_OUT', 'confirmed')],
    });
    expect(state.spendableTotal).toBeCloseTo(0);
  });
});

// ── Period-level remaining & adjusted daily rate ──────────────────────────────
//
// REF = April 10 noon → daysElapsed ≈ 9.5, daysInPeriod = 30, daysRemaining ≈ 20.5
// allowancePerPeriod = 4000

describe('calculateAllowance — remainingForPeriod & adjustedDailyRate', () => {
  it('remainingForPeriod = allowancePerPeriod with zero spending', () => {
    const state = calculateAllowance(BASE);
    expect(state.remainingForPeriod).toBeCloseTo(4000, 4);
  });

  it('remainingForPeriod decreases as spending increases', () => {
    const state = calculateAllowance({ ...BASE, transactions: [tx(-1000, 'DEBIT')] });
    expect(state.remainingForPeriod).toBeCloseTo(3000, 4);
  });

  it('remainingForPeriod goes negative when total spending exceeds allowancePerPeriod', () => {
    // Spent 5000 against a 4000 period budget → -1000 remaining
    const state = calculateAllowance({ ...BASE, transactions: [tx(-5000, 'DEBIT')] });
    expect(state.remainingForPeriod).toBeCloseTo(-1000, 4);
    expect(state.overspend).toBe(true);
  });

  it('daysRemaining = daysInPeriod − daysElapsed', () => {
    const state = calculateAllowance(BASE);
    expect(state.daysRemaining).toBeCloseTo(30 - 9.5, 4);
  });

  it('adjustedDailyRate = remainingForPeriod / daysRemaining with zero spending', () => {
    // remainingForPeriod = 4000, daysRemaining = 20.5 → 4000 / 20.5 ≈ 195.12
    // Higher than dailyRate (133.33) because unspent early days roll into the remainder
    const state = calculateAllowance(BASE);
    expect(state.adjustedDailyRate).toBeCloseTo(4000 / 20.5, 4);
  });

  it('adjustedDailyRate drops when overpacing but period budget still positive', () => {
    // Spent 2000 — over elapsed pace (overspend) but under period total
    // remainingForPeriod = 2000, daysRemaining = 20.5 → ≈ 97.56
    const state = calculateAllowance({ ...BASE, transactions: [tx(-2000, 'DEBIT')] });
    expect(state.overspend).toBe(true);
    expect(state.remainingForPeriod).toBeCloseTo(2000, 4);
    expect(state.adjustedDailyRate).toBeCloseTo(2000 / 20.5, 4);
  });

  it('adjustedDailyRate is negative when period budget is fully exhausted', () => {
    // Spent 5000 → remainingForPeriod = -1000, daysRemaining = 20.5 → ≈ -48.78
    const state = calculateAllowance({ ...BASE, transactions: [tx(-5000, 'DEBIT')] });
    expect(state.adjustedDailyRate).toBeCloseTo(-1000 / 20.5, 4);
  });
});

// ── Weekly period ─────────────────────────────────────────────────────────────

describe('calculateAllowance — weekly period', () => {
  // Wednesday noon = 2.5 days into a 7-day week
  // allowancePerPeriod = 5000 - 1000 = 4000
  // dailyRate = 4000 / 7 ≈ 571.43
  // elapsedAllowance = 571.43 × 2.5 ≈ 1428.57
  const WED_NOON = dt('2025-04-16T12:00:00'); // April 16 = Wednesday

  it('weekly formula fields are correct', () => {
    const state = calculateAllowance({
      ...BASE,
      period: 'weekly',
      referenceDate: WED_NOON,
      transactions: [],
    });
    expect(state.allowancePerPeriod).toBeCloseTo(4000);
    expect(state.dailyRate).toBeCloseTo(4000 / 7, 4);
    expect(state.elapsedAllowance).toBeCloseTo((4000 / 7) * 2.5, 4);
    expect(state.overspend).toBe(false);
  });
});
