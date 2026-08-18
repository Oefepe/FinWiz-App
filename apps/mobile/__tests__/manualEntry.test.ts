import {
  validateManualEntry,
  formToTransaction,
  emptyForm,
  type ManualEntryForm,
} from '../lib/manualEntry';

function makeForm(overrides: Partial<ManualEntryForm> = {}): ManualEntryForm {
  return { ...emptyForm(), description: 'Test transaction', ...overrides };
}

// ── Required field validation ───────────────────────────────────────────────

describe('validateManualEntry — required fields', () => {
  it('returns no errors for a fully valid form', () => {
    const form = makeForm({ amount: '150.00', description: 'Supermercado' });
    expect(validateManualEntry(form)).toHaveLength(0);
  });

  it('requires amount', () => {
    const errors = validateManualEntry(makeForm({ amount: '' }));
    expect(errors.some((e) => e.field === 'amount')).toBe(true);
  });

  it('requires description', () => {
    const errors = validateManualEntry(makeForm({ description: '' }));
    expect(errors.some((e) => e.field === 'description')).toBe(true);
  });

  it('requires type', () => {
    const errors = validateManualEntry(makeForm({ type: '' }));
    expect(errors.some((e) => e.field === 'type')).toBe(true);
  });

  it('requires sourceBank', () => {
    const errors = validateManualEntry(makeForm({ sourceBank: '' }));
    expect(errors.some((e) => e.field === 'sourceBank')).toBe(true);
  });
});

// ── Amount format validation ────────────────────────────────────────────────

describe('validateManualEntry — amount format', () => {
  it('accepts integer amount', () => {
    expect(validateManualEntry(makeForm({ amount: '100' }))).toHaveLength(0);
  });

  it('accepts decimal with dot', () => {
    expect(validateManualEntry(makeForm({ amount: '99.99' }))).toHaveLength(0);
  });

  it('accepts decimal with comma (BRL convention)', () => {
    expect(validateManualEntry(makeForm({ amount: '99,99' }))).toHaveLength(0);
  });

  it('rejects zero', () => {
    const errors = validateManualEntry(makeForm({ amount: '0' }));
    expect(errors.some((e) => e.field === 'amount')).toBe(true);
  });

  it('rejects negative input', () => {
    const errors = validateManualEntry(makeForm({ amount: '-50' }));
    expect(errors.some((e) => e.field === 'amount')).toBe(true);
  });

  it('rejects non-numeric input', () => {
    const errors = validateManualEntry(makeForm({ amount: 'abc' }));
    expect(errors.some((e) => e.field === 'amount')).toBe(true);
  });
});

// ── Amount sign assignment by type ─────────────────────────────────────────

describe('formToTransaction — sign assignment by type', () => {
  it('assigns negative amount to outgoing types (PIX_OUT)', () => {
    const tx = formToTransaction(makeForm({ amount: '150', type: 'PIX_OUT' }));
    expect(tx.amount).toBe(-150);
  });

  it('assigns negative amount to TRANSFER_OUT', () => {
    const tx = formToTransaction(makeForm({ amount: '200', type: 'TRANSFER_OUT' }));
    expect(tx.amount).toBe(-200);
  });

  it('assigns negative amount to DEBIT', () => {
    const tx = formToTransaction(makeForm({ amount: '50', type: 'DEBIT' }));
    expect(tx.amount).toBe(-50);
  });

  it('assigns positive amount to incoming types (PIX_IN)', () => {
    const tx = formToTransaction(makeForm({ amount: '300', type: 'PIX_IN' }));
    expect(tx.amount).toBe(300);
  });

  it('assigns positive amount to CREDIT', () => {
    const tx = formToTransaction(makeForm({ amount: '100', type: 'CREDIT' }));
    expect(tx.amount).toBe(100);
  });

  it('converts comma-decimal correctly before sign assignment', () => {
    const tx = formToTransaction(makeForm({ amount: '49,90', type: 'PIX_OUT' }));
    expect(tx.amount).toBeCloseTo(-49.9);
  });

  it('trims description whitespace', () => {
    const tx = formToTransaction(makeForm({ description: '  Padaria  ', type: 'PIX_OUT' }));
    expect(tx.description).toBe('Padaria');
  });

  it('initialises self_transfer_id as empty string', () => {
    const tx = formToTransaction(makeForm({ amount: '10', type: 'PIX_OUT' }));
    expect(tx.self_transfer_id).toBe('');
  });
});
