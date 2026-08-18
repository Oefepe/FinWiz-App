import {
  tryMatch,
  createManualPair,
  rejectPair,
  computeConfidence,
  AMOUNT_TOLERANCE,
  TIMING_WINDOW_SECONDS,
} from '../matcher';
import {
  createPendingPair,
  isExpired,
  pruneExpired,
} from '../window';
import { checkNewTransaction } from '../index';
import type { CandidateTx, PendingPair, SelfTransferPair } from '../types';

// Cross-package import: verify M3 pending-exclusion contract
import { calculateAllowance } from '@finwiz/allowance-engine';
import { Temporal } from '@js-temporal/polyfill';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const T0 = 1_714_000_000_000; // arbitrary fixed ms timestamp

function outTx(overrides?: Partial<CandidateTx>): CandidateTx {
  return {
    txId: 'tx_out_01',
    amount: -500,
    bank: 'nubank',
    timestamp: T0,
    description: 'PIX enviado',
    ...overrides,
  };
}

function inTx(overrides?: Partial<CandidateTx>): CandidateTx {
  return {
    txId: 'tx_in_01',
    amount: 500,
    bank: 'inter',
    timestamp: T0 + 30_000,   // 30 seconds later
    description: 'PIX recebido',
    ...overrides,
  };
}

function pendingFromOut(overrides?: Partial<PendingPair>): PendingPair {
  return {
    txId: 'tx_out_01',
    amount: 500,
    bank: 'nubank',
    timestamp: T0,
    direction: 'out',
    description: 'PIX enviado',
    expiresAt: T0 + 30 * 60 * 1000,
    ...overrides,
  };
}

const NO_HISTORY: readonly SelfTransferPair[] = [];

// ── Scenario 1 — Exact match → auto_confirm ───────────────────────────────────

describe('Scenario 1: exact match (amount + timing + different banks)', () => {
  it('returns auto_confirm with a confirmed pair', () => {
    const pending = [pendingFromOut()];
    const incoming = inTx();

    const result = tryMatch(incoming, pending, NO_HISTORY);

    expect(result).not.toBeNull();
    expect(result!.action).toBe('auto_confirm');
    expect(result!.pair.status).toBe('confirmed');
    expect(result!.pair.outBank).toBe('nubank');
    expect(result!.pair.inBank).toBe('inter');
    expect(result!.pair.amount).toBeCloseTo(500);
    expect(result!.pair.id).toMatch(/^st_[A-Za-z0-9]{6}$/);
  });

  it('pair IDs have the st_ prefix format', () => {
    const result = tryMatch(inTx(), [pendingFromOut()], NO_HISTORY);
    expect(result!.pair.id.startsWith('st_')).toBe(true);
    expect(result!.pair.id.length).toBe(9); // "st_" + 6 chars
  });
});

// ── Scenario 2 — Amount mismatch → null ──────────────────────────────────────

describe('Scenario 2: amount mismatch (> tolerance) returns null', () => {
  it(`difference of ${AMOUNT_TOLERANCE + 0.001} BRL → no match`, () => {
    const pending = [pendingFromOut({ amount: 500 })];
    const incoming = inTx({ amount: 500 + AMOUNT_TOLERANCE + 0.001 });

    expect(tryMatch(incoming, pending, NO_HISTORY)).toBeNull();
  });

  it(`difference of exactly ${AMOUNT_TOLERANCE} BRL → still matches (inclusive boundary)`, () => {
    const pending = [pendingFromOut({ amount: 500 })];
    const incoming = inTx({ amount: 500 + AMOUNT_TOLERANCE });

    expect(tryMatch(incoming, pending, NO_HISTORY)).not.toBeNull();
  });
});

// ── Scenario 3 — Timing boundary ─────────────────────────────────────────────

describe(`Scenario 3: timing boundary (${TIMING_WINDOW_SECONDS}s window)`, () => {
  function pendingAt(ts: number): PendingPair {
    return pendingFromOut({ timestamp: ts });
  }

  it('within 299s → match', () => {
    const pending = [pendingAt(T0)];
    const tx = inTx({ timestamp: T0 + 299_000 });
    expect(tryMatch(tx, pending, NO_HISTORY)).not.toBeNull();
  });

  it('exactly 300s → match (inclusive boundary)', () => {
    const pending = [pendingAt(T0)];
    const tx = inTx({ timestamp: T0 + 300_000 });
    expect(tryMatch(tx, pending, NO_HISTORY)).not.toBeNull();
  });

  it('301s → no match', () => {
    const pending = [pendingAt(T0)];
    const tx = inTx({ timestamp: T0 + 301_000 });
    expect(tryMatch(tx, pending, NO_HISTORY)).toBeNull();
  });
});

// ── Scenario 4 — Same bank → null ────────────────────────────────────────────

describe('Scenario 4: same bank → no match', () => {
  it('nubank → nubank transfer is not detected as a self-transfer', () => {
    const pending = [pendingFromOut({ bank: 'nubank' })];
    const tx = inTx({ bank: 'nubank' }); // same bank
    expect(tryMatch(tx, pending, NO_HISTORY)).toBeNull();
  });
});

// ── Scenario 5 — 30-minute expiry ────────────────────────────────────────────

describe('Scenario 5: 30-minute expiry window', () => {
  const EXPIRY_MS = 30 * 60 * 1000;

  it('pair is not expired 1ms before expiresAt', () => {
    const pair = pendingFromOut({ expiresAt: T0 + EXPIRY_MS });
    expect(isExpired(pair, T0 + EXPIRY_MS - 1)).toBe(false);
  });

  it('pair is expired exactly at expiresAt (inclusive)', () => {
    const pair = pendingFromOut({ expiresAt: T0 + EXPIRY_MS });
    expect(isExpired(pair, T0 + EXPIRY_MS)).toBe(true);
  });

  it('pair is expired after expiresAt', () => {
    const pair = pendingFromOut({ expiresAt: T0 + EXPIRY_MS });
    expect(isExpired(pair, T0 + EXPIRY_MS + 1)).toBe(true);
  });

  it('createPendingPair sets expiresAt = now + 30min', () => {
    const tx = outTx();
    const now = T0;
    const pair = createPendingPair(tx, 'out', now);
    expect(pair.expiresAt).toBe(now + EXPIRY_MS);
  });

  it('pruneExpired removes expired pairs', () => {
    const fresh = pendingFromOut({ txId: 'fresh', expiresAt: T0 + EXPIRY_MS + 9999 });
    const stale = pendingFromOut({ txId: 'stale', expiresAt: T0 + EXPIRY_MS - 1 });
    const pruned = pruneExpired([fresh, stale], T0 + EXPIRY_MS);
    expect(pruned).toHaveLength(1);
    expect(pruned[0]!.txId).toBe('fresh');
  });
});

// ── Scenario 6 — User manual correction: createManualPair ────────────────────

describe('Scenario 6: user correction via createManualPair', () => {
  it('returns a confirmed pair with confidence 1.0', () => {
    const out = outTx();
    const inn = inTx();
    const pair = createManualPair(out, inn);

    expect(pair.status).toBe('confirmed');
    expect(pair.confidence).toBe(1.0);
    expect(pair.outTxId).toBe(out.txId);
    expect(pair.inTxId).toBe(inn.txId);
    expect(pair.outBank).toBe('nubank');
    expect(pair.inBank).toBe('inter');
    expect(pair.amount).toBeCloseTo(500);
    expect(pair.id).toMatch(/^st_[A-Za-z0-9]{6}$/);
  });
});

// ── Scenario 7 — Un-marking via rejectPair ───────────────────────────────────

describe('Scenario 7: rejectPair changes status to rejected', () => {
  it('confirmed pair becomes rejected', () => {
    const pair = createManualPair(outTx(), inTx());
    expect(pair.status).toBe('confirmed');

    const rejected = rejectPair(pair);
    expect(rejected.status).toBe('rejected');
    expect(rejected.id).toBe(pair.id); // all other fields preserved
    expect(rejected.confidence).toBe(pair.confidence);
    expect(rejected.outTxId).toBe(pair.outTxId);
  });

  it('does not mutate the original pair', () => {
    const pair = createManualPair(outTx(), inTx());
    rejectPair(pair);
    expect(pair.status).toBe('confirmed');
  });
});

// ── Scenario 8 — Pending status excluded from allowance (M3 contract) ────────

describe('Scenario 8: pending self-transfer excluded from allowance engine', () => {
  // When the detector identifies a potential self-transfer but hasn't confirmed it yet
  // (action='escalate_to_ai' would set status='pending'), the outgoing tx should be
  // excluded from spendableTotal by the allowance engine.
  // This cross-package test verifies the M3 / M4 contract.

  function dt(s: string) {
    return Temporal.ZonedDateTime.from(`${s}[UTC]`);
  }

  const REF = dt('2025-04-10T12:00:00'); // 9.5 days into April

  it('tx with selfTransferStatus=pending is excluded from spendableTotal', () => {
    const state = calculateAllowance({
      monthlyIncomeEstimate: 5000,
      savingsGoalAmount: 1000,
      period: 'monthly',
      alertThreshold: 0.2,
      transactions: [
        { type: 'PIX_OUT', amount: -500, selfTransferStatus: 'pending' }, // excluded
        { type: 'DEBIT',   amount: -200 },                                 // included
      ],
      referenceDate: REF,
    });

    // Only the DEBIT (-200) should count: spendableTotal = 200
    expect(state.spendableTotal).toBeCloseTo(200, 4);
  });

  it('tx with selfTransferStatus=expired is re-included in spendableTotal', () => {
    const state = calculateAllowance({
      monthlyIncomeEstimate: 5000,
      savingsGoalAmount: 1000,
      period: 'monthly',
      alertThreshold: 0.2,
      transactions: [
        { type: 'PIX_OUT', amount: -500, selfTransferStatus: 'expired' }, // re-included
        { type: 'DEBIT',   amount: -200 },
      ],
      referenceDate: REF,
    });

    expect(state.spendableTotal).toBeCloseTo(700, 4);
  });
});

// ── Confidence scoring ────────────────────────────────────────────────────────

describe('computeConfidence', () => {
  const matched = pendingFromOut();
  const tx = inTx();

  it('base confidence is 0.85 without bonuses', () => {
    expect(computeConfidence(tx, matched, [])).toBeCloseTo(0.85);
  });

  it('+0.10 for keyword in description', () => {
    const keywordTx = inTx({ description: 'minha conta inter' });
    expect(computeConfidence(keywordTx, matched, [])).toBeCloseTo(0.95);
  });

  it('+0.05 for bank pair seen in confirmed history', () => {
    const history: SelfTransferPair[] = [
      createManualPair(outTx(), inTx()),
    ];
    expect(computeConfidence(tx, matched, history)).toBeCloseTo(0.90);
  });

  it('caps at 1.0 when both bonuses apply', () => {
    const keywordTx = inTx({ description: 'minha conta inter' });
    const history: SelfTransferPair[] = [createManualPair(outTx(), inTx())];
    const conf = computeConfidence(keywordTx, matched, history);
    expect(conf).toBeCloseTo(1.0);
    expect(conf).toBeLessThanOrEqual(1.0);
  });
});

// ── checkNewTransaction orchestration ────────────────────────────────────────

describe('checkNewTransaction', () => {
  const emptyState = { pending: [], confirmed: [] };

  it('adds tx to pending buffer when no match exists', () => {
    const { result, updatedState } = checkNewTransaction(outTx(), emptyState);
    expect(result).toBeNull();
    expect(updatedState.pending).toHaveLength(1);
    expect(updatedState.pending[0]!.txId).toBe('tx_out_01');
  });

  it('returns match and removes pending pair on match', () => {
    const stateWithPending = { pending: [pendingFromOut()], confirmed: [] };
    const { result, updatedState } = checkNewTransaction(inTx(), stateWithPending);

    expect(result).not.toBeNull();
    expect(result!.action).toBe('auto_confirm');
    expect(updatedState.pending).toHaveLength(0); // matched pair removed
    expect(updatedState.confirmed).toHaveLength(1);
  });
});
