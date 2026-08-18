import { canParse, parse } from '../../banks/nubank';
import type { RawNotification } from '../../types';

function makeNotif(body: string, title = 'Nubank'): RawNotification {
  return { appPackage: 'com.nu.production', title, body, timestamp: 1714000000000 };
}

describe('nubank — canParse', () => {
  it('matches com.nu.production', () => {
    expect(canParse(makeNotif('any'))).toBe(true);
  });
  it('does not match other packages', () => {
    expect(canParse({ appPackage: 'com.bradesco', title: '', body: '', timestamp: 0 })).toBe(false);
  });
});

describe('nubank — parse', () => {
  it('debit purchase', () => {
    const tx = parse(makeNotif('Compra no débito de R$ 89,90 em Supermercado Extra'));
    expect(tx.type).toBe('DEBIT');
    expect(tx.amount).toBeCloseTo(-89.9);
    expect(tx.bank).toBe('nubank');
    expect(tx.currency).toBe('BRL');
    expect(tx.selfTransferId).toBe('');
    expect(tx.confidence).toBeGreaterThan(0);
  });

  it('PIX out', () => {
    const tx = parse(makeNotif('Pix enviado: R$ 500,00'));
    expect(tx.type).toBe('PIX_OUT');
    expect(tx.amount).toBeCloseTo(-500);
  });

  it('PIX in via Pix', () => {
    const tx = parse(makeNotif('Você recebeu R$ 300,00 via Pix de João Silva'));
    expect(tx.type).toBe('PIX_IN');
    expect(tx.amount).toBeCloseTo(300);
  });

  it('withdrawal', () => {
    const tx = parse(makeNotif('Saque de R$ 200,00 realizado'));
    expect(tx.type).toBe('WITHDRAWAL');
    expect(tx.amount).toBeCloseTo(-200);
  });

  it('PIX out with large amount and merchant name', () => {
    const tx = parse(makeNotif('Pix enviado: R$ 1.200,00 para Maria Souza'));
    expect(tx.type).toBe('PIX_OUT');
    expect(tx.amount).toBeCloseTo(-1200);
  });

  it('returns UNKNOWN for unrecognised format', () => {
    const tx = parse(makeNotif('Notificação sem valor'));
    expect(tx.type).toBe('UNKNOWN');
    expect(tx.amount).toBe(0);
    expect(tx.confidence).toBe(0);
  });

  it('selfTransferId is always empty string at parse time', () => {
    const tx = parse(makeNotif('Pix enviado: R$ 50,00'));
    expect(tx.selfTransferId).toBe('');
  });

  it('transfer out', () => {
    const tx = parse(makeNotif('Transferência de R$ 1.000,00 realizada'));
    expect(tx.type).toBe('TRANSFER_OUT');
    expect(tx.amount).toBeCloseTo(-1000);
  });

  it('transfer in', () => {
    const tx = parse(makeNotif('Você recebeu uma transferência de R$ 750,00'));
    expect(tx.type).toBe('TRANSFER_IN');
    expect(tx.amount).toBeCloseTo(750);
  });
});
