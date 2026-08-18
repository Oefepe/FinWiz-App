import { canParse, parse } from '../../banks/santander';
import type { RawNotification } from '../../types';

function makeNotif(body: string, title = 'Santander'): RawNotification {
  return { appPackage: 'br.com.santander.benvisavale', title, body, timestamp: 1714000000000 };
}

describe('santander — canParse', () => {
  it('matches br.com.santander.benvisavale', () => {
    expect(canParse(makeNotif('any'))).toBe(true);
  });
  it('does not match other packages', () => {
    expect(canParse({ appPackage: 'com.nu.production', title: '', body: '', timestamp: 0 })).toBe(false);
  });
});

describe('santander — parse', () => {
  it('debit — transação aprovada', () => {
    const tx = parse(makeNotif('Transação aprovada R$ 175,50 em LOJA XYZ'));
    expect(tx.type).toBe('DEBIT');
    expect(tx.amount).toBeCloseTo(-175.5);
    expect(tx.bank).toBe('santander');
    expect(tx.selfTransferId).toBe('');
  });

  it('PIX out', () => {
    const tx = parse(makeNotif('Pix enviado R$ 300,00'));
    expect(tx.type).toBe('PIX_OUT');
    expect(tx.amount).toBeCloseTo(-300);
  });

  it('PIX in', () => {
    const tx = parse(makeNotif('Pix recebido R$ 200,00'));
    expect(tx.type).toBe('PIX_IN');
    expect(tx.amount).toBeCloseTo(200);
  });

  it('debit with large amount and thousands separator', () => {
    const tx = parse(makeNotif('Transação aprovada R$ 5.000,00 em CONCESSIONÁRIA'));
    expect(tx.type).toBe('DEBIT');
    expect(tx.amount).toBeCloseTo(-5000);
  });

  it('transfer out', () => {
    const tx = parse(makeNotif('TED debitado R$ 1.200,00'));
    expect(tx.type).toBe('TRANSFER_OUT');
    expect(tx.amount).toBeCloseTo(-1200);
  });

  it('returns UNKNOWN for unrecognised format', () => {
    const tx = parse(makeNotif('Santander: sem transação'));
    expect(tx.type).toBe('UNKNOWN');
    expect(tx.amount).toBe(0);
    expect(tx.confidence).toBe(0);
  });
});
