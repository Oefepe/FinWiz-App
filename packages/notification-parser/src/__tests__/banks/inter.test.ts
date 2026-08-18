import { canParse, parse } from '../../banks/inter';
import type { RawNotification } from '../../types';

function makeNotif(body: string, title = 'Banco Inter'): RawNotification {
  return { appPackage: 'br.com.intermedium', title, body, timestamp: 1714000000000 };
}

describe('inter — canParse', () => {
  it('matches br.com.intermedium', () => {
    expect(canParse(makeNotif('any'))).toBe(true);
  });
  it('does not match other packages', () => {
    expect(canParse({ appPackage: 'com.nu.production', title: '', body: '', timestamp: 0 })).toBe(false);
  });
});

describe('inter — parse', () => {
  it('PIX out with recipient name', () => {
    const tx = parse(makeNotif('Pix enviado: R$ 450,00 para Pedro Alves'));
    expect(tx.type).toBe('PIX_OUT');
    expect(tx.amount).toBeCloseTo(-450);
    expect(tx.bank).toBe('inter');
    expect(tx.selfTransferId).toBe('');
  });

  it('PIX in', () => {
    const tx = parse(makeNotif('Pix recebido: R$ 750,00 de Ana Lima'));
    expect(tx.type).toBe('PIX_IN');
    expect(tx.amount).toBeCloseTo(750);
  });

  it('debit purchase', () => {
    const tx = parse(makeNotif('Compra aprovada: R$ 67,50'));
    expect(tx.type).toBe('DEBIT');
    expect(tx.amount).toBeCloseTo(-67.5);
  });

  it('transfer out', () => {
    const tx = parse(makeNotif('Transferência enviada: R$ 1.500,00'));
    expect(tx.type).toBe('TRANSFER_OUT');
    expect(tx.amount).toBeCloseTo(-1500);
  });

  it('transfer in', () => {
    const tx = parse(makeNotif('Transferência recebida: R$ 2.000,00'));
    expect(tx.type).toBe('TRANSFER_IN');
    expect(tx.amount).toBeCloseTo(2000);
  });

  it('returns UNKNOWN for unrecognised format', () => {
    const tx = parse(makeNotif('Mensagem do Inter sem valor'));
    expect(tx.type).toBe('UNKNOWN');
    expect(tx.amount).toBe(0);
    expect(tx.confidence).toBe(0);
  });

  it('debit with pt-BR thousands separator', () => {
    const tx = parse(makeNotif('Compra aprovada: R$ 3.500,00'));
    expect(tx.type).toBe('DEBIT');
    expect(tx.amount).toBeCloseTo(-3500);
  });
});
