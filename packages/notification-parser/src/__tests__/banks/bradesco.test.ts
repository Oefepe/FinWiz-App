import { canParse, parse } from '../../banks/bradesco';
import type { RawNotification } from '../../types';

function makeNotif(body: string, title = 'Bradesco'): RawNotification {
  return { appPackage: 'com.bradesco', title, body, timestamp: 1714000000000 };
}

describe('bradesco — canParse', () => {
  it('matches com.bradesco', () => {
    expect(canParse(makeNotif('any'))).toBe(true);
  });
  it('does not match other packages', () => {
    expect(canParse({ appPackage: 'com.itau', title: '', body: '', timestamp: 0 })).toBe(false);
  });
});

describe('bradesco — parse', () => {
  it('debit purchase via Transação keyword', () => {
    const tx = parse(makeNotif('Transação: R$ 250,00 - Compra no débito'));
    expect(tx.type).toBe('DEBIT');
    expect(tx.amount).toBeCloseTo(-250);
    expect(tx.bank).toBe('bradesco');
    expect(tx.selfTransferId).toBe('');
  });

  it('PIX out', () => {
    const tx = parse(makeNotif('Transação: R$ 100,00 - Pix enviado'));
    expect(tx.type).toBe('PIX_OUT');
    expect(tx.amount).toBeCloseTo(-100);
  });

  it('PIX in', () => {
    const tx = parse(makeNotif('Transação: R$ 400,00 - Pix recebido'));
    expect(tx.type).toBe('PIX_IN');
    expect(tx.amount).toBeCloseTo(400);
  });

  it('generic Transação defaults to DEBIT when type keywords absent', () => {
    const tx = parse(makeNotif('Transação: R$ 50,00 - Operação realizada'));
    expect(tx.type).toBe('DEBIT');
    expect(tx.amount).toBeCloseTo(-50);
  });

  it('transfer out', () => {
    const tx = parse(makeNotif('Transação: R$ 800,00 - Transferência enviada'));
    expect(tx.type).toBe('TRANSFER_OUT');
    expect(tx.amount).toBeCloseTo(-800);
  });

  it('returns UNKNOWN when no amount found', () => {
    const tx = parse(makeNotif('Bradesco: mensagem de teste'));
    expect(tx.type).toBe('UNKNOWN');
    expect(tx.amount).toBe(0);
    expect(tx.confidence).toBe(0);
  });
});
