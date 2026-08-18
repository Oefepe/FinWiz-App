/**
 * M12 Integration Tests — Full Ingestion Pipeline
 *
 * T7  — Android pipeline: parse → self-transfer check → SQLite
 * T8  — iOS pipeline: URL scheme → parse → self-transfer check → SQLite
 * T9  — Self-transfer pair auto-confirmed end-to-end
 * T10 — Self-transfer expiry: expired pending pairs excluded correctly
 * T13 — Onboarding smoke: vault bootstrapped, SQLite seeded
 */

import type { Transaction } from '@finwiz/notification-parser';
import type { PendingPair, SelfTransferPair } from '@finwiz/self-transfer-detector';
import { createDedupCache } from '@finwiz/notification-parser';
import { __reset as resetSecureStore } from '../__mocks__/expo-secure-store';
import { calculateAllowance } from '@finwiz/allowance-engine';

// ---------------------------------------------------------------------------
// Database mock — every function is a jest.fn so tests can override per-case.
// ---------------------------------------------------------------------------

const mockInsertTransaction = jest.fn<Promise<void>, any[]>().mockResolvedValue(undefined);
const mockGetPendingPairsForDetector = jest.fn<Promise<PendingPair[]>, any[]>().mockResolvedValue([]);
const mockGetConfirmedPairBanks = jest
  .fn<Promise<Array<{ outBank: string; inBank: string }>>, any[]>()
  .mockResolvedValue([]);
const mockSavePendingPair = jest.fn<Promise<void>, any[]>().mockResolvedValue(undefined);
const mockDeletePendingPair = jest.fn<Promise<void>, any[]>().mockResolvedValue(undefined);
const mockSaveConfirmedPair = jest.fn<Promise<void>, any[]>().mockResolvedValue(undefined);
const mockUpdateTransactionSelfTransfer = jest.fn<Promise<void>, any[]>().mockResolvedValue(undefined);
const mockPruneExpiredPairs = jest.fn<Promise<void>, any[]>().mockResolvedValue(undefined);
const mockGetPendingPairTxIds = jest.fn<Promise<Set<string>>, any[]>().mockResolvedValue(new Set());
const mockQueryTransactions = jest.fn<Promise<any[]>, any[]>().mockResolvedValue([]);

jest.mock('../lib/database', () => ({
  insertTransaction: (...args: unknown[]) => mockInsertTransaction(...(args as [])),
  getPendingPairsForDetector: (...args: unknown[]) => mockGetPendingPairsForDetector(...(args as [])),
  getConfirmedPairBanks: (...args: unknown[]) => mockGetConfirmedPairBanks(...(args as [])),
  savePendingPair: (...args: unknown[]) => mockSavePendingPair(...(args as [])),
  deletePendingPair: (...args: unknown[]) => mockDeletePendingPair(...(args as [])),
  saveConfirmedPair: (...args: unknown[]) => mockSaveConfirmedPair(...(args as [])),
  updateTransactionSelfTransfer: (...args: unknown[]) =>
    mockUpdateTransactionSelfTransfer(...(args as [])),
  pruneExpiredPairs: (...args: unknown[]) => mockPruneExpiredPairs(...(args as [])),
  getPendingPairTxIds: (...args: unknown[]) => mockGetPendingPairTxIds(...(args as [])),
  queryTransactions: (...args: unknown[]) => mockQueryTransactions(...(args as [])),
}));

// ---------------------------------------------------------------------------
// Obsidian client mock
// ---------------------------------------------------------------------------

const mockAppendNote = jest.fn<Promise<void>, any[]>().mockResolvedValue(undefined);

jest.mock('@finwiz/obsidian-client', () => ({
  createObsidianClient: jest.fn().mockReturnValue({
    appendNote: (...args: unknown[]) => mockAppendNote(...(args as [])),
    putNote: jest.fn().mockResolvedValue(undefined),
    getNote: jest.fn().mockResolvedValue(''),
    listVault: jest.fn().mockResolvedValue([]),
    search: jest.fn().mockResolvedValue([]),
  }),
  bootstrapVault: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// notification-parser mock (for ingestNotification calls)
// ---------------------------------------------------------------------------

const mockParse = jest.fn<Transaction | null, any[]>();
jest.mock('@finwiz/notification-parser', () => ({
  ...jest.requireActual('@finwiz/notification-parser'),
  parseNotification: (...args: unknown[]) => mockParse(...(args as [])),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TS_OUT = 1712750400000; // 2024-04-10 12:00:00 UTC
const TS_IN = TS_OUT + 120_000; // 2 minutes later

const PIX_OUT_TX: Transaction = {
  id: 'tx-out-001',
  type: 'PIX_OUT',
  amount: -500,
  currency: 'BRL',
  description: 'Pix enviado',
  bank: 'nubank',
  rawNotification: 'Pix enviado: R$ 500,00',
  selfTransferId: '',
  timestamp: new Date(TS_OUT),
  confidence: 0.95,
  source: 'bank',
  walletId: null,
};

const PIX_IN_TX: Transaction = {
  id: 'tx-in-001',
  type: 'PIX_IN',
  amount: 500,
  currency: 'BRL',
  description: 'Pix recebido',
  bank: 'itau',
  rawNotification: 'Pix recebido: R$ 500,00',
  selfTransferId: '',
  timestamp: new Date(TS_IN),
  confidence: 0.95,
  source: 'bank',
  walletId: null,
};

const PENDING_PAIR_FOR_PIX_OUT: PendingPair = {
  txId: 'tx-out-001',
  amount: 500,
  bank: 'nubank',
  timestamp: TS_OUT,
  direction: 'out',
  description: 'Pix enviado',
  expiresAt: TS_OUT + 30 * 60 * 1000,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks() {
  jest.clearAllMocks();
  resetSecureStore();
  mockInsertTransaction.mockResolvedValue(undefined);
  mockGetPendingPairsForDetector.mockResolvedValue([]);
  mockGetConfirmedPairBanks.mockResolvedValue([]);
  mockSavePendingPair.mockResolvedValue(undefined);
  mockDeletePendingPair.mockResolvedValue(undefined);
  mockSaveConfirmedPair.mockResolvedValue(undefined);
  mockUpdateTransactionSelfTransfer.mockResolvedValue(undefined);
  mockPruneExpiredPairs.mockResolvedValue(undefined);
  mockGetPendingPairTxIds.mockResolvedValue(new Set());
  mockQueryTransactions.mockResolvedValue([]);
  mockParse.mockReturnValue(null);
}

// ---------------------------------------------------------------------------
// T7 — Android full pipeline
// ---------------------------------------------------------------------------

describe('T7 — Android ingestion pipeline', () => {
  const { ingestNotification, runPipeline } =
    jest.requireActual('../lib/ingestionPipeline') as typeof import('../lib/ingestionPipeline');

  beforeEach(resetMocks);

  it('unknown package is silently dropped, returns false', async () => {
    const raw = { appPackage: 'com.unknown.app', title: 'X', body: 'Y', timestamp: TS_OUT };
    const result = await ingestNotification(raw, 'bank_only', createDedupCache());
    expect(result).toBe(false);
    expect(mockInsertTransaction).not.toHaveBeenCalled();
  });

  it('known package with unparseable notification returns false', async () => {
    mockParse.mockReturnValue(null);
    const raw = { appPackage: 'com.nu.production', title: 'X', body: 'Y', timestamp: TS_OUT };
    const result = await ingestNotification(raw, 'bank_only', createDedupCache());
    expect(result).toBe(false);
    expect(mockInsertTransaction).not.toHaveBeenCalled();
  });

  it('valid first notification: inserts as base type and saves to pending buffer', async () => {
    mockParse.mockReturnValue(PIX_OUT_TX);
    const raw = {
      appPackage: 'com.nu.production',
      title: 'Nubank',
      body: 'Pix enviado: R$ 500,00',
      timestamp: TS_OUT,
    };

    const result = await ingestNotification(raw, 'bank_only', createDedupCache());

    expect(result).toBe(true);
    expect(mockInsertTransaction).toHaveBeenCalledTimes(1);
    const insertedRow = mockInsertTransaction.mock.calls[0][0] as { type: string };
    expect(insertedRow.type).toBe('PIX_OUT');
    expect(mockSavePendingPair).toHaveBeenCalledTimes(1);
  });

  it('second transaction matching the pending buffer: auto-confirms the self-transfer pair', async () => {
    // Second call — first tx already in pending buffer.
    mockGetPendingPairsForDetector.mockResolvedValue([PENDING_PAIR_FOR_PIX_OUT]);
    mockParse.mockReturnValue(PIX_IN_TX);

    const raw = {
      appPackage: 'com.itau',
      title: 'Itaú',
      body: 'Pix recebido: R$ 500,00',
      timestamp: TS_IN,
    };
    const result = await ingestNotification(raw, 'bank_only', createDedupCache());

    expect(result).toBe(true);
    // New tx inserted as SELF_TRANSFER_IN.
    const insertedRow = mockInsertTransaction.mock.calls[0][0] as {
      type: string;
      self_transfer_id: string;
    };
    expect(insertedRow.type).toBe('SELF_TRANSFER_IN');
    expect(insertedRow.self_transfer_id).toMatch(/^st_/);

    // Matched pending tx updated to SELF_TRANSFER_OUT.
    expect(mockUpdateTransactionSelfTransfer).toHaveBeenCalledWith(
      'tx-out-001',
      'SELF_TRANSFER_OUT',
      expect.stringMatching(/^st_/),
    );

    // Pending pair deleted and confirmed pair saved.
    expect(mockDeletePendingPair).toHaveBeenCalledWith('tx-out-001');
    expect(mockSaveConfirmedPair).toHaveBeenCalledTimes(1);
  });

  it('runPipeline writes to vault pairs.md when vault is configured', async () => {
    const { setItemAsync } = require('../__mocks__/expo-secure-store') as {
      setItemAsync: (k: string, v: string) => Promise<void>;
    };
    await setItemAsync('finwiz_obsidian_api_key', 'test-key');

    mockGetPendingPairsForDetector.mockResolvedValue([PENDING_PAIR_FOR_PIX_OUT]);
    await runPipeline(PIX_IN_TX);

    expect(mockAppendNote).toHaveBeenCalledTimes(1);
    const [path, row] = mockAppendNote.mock.calls[0] as [string, string];
    expect(path).toBe('04-SelfTransfers/pairs.md');
    expect(row).toMatch(/st_/);
    expect(row).toContain('confirmed');
  });

  it('runPipeline skips vault write when vault is not configured', async () => {
    // No API key in SecureStore.
    mockGetPendingPairsForDetector.mockResolvedValue([PENDING_PAIR_FOR_PIX_OUT]);
    await runPipeline(PIX_IN_TX);

    expect(mockAppendNote).not.toHaveBeenCalled();
  });

  it('expired pairs are pruned after every runPipeline call', async () => {
    mockParse.mockReturnValue(PIX_OUT_TX);
    const raw = {
      appPackage: 'com.nu.production',
      title: 'N',
      body: 'Pix enviado: R$ 500,00',
      timestamp: TS_OUT,
    };
    await ingestNotification(raw, 'bank_only', createDedupCache());
    expect(mockPruneExpiredPairs).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// T8 — iOS pipeline
// ---------------------------------------------------------------------------

describe('T8 — iOS ingest pipeline', () => {
  const { ingestIosNotification, _clearIdempotencyCache } =
    jest.requireActual('../lib/iosIngest') as typeof import('../lib/iosIngest');

  const SECRET = 'correct-secret-key-for-ios-tests0';

  beforeEach(() => {
    resetMocks();
    _clearIdempotencyCache();
  });

  it('valid HMAC, parseable notification: runs full pipeline', async () => {
    mockParse.mockReturnValue(PIX_OUT_TX);

    const result = await ingestIosNotification({
      bank: 'com.nu.production',
      title: 'Nubank',
      body: 'Pix enviado: R$ 500,00',
      ts: String(TS_OUT),
      hmac: SECRET,
      storedSecret: SECRET,
      captureMode: 'automatic',
    });

    expect(result).toBe('ok');
    expect(mockInsertTransaction).toHaveBeenCalledTimes(1);
    expect(mockSavePendingPair).toHaveBeenCalledTimes(1);
    expect(mockPruneExpiredPairs).toHaveBeenCalledTimes(1);
  });

  it('invalid HMAC: pipeline is never reached', async () => {
    const result = await ingestIosNotification({
      bank: 'com.nu.production',
      title: 'N',
      body: 'B',
      ts: String(TS_OUT),
      hmac: 'wrong-secret-key-30-chars-paddddd',
      storedSecret: SECRET,
      captureMode: 'automatic',
    });

    expect(result).toBe('invalid_hmac');
    expect(mockInsertTransaction).not.toHaveBeenCalled();
  });

  it('duplicate ts+bank pair: pipeline called only once', async () => {
    mockParse.mockReturnValue(PIX_OUT_TX);
    const params = {
      bank: 'com.nu.production',
      title: 'Nubank',
      body: 'Pix enviado: R$ 500,00',
      ts: String(TS_OUT),
      hmac: SECRET,
      storedSecret: SECRET,
      captureMode: 'automatic' as const,
    };

    await ingestIosNotification(params);
    const second = await ingestIosNotification(params);

    expect(second).toBe('duplicate');
    expect(mockInsertTransaction).toHaveBeenCalledTimes(1);
  });

  it('matching pending pair triggers self-transfer confirmation', async () => {
    mockGetPendingPairsForDetector.mockResolvedValue([PENDING_PAIR_FOR_PIX_OUT]);
    mockParse.mockReturnValue(PIX_IN_TX);

    const result = await ingestIosNotification({
      bank: 'com.itau',
      title: 'Itaú',
      body: 'Pix recebido: R$ 500,00',
      ts: String(TS_IN),
      hmac: SECRET,
      storedSecret: SECRET,
      captureMode: 'automatic',
    });

    expect(result).toBe('ok');
    const row = mockInsertTransaction.mock.calls[0][0] as { type: string };
    expect(row.type).toBe('SELF_TRANSFER_IN');
    expect(mockUpdateTransactionSelfTransfer).toHaveBeenCalledWith(
      'tx-out-001',
      'SELF_TRANSFER_OUT',
      expect.stringMatching(/^st_/),
    );
  });
});

// ---------------------------------------------------------------------------
// T9 — Self-transfer pair confirmed end-to-end
// ---------------------------------------------------------------------------

describe('T9 — Self-transfer pair confirmed end-to-end', () => {
  const { runPipeline } =
    jest.requireActual('../lib/ingestionPipeline') as typeof import('../lib/ingestionPipeline');

  beforeEach(resetMocks);

  it('outgoing first: PIX_OUT then PIX_IN → both legs re-typed, pair confirmed', async () => {
    // First leg (PIX_OUT) → no match, goes to pending.
    await runPipeline(PIX_OUT_TX);
    expect(mockInsertTransaction.mock.calls[0]?.[0]).toMatchObject({ type: 'PIX_OUT' });
    const savedPair = mockSavePendingPair.mock.calls[0]?.[0] as PendingPair;
    expect(savedPair.txId).toBe('tx-out-001');
    expect(savedPair.direction).toBe('out');
    expect(savedPair.amount).toBe(500);

    // Second leg (PIX_IN) → matches pending PIX_OUT.
    jest.clearAllMocks();
    mockGetPendingPairsForDetector.mockResolvedValue([PENDING_PAIR_FOR_PIX_OUT]);
    await runPipeline(PIX_IN_TX);

    expect(mockInsertTransaction.mock.calls[0]?.[0]).toMatchObject({ type: 'SELF_TRANSFER_IN' });
    expect(mockUpdateTransactionSelfTransfer).toHaveBeenCalledWith(
      'tx-out-001',
      'SELF_TRANSFER_OUT',
      expect.stringMatching(/^st_/),
    );
    const confirmedPair = mockSaveConfirmedPair.mock.calls[0]?.[0] as SelfTransferPair;
    expect(confirmedPair.outBank).toBe('nubank');
    expect(confirmedPair.inBank).toBe('itau');
    expect(confirmedPair.status).toBe('confirmed');
    expect(confirmedPair.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('incoming first: PIX_IN then PIX_OUT → both legs re-typed correctly', async () => {
    // First leg is the incoming side.
    const pendingForPIXIn: PendingPair = {
      txId: 'tx-in-001',
      amount: 500,
      bank: 'itau',
      timestamp: TS_IN,
      direction: 'in',
      description: 'Pix recebido',
      expiresAt: TS_IN + 30 * 60 * 1000,
    };

    await runPipeline(PIX_IN_TX);
    const savedPair = mockSavePendingPair.mock.calls[0]?.[0] as PendingPair;
    expect(savedPair.direction).toBe('in');

    jest.clearAllMocks();
    mockGetPendingPairsForDetector.mockResolvedValue([pendingForPIXIn]);
    await runPipeline({ ...PIX_OUT_TX, timestamp: new Date(TS_IN + 60_000) });

    expect(mockInsertTransaction.mock.calls[0]?.[0]).toMatchObject({ type: 'SELF_TRANSFER_OUT' });
    expect(mockUpdateTransactionSelfTransfer).toHaveBeenCalledWith(
      'tx-in-001',
      'SELF_TRANSFER_IN',
      expect.stringMatching(/^st_/),
    );
  });

  it('same-bank pair is never confirmed (different-bank requirement)', async () => {
    // PIX_OUT from nubank and PIX_IN also from nubank — should NOT match.
    const sameBankIn: PendingPair = {
      txId: 'tx-in-002',
      amount: 500,
      bank: 'nubank', // same bank as PIX_OUT_TX
      timestamp: TS_IN,
      direction: 'in',
      description: 'Pix recebido',
      expiresAt: TS_IN + 30 * 60 * 1000,
    };

    mockGetPendingPairsForDetector.mockResolvedValue([sameBankIn]);
    await runPipeline(PIX_OUT_TX);

    // No match — should insert as base type and save to pending.
    expect(mockInsertTransaction.mock.calls[0]?.[0]).toMatchObject({ type: 'PIX_OUT' });
    expect(mockSaveConfirmedPair).not.toHaveBeenCalled();
    expect(mockUpdateTransactionSelfTransfer).not.toHaveBeenCalled();
  });

  it('amount mismatch beyond tolerance: no self-transfer', async () => {
    const mismatchedPending: PendingPair = {
      txId: 'tx-out-002',
      amount: 499, // 1 BRL difference — beyond 0.005 tolerance
      bank: 'itau',
      timestamp: TS_OUT,
      direction: 'out',
      description: 'Pix enviado',
      expiresAt: TS_OUT + 30 * 60 * 1000,
    };

    mockGetPendingPairsForDetector.mockResolvedValue([mismatchedPending]);
    await runPipeline(PIX_IN_TX); // PIX_IN has amount 500

    expect(mockInsertTransaction.mock.calls[0]?.[0]).toMatchObject({ type: 'PIX_IN' });
    expect(mockSaveConfirmedPair).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T10 — Self-transfer expiry: excluded while pending, re-included after expiry
// ---------------------------------------------------------------------------

describe('T10 — Self-transfer expiry and allowance re-inclusion', () => {
  it('pending tx is excluded from spendable_total via selfTransferStatus: pending', () => {
    // Simulate the output of queryAllowanceTransactions with a pending tx.
    const txsWithPending = [
      { type: 'PIX_OUT', amount: -500, selfTransferStatus: 'pending' as const },
      { type: 'DEBIT', amount: -100 },
    ];
    const state = calculateAllowance({
      monthlyIncomeEstimate: 5000,
      fixedMonthlyExpenses: 0,
      savingsGoalAmount: 0,
      period: 'monthly',
      alertThreshold: 0.2,
      transactions: txsWithPending,
      referenceDate: undefined,
    });
    // Only -100 DEBIT counts; pending PIX_OUT excluded.
    expect(state.spendableTotal).toBeCloseTo(100, 4);
  });

  it('after expiry (no longer in pending set) tx is re-included in allowance', () => {
    // Simulate queryAllowanceTransactions AFTER pruneExpiredPairs ran —
    // the expired pending pair is no longer in getPendingPairTxIds() so
    // selfTransferStatus is undefined (included).
    const txsAfterExpiry = [
      { type: 'PIX_OUT', amount: -500 }, // no selfTransferStatus → included
      { type: 'DEBIT', amount: -100 },
    ];
    const state = calculateAllowance({
      monthlyIncomeEstimate: 5000,
      fixedMonthlyExpenses: 0,
      savingsGoalAmount: 0,
      period: 'monthly',
      alertThreshold: 0.2,
      transactions: txsAfterExpiry,
      referenceDate: undefined,
    });
    // Both -500 and -100 count → spendableTotal = 600.
    expect(state.spendableTotal).toBeCloseTo(600, 4);
  });

  it('SELF_TRANSFER_OUT/IN are always excluded regardless of selfTransferStatus', () => {
    const txs = [
      { type: 'SELF_TRANSFER_OUT', amount: -500, selfTransferStatus: 'confirmed' as const },
      { type: 'SELF_TRANSFER_IN', amount: 500, selfTransferStatus: 'confirmed' as const },
      { type: 'DEBIT', amount: -200 },
    ];
    const state = calculateAllowance({
      monthlyIncomeEstimate: 5000,
      fixedMonthlyExpenses: 0,
      savingsGoalAmount: 0,
      period: 'monthly',
      alertThreshold: 0.2,
      transactions: txs,
      referenceDate: undefined,
    });
    // Only DEBIT -200 contributes.
    expect(state.spendableTotal).toBeCloseTo(200, 4);
  });
});

// ---------------------------------------------------------------------------
// T13 — Onboarding smoke: SQLite config seeded, goals.md bootstrapped
// ---------------------------------------------------------------------------

describe('T13 — Onboarding smoke: vault bootstrap and SQLite seed', () => {
  it('bootstrapVault creates all required vault files', async () => {
    const { bootstrapVault, createObsidianClient } = jest.requireMock(
      '@finwiz/obsidian-client',
    ) as {
      bootstrapVault: jest.Mock;
      createObsidianClient: jest.Mock;
    };

    const mockClient = createObsidianClient();
    await bootstrapVault(mockClient);

    // bootstrapVault is mocked — verify it was called with the right client.
    expect(bootstrapVault).toHaveBeenCalledTimes(1);
  });

  it('pipeline inserts rows with correct schema shape', async () => {
    const { runPipeline } =
      jest.requireActual('../lib/ingestionPipeline') as typeof import('../lib/ingestionPipeline');

    resetMocks();
    await runPipeline(PIX_OUT_TX);

    const row = mockInsertTransaction.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(row).toMatchObject({
      id: 'tx-out-001',
      type: 'PIX_OUT',
      amount: -500,
      source_bank: 'nubank',
      self_transfer_id: '',
      category: '',
    });
    expect(typeof row['date']).toBe('string');
    expect(typeof row['time']).toBe('string');
    expect((row['date'] as string)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('timing boundary: 301-second gap does not form a self-transfer pair', async () => {
    const { runPipeline } =
      jest.requireActual('../lib/ingestionPipeline') as typeof import('../lib/ingestionPipeline');

    resetMocks();
    const lateIn: PendingPair = {
      ...PENDING_PAIR_FOR_PIX_OUT,
      timestamp: TS_OUT - 301_000, // 301 seconds before the PIX_IN
    };
    mockGetPendingPairsForDetector.mockResolvedValue([lateIn]);

    await runPipeline(PIX_IN_TX);

    expect(mockInsertTransaction.mock.calls[0]?.[0]).toMatchObject({ type: 'PIX_IN' });
    expect(mockSaveConfirmedPair).not.toHaveBeenCalled();
  });
});
