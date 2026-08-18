import { canParse, parse } from '../../banks/c6';
import type { RawNotification } from '../../types';

function makeNotif(body: string, title = 'C6 Bank'): RawNotification {
  return { appPackage: 'com.c6bank.app', title, body, timestamp: 1714000000000 };
}

describe('c6 — canParse', () => {
  it('matches com.c6bank.app', () => {
    expect(canParse(makeNotif('any'))).toBe(true);
  });
  it('does not match other packages', () => {
    expect(canParse({ appPackage: 'com.bradesco', title: '', body: '', timestamp: 0 })).toBe(false);
  });
});

describe('c6 — parse', () => {
  it('debit card payment', () => {
    const tx = parse(makeNotif('Você pagou R$ 99,90 com seu cartão'));
    expect(tx.type).toBe('DEBIT');
    expect(tx.amount).toBeCloseTo(-99.9);
    expect(tx.bank).toBe('c6');
    expect(tx.selfTransferId).toBe('');
  });

  it('PIX in', () => {
    const tx = parse(makeNotif('Você recebeu R$ 500,00 via Pix'));
    expect(tx.type).toBe('PIX_IN');
    expect(tx.amount).toBeCloseTo(500);
  });

  it('PIX out', () => {
    const tx = parse(makeNotif('Pix enviado: R$ 150,00'));
    expect(tx.type).toBe('PIX_OUT');
    expect(tx.amount).toBeCloseTo(-150);
  });

  it('large debit with thousands separator', () => {
    const tx = parse(makeNotif('Você pagou R$ 2.340,00 com seu cartão'));
    expect(tx.type).toBe('DEBIT');
    expect(tx.amount).toBeCloseTo(-2340);
  });

  it('transfer out', () => {
    const tx = parse(makeNotif('Transferência enviada: R$ 600,00'));
    expect(tx.type).toBe('TRANSFER_OUT');
    expect(tx.amount).toBeCloseTo(-600);
  });

  it('returns UNKNOWN for unrecognised format', () => {
    const tx = parse(makeNotif('C6: mensagem sem transação'));
    expect(tx.type).toBe('UNKNOWN');
    expect(tx.amount).toBe(0);
    expect(tx.confidence).toBe(0);
  });
});
