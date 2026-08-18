import { canParse, parse } from '../../banks/itau';
import type { RawNotification } from '../../types';

function makeNotif(body: string, title = 'Itaú'): RawNotification {
  return { appPackage: 'com.itau', title, body, timestamp: 1714000000000 };
}

describe('itau — canParse', () => {
  it('matches com.itau', () => {
    expect(canParse(makeNotif('any'))).toBe(true);
  });
  it('does not match other packages', () => {
    expect(canParse({ appPackage: 'com.nu.production', title: '', body: '', timestamp: 0 })).toBe(false);
  });
});

describe('itau — parse', () => {
  it('debit with Itaú unusual format (no $ sign)', () => {
    const tx = parse(makeNotif('Débito de R150,00em 15/04'));
    expect(tx.type).toBe('DEBIT');
    expect(tx.amount).toBeCloseTo(-150);
    expect(tx.bank).toBe('itau');
    expect(tx.selfTransferId).toBe('');
  });

  it('PIX out with Itaú format', () => {
    const tx = parse(makeNotif('Pix de R500,00 enviado'));
    expect(tx.type).toBe('PIX_OUT');
    expect(tx.amount).toBeCloseTo(-500);
  });

  it('PIX in with Itaú format', () => {
    const tx = parse(makeNotif('Pix de R300,00 recebido'));
    expect(tx.type).toBe('PIX_IN');
    expect(tx.amount).toBeCloseTo(300);
  });

  it('debit with large amount and thousands separator', () => {
    const tx = parse(makeNotif('Débito de R1.500,00em 20/04'));
    expect(tx.type).toBe('DEBIT');
    expect(tx.amount).toBeCloseTo(-1500);
  });

  it('withdrawal', () => {
    const tx = parse(makeNotif('Saque de R200,00 em 10/04'));
    expect(tx.type).toBe('WITHDRAWAL');
    expect(tx.amount).toBeCloseTo(-200);
  });

  it('returns UNKNOWN for unrecognised format', () => {
    const tx = parse(makeNotif('Itaú: sem transação'));
    expect(tx.type).toBe('UNKNOWN');
    expect(tx.amount).toBe(0);
    expect(tx.confidence).toBe(0);
  });
});
