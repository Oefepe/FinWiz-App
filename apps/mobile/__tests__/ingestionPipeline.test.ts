import { ingestNotification, isKnownPackage, getWatchedPackages, transactionToRow, BANK_PACKAGES, WALLET_PACKAGES } from '../lib/ingestionPipeline';
import { createDedupCache } from '@finwiz/notification-parser';
import type { RawNotificationEvent } from '@finwiz/notification-listener-android';

// Mock the database layer — op-sqlite is unavailable in test environment.
jest.mock('../lib/database', () => ({
  insertTransaction: jest.fn().mockResolvedValue(undefined),
  getPendingPairsForDetector: jest.fn().mockResolvedValue([]),
  getConfirmedPairBanks: jest.fn().mockResolvedValue([]),
  savePendingPair: jest.fn().mockResolvedValue(undefined),
  deletePendingPair: jest.fn().mockResolvedValue(undefined),
  saveConfirmedPair: jest.fn().mockResolvedValue(undefined),
  updateTransactionSelfTransfer: jest.fn().mockResolvedValue(undefined),
  pruneExpiredPairs: jest.fn().mockResolvedValue(undefined),
}));

// Mock obsidian client so vault writes don't throw.
jest.mock('@finwiz/obsidian-client', () => ({
  createObsidianClient: jest.fn().mockReturnValue({
    appendNote: jest.fn().mockResolvedValue(undefined),
  }),
}));

import { insertTransaction } from '../lib/database';
const mockInsert = insertTransaction as jest.MockedFunction<typeof insertTransaction>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRaw(overrides: Partial<RawNotificationEvent> = {}): RawNotificationEvent {
  return {
    appPackage: 'com.nu.production',
    title: 'Nubank',
    body: 'Pix enviado: R$ 500,00',
    timestamp: 1714000000000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isKnownPackage
// ---------------------------------------------------------------------------

describe('isKnownPackage', () => {
  it('accepts Nubank in bank_only mode', () => {
    expect(isKnownPackage('com.nu.production', 'bank_only')).toBe(true);
  });

  it('rejects Google Pay in bank_only mode', () => {
    expect(isKnownPackage('com.google.android.apps.walletnfcrel', 'bank_only')).toBe(false);
  });

  it('accepts Google Pay in wallet_only mode', () => {
    expect(isKnownPackage('com.google.android.apps.walletnfcrel', 'wallet_only')).toBe(true);
  });

  it('rejects Nubank in wallet_only mode', () => {
    expect(isKnownPackage('com.nu.production', 'wallet_only')).toBe(false);
  });

  it('accepts both Nubank and Google Pay in both mode', () => {
    expect(isKnownPackage('com.nu.production', 'both')).toBe(true);
    expect(isKnownPackage('com.google.android.apps.walletnfcrel', 'both')).toBe(true);
  });

  it('rejects unknown package in all modes', () => {
    expect(isKnownPackage('com.unknown.app', 'bank_only')).toBe(false);
    expect(isKnownPackage('com.unknown.app', 'wallet_only')).toBe(false);
    expect(isKnownPackage('com.unknown.app', 'both')).toBe(false);
  });

  it('contains all 6 bank packages', () => {
    expect(BANK_PACKAGES.size).toBe(6);
  });

  it('contains all 4 wallet packages', () => {
    expect(WALLET_PACKAGES.size).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// getWatchedPackages
// ---------------------------------------------------------------------------

describe('getWatchedPackages', () => {
  it('watches every bank when none are selected', () => {
    expect(getWatchedPackages('bank_only', [])).toEqual(Array.from(BANK_PACKAGES));
  });

  it('narrows banks to the selection', () => {
    expect(getWatchedPackages('bank_only', ['com.nu.production'])).toEqual(['com.nu.production']);
  });

  it('keeps wallets in both mode even when banks are selected', () => {
    const pkgs = getWatchedPackages('both', ['com.nu.production']);
    expect(pkgs).toContain('com.nu.production');
    expect(pkgs).not.toContain('com.itau');
    for (const w of WALLET_PACKAGES) expect(pkgs).toContain(w);
  });

  it('watches only wallets in wallet_only mode', () => {
    expect(getWatchedPackages('wallet_only', ['com.nu.production'])).toEqual(Array.from(WALLET_PACKAGES));
  });

  it('drops selected packages that are not known banks', () => {
    expect(getWatchedPackages('bank_only', ['com.unknown.app', 'com.itau'])).toEqual(['com.itau']);
  });
});

// ---------------------------------------------------------------------------
// transactionToRow
// ---------------------------------------------------------------------------

describe('transactionToRow', () => {
  it('converts timestamp to local YYYY-MM-DD and HH:MM:SS', () => {
    const now = new Date(2026, 3, 26, 14, 30, 5); // April 26, 2026 14:30:05 local
    const row = transactionToRow({
      id: 'tx_abc',
      timestamp: now,
      type: 'PIX_OUT',
      amount: -150,
      currency: 'BRL',
      description: 'Test',
      bank: 'nubank',
      rawNotification: 'body',
      confidence: 0.9,
      selfTransferId: '',
      source: 'bank',
      walletId: null,
    });
    expect(row.id).toBe('tx_abc');
    expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(row.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(row.type).toBe('PIX_OUT');
    expect(row.amount).toBe(-150);
    expect(row.source_bank).toBe('nubank');
    expect(row.self_transfer_id).toBe('');
    expect(row.category).toBe('');
  });
});

// ---------------------------------------------------------------------------
// ingestNotification — Nubank PIX_OUT
// ---------------------------------------------------------------------------

describe('ingestNotification — Nubank PIX enviado', () => {
  beforeEach(() => {
    mockInsert.mockClear();
  });

  it('parses Nubank PIX_OUT and persists with amount -500', async () => {
    const raw = makeRaw({ body: 'Pix enviado: R$ 500,00' });
    const cache = createDedupCache();
    const result = await ingestNotification(raw, 'bank_only', cache);

    expect(result).toBe(true);
    expect(mockInsert).toHaveBeenCalledTimes(1);

    const row = mockInsert.mock.calls[0]![0];
    expect(row.type).toBe('PIX_OUT');
    expect(row.amount).toBe(-500);
    expect(row.source_bank).toBe('nubank');
  });

  it('parses Nubank PIX_IN and persists with positive amount', async () => {
    const raw = makeRaw({ body: 'Pix recebido: R$ 200,00' });
    const cache = createDedupCache();
    await ingestNotification(raw, 'bank_only', cache);

    const row = mockInsert.mock.calls[0]![0];
    expect(row.type).toBe('PIX_IN');
    expect(row.amount).toBe(200);
  });

  it('returns false for unknown package', async () => {
    const raw = makeRaw({ appPackage: 'com.unknown.bank' });
    const result = await ingestNotification(raw, 'bank_only', createDedupCache());
    expect(result).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('deduplicates identical notifications within the same cache', async () => {
    const raw = makeRaw({ body: 'Pix enviado: R$ 100,00' });
    const cache = createDedupCache();
    await ingestNotification(raw, 'both', cache);
    const second = await ingestNotification(raw, 'both', cache);

    // Second call is a duplicate — dedup cache rejects it.
    expect(second).toBe(false);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('returns false for wallet package in bank_only mode', async () => {
    const raw = makeRaw({ appPackage: 'com.google.android.apps.walletnfcrel' });
    const result = await ingestNotification(raw, 'bank_only', createDedupCache());
    expect(result).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ingestNotification — Inter
// ---------------------------------------------------------------------------

describe('ingestNotification — Inter', () => {
  beforeEach(() => mockInsert.mockClear());

  it('parses Inter Pix enviado', async () => {
    const raw = makeRaw({
      appPackage: 'br.com.intermedium',
      body: 'Pix enviado: R$ 75,50',
    });
    await ingestNotification(raw, 'bank_only', createDedupCache());
    const row = mockInsert.mock.calls[0]![0];
    expect(row.type).toBe('PIX_OUT');
    expect(row.amount).toBeCloseTo(-75.5);
    expect(row.source_bank).toBe('inter');
  });
});
