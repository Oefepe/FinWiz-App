import { canParse, parse } from '../../banks/googlepay';
import type { RawNotification } from '../../types';

const MAIN_PKG = 'com.google.android.apps.walletnfcrel';
const ALT_PKG = 'com.google.android.apps.nbu.paisa.user';
const TS = 1714000000000;

function makeNotif(body: string, pkg = MAIN_PKG, title = 'Google Pay'): RawNotification {
  return { appPackage: pkg, title, body, timestamp: TS };
}

// ── canParse ──────────────────────────────────────────────────────────────────

describe('googlepay — canParse', () => {
  it('matches main Google Pay package', () => {
    expect(canParse(makeNotif('any body', MAIN_PKG))).toBe(true);
  });

  it('matches alternate Google Pay package', () => {
    expect(canParse(makeNotif('any body', ALT_PKG))).toBe(true);
  });

  it('rejects non-Google-Pay packages', () => {
    expect(canParse(makeNotif('any body', 'com.nu.production'))).toBe(false);
    expect(canParse(makeNotif('any body', 'com.samsung.android.spay'))).toBe(false);
  });
});

// ── parse ─────────────────────────────────────────────────────────────────────

describe('googlepay — parse', () => {
  it('standard NFC payment → DEBIT with negative amount', () => {
    const tx = parse(makeNotif('Você pagou R$ 89,90 em Supermercado Extra'));
    expect(tx.type).toBe('DEBIT');
    expect(tx.amount).toBeCloseTo(-89.9);
    expect(tx.currency).toBe('BRL');
    expect(tx.confidence).toBeCloseTo(0.8);
  });

  it('source is wallet and walletId is googlepay', () => {
    const tx = parse(makeNotif('Pagamento de R$ 50,00 realizado'));
    expect(tx.source).toBe('wallet');
    expect(tx.walletId).toBe('googlepay');
    expect(tx.bank).toBe('unknown');
    expect(tx.selfTransferId).toBe('');
  });

  it('amount in title is also extracted', () => {
    const tx = parse(makeNotif('Compra aprovada em Farmácia Raia', MAIN_PKG, 'R$ 32,50 pago com Google Pay'));
    expect(tx.type).toBe('DEBIT');
    expect(tx.amount).toBeCloseTo(-32.5);
  });

  it('body without any R$ amount → UNKNOWN with confidence 0', () => {
    const tx = parse(makeNotif('Verifique seu pagamento'));
    expect(tx.type).toBe('UNKNOWN');
    expect(tx.amount).toBe(0);
    expect(tx.confidence).toBe(0);
    expect(tx.source).toBe('wallet');
    expect(tx.walletId).toBe('googlepay');
  });

  it('generates unique ids on repeated calls', () => {
    const a = parse(makeNotif('Você pagou R$ 50,00 em Loja X'));
    const b = parse(makeNotif('Você pagou R$ 50,00 em Loja X'));
    expect(a.id).not.toBe(b.id);
  });
});
