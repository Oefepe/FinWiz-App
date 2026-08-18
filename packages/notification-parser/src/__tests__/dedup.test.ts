import { createDedupCache, checkAndRecord } from '../dedup';
import { parseNotification } from '../index';
import type { RawNotification, Transaction } from '../types';

const TS = 1_714_000_000_000; // fixed base timestamp

// ── DedupCache primitives ─────────────────────────────────────────────────────

function makeTx(amount: number, timestampMs: number): Transaction {
  return {
    id: 'test',
    timestamp: new Date(timestampMs),
    type: 'DEBIT',
    amount,
    currency: 'BRL',
    description: 'test',
    bank: 'unknown',
    rawNotification: '',
    confidence: 0.8,
    selfTransferId: '',
    source: 'wallet',
    walletId: 'googlepay',
  };
}

describe('createDedupCache', () => {
  it('returns a fresh empty Set', () => {
    const cache = createDedupCache();
    expect(cache.size).toBe(0);
  });
});

describe('checkAndRecord', () => {
  it('first occurrence returns false (not a duplicate)', () => {
    const cache = createDedupCache();
    expect(checkAndRecord(cache, makeTx(-50, TS))).toBe(false);
  });

  it('second occurrence of same amount in same 30s bucket returns true (duplicate)', () => {
    const cache = createDedupCache();
    checkAndRecord(cache, makeTx(-50, TS));
    expect(checkAndRecord(cache, makeTx(-50, TS + 5_000))).toBe(true);
  });

  it('different amount in same bucket → not a duplicate', () => {
    const cache = createDedupCache();
    checkAndRecord(cache, makeTx(-50, TS));
    expect(checkAndRecord(cache, makeTx(-75, TS + 5_000))).toBe(false);
  });

  it('same amount in different 30s bucket → not a duplicate', () => {
    const cache = createDedupCache();
    checkAndRecord(cache, makeTx(-50, TS));
    // TS and TS + 30_000 fall in different buckets
    expect(checkAndRecord(cache, makeTx(-50, TS + 30_000))).toBe(false);
  });

  it('fingerprint uses absolute value — outgoing and incoming same amount collide', () => {
    // This is intentional: wallet always-outgoing and bank possibly-incoming would
    // not be confused in practice, but the cache is conservative and flags them.
    const cache = createDedupCache();
    checkAndRecord(cache, makeTx(-50, TS));
    expect(checkAndRecord(cache, makeTx(50, TS + 1_000))).toBe(true);
  });
});

// ── parseNotification mode routing ───────────────────────────────────────────

function bankNotif(body: string): RawNotification {
  return { appPackage: 'com.nu.production', title: 'Nubank', body, timestamp: TS };
}

function walletNotif(body: string): RawNotification {
  return {
    appPackage: 'com.google.android.apps.walletnfcrel',
    title: 'Google Pay',
    body,
    timestamp: TS + 3_000,  // arrives 3s after bank notification
  };
}

describe('parseNotification — mode: wallet_only', () => {
  it('bank notification → null (not processed)', () => {
    const result = parseNotification(
      bankNotif('Compra no débito de R$ 50,00'),
      { mode: 'wallet_only' },
    );
    expect(result).toBeNull();
  });

  it('wallet notification → parsed as DEBIT', () => {
    const result = parseNotification(
      walletNotif('Você pagou R$ 50,00 em Loja X'),
      { mode: 'wallet_only' },
    );
    expect(result).not.toBeNull();
    expect(result!.source).toBe('wallet');
    expect(result!.walletId).toBe('googlepay');
  });
});

describe('parseNotification — mode: bank_only', () => {
  it('wallet notification → falls to generic fallback (UNKNOWN)', () => {
    const result = parseNotification(
      walletNotif('Você pagou R$ 50,00 em Loja X'),
      { mode: 'bank_only' },
    );
    // No wallet parsers run; falls to generic fallback
    expect(result).not.toBeNull();
    expect(result!.type).toBe('UNKNOWN');
    expect(result!.source).toBe('bank');
  });

  it('bank notification → parsed normally', () => {
    const result = parseNotification(
      bankNotif('Pix enviado: R$ 200,00'),
      { mode: 'bank_only' },
    );
    expect(result!.bank).toBe('nubank');
    expect(result!.type).toBe('PIX_OUT');
  });
});

describe('parseNotification — mode: both (NFC dedup)', () => {
  it('bank notification arrives first → accepted; wallet duplicate → null', () => {
    const cache = createDedupCache();
    const bank = parseNotification(
      bankNotif('Compra no débito de R$ 89,90 em Supermercado'),
      { mode: 'both', dedupCache: cache },
    );
    const wallet = parseNotification(
      walletNotif('Você pagou R$ 89,90 em Supermercado Extra'),
      { mode: 'both', dedupCache: cache },
    );

    expect(bank).not.toBeNull();
    expect(bank!.source).toBe('bank');
    expect(wallet).toBeNull(); // same amount in same 30s bucket → duplicate
  });

  it('wallet arrives first → accepted; bank duplicate → null', () => {
    const cache = createDedupCache();
    const wallet = parseNotification(
      { ...walletNotif('Você pagou R$ 50,00 em Loja'), timestamp: TS },
      { mode: 'both', dedupCache: cache },
    );
    const bank = parseNotification(
      { ...bankNotif('Compra no débito de R$ 50,00 em Loja'), timestamp: TS + 2_000 },
      { mode: 'both', dedupCache: cache },
    );

    expect(wallet).not.toBeNull();
    expect(wallet!.walletId).toBe('googlepay');
    expect(bank).toBeNull();
  });

  it('two different amounts in both mode → both pass through', () => {
    const cache = createDedupCache();
    const a = parseNotification(
      bankNotif('Compra no débito de R$ 50,00'),
      { mode: 'both', dedupCache: cache },
    );
    const b = parseNotification(
      bankNotif('Pix enviado: R$ 200,00'),
      { mode: 'both', dedupCache: cache },
    );

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
  });

  it('no-options call still returns Transaction (overload backward-compat)', () => {
    // This call uses the no-options overload → return type is Transaction, never null.
    const tx: Transaction = parseNotification(bankNotif('Pix enviado: R$ 100,00'));
    expect(tx.bank).toBe('nubank');
  });
});
