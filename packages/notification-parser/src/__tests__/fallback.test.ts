import { parseNotification } from '../index';
import type { RawNotification } from '../types';

function makeNotif(pkg: string, body: string, title = 'Unknown App'): RawNotification {
  return { appPackage: pkg, title, body, timestamp: 1714000000000 };
}

describe('parseNotification — generic fallback', () => {
  it('extracts R$ amount from an unknown app notification', () => {
    const tx = parseNotification(makeNotif('com.unknown.bank', 'Compra aprovada R$ 99,00'));
    expect(tx.type).toBe('UNKNOWN');
    expect(tx.amount).toBeCloseTo(99);
    expect(tx.bank).toBe('unknown');
    expect(tx.confidence).toBe(0);
    expect(tx.selfTransferId).toBe('');
  });

  it('returns amount 0 when no R$ in body or title', () => {
    const tx = parseNotification(makeNotif('com.random.app', 'No financial data here'));
    expect(tx.type).toBe('UNKNOWN');
    expect(tx.amount).toBe(0);
  });

  it('routes Nubank correctly and does not fall through to generic', () => {
    const tx = parseNotification(makeNotif('com.nu.production', 'Pix enviado: R$ 200,00'));
    expect(tx.bank).toBe('nubank');
    expect(tx.type).toBe('PIX_OUT');
  });

  it('routes Inter correctly', () => {
    const tx = parseNotification(makeNotif('br.com.intermedium', 'Pix recebido: R$ 100,00'));
    expect(tx.bank).toBe('inter');
    expect(tx.type).toBe('PIX_IN');
  });

  it('generates a unique id per transaction', () => {
    const a = parseNotification(makeNotif('com.x', 'R$ 10,00'));
    const b = parseNotification(makeNotif('com.x', 'R$ 10,00'));
    expect(a.id).not.toBe(b.id);
  });
});
