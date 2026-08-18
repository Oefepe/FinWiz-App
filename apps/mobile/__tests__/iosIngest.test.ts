import {
  timingSafeEqual,
  isDuplicateIngestion,
  ingestIosNotification,
  _clearIdempotencyCache,
  type IngestResult,
} from '../lib/iosIngest';
import type { Transaction } from '@finwiz/notification-parser';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../lib/database', () => ({
  insertTransaction: jest.fn().mockResolvedValue(undefined),
}));

// Mock ingestionPipeline to avoid loading the Android native bridge.
jest.mock('../lib/ingestionPipeline', () => ({
  runPipeline: jest.fn().mockResolvedValue(undefined),
  transactionToRow: jest.fn().mockImplementation((tx: Transaction) => ({
    id: tx.id,
    date: '2024-04-10',
    time: '12:00',
    type: tx.type,
    amount: tx.amount,
    description: tx.description,
    source_bank: tx.bank,
    category: '',
    self_transfer_id: tx.selfTransferId,
  })),
}));

const mockParse = jest.fn<Transaction | null, any[]>();
jest.mock('@finwiz/notification-parser', () => ({
  parseNotification: (...args: unknown[]) => mockParse(...(args as [])),
}));

const MOCK_TX: Transaction = {
  id: 'tx-test-001',
  type: 'DEBIT',
  amount: -50,
  currency: 'BRL',
  description: 'Supermercado',
  bank: 'nubank',
  rawNotification: 'Compra de R$50,00',
  selfTransferId: '',
  timestamp: new Date(1712750400000),
  confidence: 0.95,
  source: 'bank',
  walletId: null,
};

// ---------------------------------------------------------------------------
// T7 — Constant-time comparison
// ---------------------------------------------------------------------------

describe('timingSafeEqual — constant-time string comparison', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true);
  });

  it('returns false when content differs by one character', () => {
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false);
  });

  it('returns false when strings have different lengths', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });

  it('returns false when the first character differs (no early exit)', () => {
    // If the function short-circuited on the first char it would still return
    // false — the key invariant is that it ALWAYS walks every character.
    // We verify the result is correct even when the difference is at position 0.
    expect(timingSafeEqual('Xbc', 'abc')).toBe(false);
  });

  it('returns false when only the last character differs (all prior chars match)', () => {
    expect(timingSafeEqual('aaaaaz', 'aaaaab')).toBe(false);
  });

  it('returns true for empty strings', () => {
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('returns false when one string is empty and the other is not', () => {
    expect(timingSafeEqual('', 'a')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T6 — ingestIosNotification behaviour
// ---------------------------------------------------------------------------

const SECRET = 'correct-secret-key-32chars-padded';
const NUBANK_PKG = 'com.nu.production';

function baseParams() {
  return {
    bank: NUBANK_PKG,
    title: 'Nubank',
    body: 'Compra de R$50,00',
    ts: '1712750400000',
    hmac: SECRET,
    storedSecret: SECRET,
    captureMode: 'automatic' as const,
  };
}

describe('ingestIosNotification', () => {
  beforeEach(() => {
    _clearIdempotencyCache();
    jest.clearAllMocks();
    mockParse.mockReturnValue(MOCK_TX);
  });

  it('valid HMAC with parseable notification returns ok and persists transaction', async () => {
    const { runPipeline } = require('../lib/ingestionPipeline') as {
      runPipeline: jest.Mock;
    };

    const result = await ingestIosNotification(baseParams());

    expect(result).toBe('ok' satisfies IngestResult);
    expect(runPipeline).toHaveBeenCalledTimes(1);
  });

  it('invalid HMAC returns invalid_hmac without calling insertTransaction', async () => {
    const { insertTransaction } = require('../lib/database') as {
      insertTransaction: jest.Mock;
    };

    const result = await ingestIosNotification({
      ...baseParams(),
      hmac: 'wrong-secret-key-32chars-paddddd',
    });

    expect(result).toBe('invalid_hmac' satisfies IngestResult);
    expect(insertTransaction).not.toHaveBeenCalled();
  });

  it('missing title returns missing_params gracefully', async () => {
    const result = await ingestIosNotification({ ...baseParams(), title: null });
    expect(result).toBe('missing_params' satisfies IngestResult);
  });

  it('missing body returns missing_params gracefully', async () => {
    const result = await ingestIosNotification({ ...baseParams(), body: null });
    expect(result).toBe('missing_params' satisfies IngestResult);
  });

  it('missing ts returns missing_params gracefully', async () => {
    const result = await ingestIosNotification({ ...baseParams(), ts: null });
    expect(result).toBe('missing_params' satisfies IngestResult);
  });

  it('missing hmac returns missing_params gracefully', async () => {
    const result = await ingestIosNotification({ ...baseParams(), hmac: null });
    expect(result).toBe('missing_params' satisfies IngestResult);
  });

  it('duplicate bank+ts within 60 s returns duplicate without re-inserting', async () => {
    const { runPipeline } = require('../lib/ingestionPipeline') as {
      runPipeline: jest.Mock;
    };

    await ingestIosNotification(baseParams());
    const second = await ingestIosNotification(baseParams());

    expect(second).toBe('duplicate' satisfies IngestResult);
    expect(runPipeline).toHaveBeenCalledTimes(1);
  });

  it('same bank but different ts is not a duplicate', async () => {
    await ingestIosNotification({ ...baseParams(), ts: '1712750400000' });
    const result = await ingestIosNotification({ ...baseParams(), ts: '1712750401000' });

    expect(result).toBe('ok' satisfies IngestResult);
  });

  it('non-parseable notification returns parse_error', async () => {
    mockParse.mockReturnValue(null);

    const result = await ingestIosNotification(baseParams());

    expect(result).toBe('parse_error' satisfies IngestResult);
  });

  it('non-numeric ts returns parse_error', async () => {
    const result = await ingestIosNotification({ ...baseParams(), ts: 'not-a-number' });
    expect(result).toBe('parse_error' satisfies IngestResult);
  });
});

// ---------------------------------------------------------------------------
// captureMode gating — automated capture can be paused from Settings
// ---------------------------------------------------------------------------

describe('ingestIosNotification — captureMode gating', () => {
  beforeEach(() => {
    _clearIdempotencyCache();
    jest.clearAllMocks();
    mockParse.mockReturnValue(MOCK_TX);
  });

  it('manual_only returns manual_only without persisting, even with a valid HMAC', async () => {
    const { runPipeline } = require('../lib/ingestionPipeline') as {
      runPipeline: jest.Mock;
    };

    const result = await ingestIosNotification({ ...baseParams(), captureMode: 'manual_only' });

    expect(result).toBe('manual_only' satisfies IngestResult);
    expect(runPipeline).not.toHaveBeenCalled();
  });

  it('invalid HMAC is still rejected before captureMode is checked', async () => {
    const result = await ingestIosNotification({
      ...baseParams(),
      captureMode: 'manual_only',
      hmac: 'wrong-secret-key-32chars-paddddd',
    });

    expect(result).toBe('invalid_hmac' satisfies IngestResult);
  });

  it('manual_only does not consume the idempotency slot for a later automatic retry', async () => {
    await ingestIosNotification({ ...baseParams(), captureMode: 'manual_only' });
    const result = await ingestIosNotification({ ...baseParams(), captureMode: 'automatic' });

    expect(result).toBe('ok' satisfies IngestResult);
  });
});

// ---------------------------------------------------------------------------
// Idempotency cache isolation
// ---------------------------------------------------------------------------

describe('isDuplicateIngestion', () => {
  beforeEach(() => _clearIdempotencyCache());

  it('first call for a key returns false', () => {
    expect(isDuplicateIngestion('com.nu.production', '1000')).toBe(false);
  });

  it('second call for the same key returns true', () => {
    isDuplicateIngestion('com.nu.production', '1000');
    expect(isDuplicateIngestion('com.nu.production', '1000')).toBe(true);
  });

  it('different ts for same bank is a distinct key', () => {
    isDuplicateIngestion('com.nu.production', '1000');
    expect(isDuplicateIngestion('com.nu.production', '2000')).toBe(false);
  });

  it('same ts for different bank is a distinct key', () => {
    isDuplicateIngestion('com.nu.production', '1000');
    expect(isDuplicateIngestion('com.bradesco', '1000')).toBe(false);
  });
});
