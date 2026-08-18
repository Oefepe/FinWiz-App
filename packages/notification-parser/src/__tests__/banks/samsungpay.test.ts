import { canParse, parse } from '../../banks/samsungpay';
import type { RawNotification } from '../../types';

const PACKAGE = 'com.samsung.android.spay';
const TS = 1714000000000;

function makeNotif(body: string, pkg = PACKAGE, title = 'Samsung Pay'): RawNotification {
  return { appPackage: pkg, title, body, timestamp: TS };
}

// ── canParse ──────────────────────────────────────────────────────────────────

describe('samsungpay — canParse', () => {
  it('matches Samsung Pay package', () => {
    expect(canParse(makeNotif('any'))).toBe(true);
  });

  it('rejects other packages', () => {
    expect(canParse(makeNotif('any', 'com.nu.production'))).toBe(false);
    expect(canParse(makeNotif('any', 'com.google.android.apps.walletnfcrel'))).toBe(false);
  });
});

// ── parse ─────────────────────────────────────────────────────────────────────

describe('samsungpay — parse', () => {
  it('standard payment → DEBIT with negative amount', () => {
    const tx = parse(makeNotif('Pagamento aprovado - R$ 120,00 em Restaurante'));
    expect(tx.type).toBe('DEBIT');
    expect(tx.amount).toBeCloseTo(-120);
    expect(tx.confidence).toBeCloseTo(0.8);
  });

  it('source is wallet and walletId is samsungpay', () => {
    const tx = parse(makeNotif('Você pagou R$ 50,00 na Farmácia'));
    expect(tx.source).toBe('wallet');
    expect(tx.walletId).toBe('samsungpay');
    expect(tx.bank).toBe('unknown');
  });

  it('amount in title is also extracted', () => {
    const tx = parse(makeNotif('Compra realizada em Posto Shell', PACKAGE, 'R$ 200,00 aprovado'));
    expect(tx.amount).toBeCloseTo(-200);
  });

  it('body without amount → UNKNOWN', () => {
    const tx = parse(makeNotif('Pagamento pendente'));
    expect(tx.type).toBe('UNKNOWN');
    expect(tx.amount).toBe(0);
    expect(tx.walletId).toBe('samsungpay');
  });

  it('generates unique ids', () => {
    const a = parse(makeNotif('Pagamento R$ 30,00'));
    const b = parse(makeNotif('Pagamento R$ 30,00'));
    expect(a.id).not.toBe(b.id);
  });
});
