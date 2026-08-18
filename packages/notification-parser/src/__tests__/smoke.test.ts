import { parseBRL, extractBRL } from '../locale';

describe('locale — parseBRL', () => {
  it('parses standard pt-BR format', () => {
    expect(parseBRL('R$ 1.234,56')).toBe(1234.56);
  });

  it('parses without thousands separator', () => {
    expect(parseBRL('R$ 50,00')).toBe(50.0);
  });

  it('parses without space after R$', () => {
    expect(parseBRL('R$150,00')).toBe(150.0);
  });

  it('parses Itaú-style without $ sign', () => {
    expect(parseBRL('R150,00')).toBe(150.0);
  });

  it('parses large amount with thousands separator', () => {
    expect(parseBRL('R$ 12.345,67')).toBe(12345.67);
  });

  it('throws on non-numeric input', () => {
    expect(() => parseBRL('R$ abc')).toThrow();
  });

  it('throws on empty string', () => {
    expect(() => parseBRL('')).toThrow();
  });
});

describe('locale — extractBRL', () => {
  it('extracts amount from a full notification body', () => {
    expect(extractBRL('Você pagou R$ 99,90 com seu cartão')).toBe(99.9);
  });

  it('extracts Itaú-style amount without $', () => {
    expect(extractBRL('Débito de R150,00em 15/04')).toBe(150.0);
  });

  it('returns null when no amount found', () => {
    expect(extractBRL('Mensagem sem valor financeiro')).toBeNull();
  });

  it('extracts first amount when multiple are present', () => {
    expect(extractBRL('Pague R$ 10,00 ou R$ 20,00')).toBe(10.0);
  });
});
