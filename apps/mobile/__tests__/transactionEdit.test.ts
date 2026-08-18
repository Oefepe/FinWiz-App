import {
  transactionToEditForm,
  validateEditForm,
  formToUpdate,
  type EditForm,
} from '../lib/transactionEdit';
import type { TransactionRecord } from '../lib/transactionUtils';

const BASE_TX: TransactionRecord = {
  id: 'tx-001',
  date: '2026-08-01',
  time: '12:00:00',
  type: 'PIX_OUT',
  amount: -120.5,
  description: 'Mercado',
  source_bank: 'nubank',
  category: '',
  self_transfer_id: '',
  installments: 1,
};

function baseForm(): EditForm {
  return {
    description: 'Mercado',
    amount: '120.50',
    type: 'PIX_OUT',
    installments: '1',
  };
}

describe('transactionToEditForm', () => {
  it('prefills from a transaction record, using the absolute amount', () => {
    expect(transactionToEditForm(BASE_TX)).toEqual({
      description: 'Mercado',
      amount: '120.50',
      type: 'PIX_OUT',
      installments: '1',
    });
  });

  it('prefills an incoming (positive-amount) transaction the same way', () => {
    const incoming: TransactionRecord = { ...BASE_TX, type: 'PIX_IN', amount: 300 };
    expect(transactionToEditForm(incoming).amount).toBe('300.00');
  });

  it('defaults installments to 1 if the stored value is somehow 0 or negative', () => {
    const bad: TransactionRecord = { ...BASE_TX, installments: 0 };
    expect(transactionToEditForm(bad).installments).toBe('1');
  });
});

describe('validateEditForm', () => {
  it('passes for a fully valid form', () => {
    expect(validateEditForm(baseForm())).toEqual([]);
  });

  it('requires a non-empty description', () => {
    const errors = validateEditForm({ ...baseForm(), description: '   ' });
    expect(errors.map((e) => e.field)).toContain('description');
  });

  it('rejects a missing amount', () => {
    const errors = validateEditForm({ ...baseForm(), amount: '' });
    expect(errors.map((e) => e.field)).toContain('amount');
  });

  it('rejects a zero or negative amount', () => {
    expect(validateEditForm({ ...baseForm(), amount: '0' }).map((e) => e.field)).toContain('amount');
    expect(validateEditForm({ ...baseForm(), amount: '-5' }).map((e) => e.field)).toContain('amount');
  });

  it('rejects a non-numeric amount', () => {
    const errors = validateEditForm({ ...baseForm(), amount: 'abc' });
    expect(errors.map((e) => e.field)).toContain('amount');
  });

  it('requires a transaction type', () => {
    const errors = validateEditForm({ ...baseForm(), type: '' });
    expect(errors.map((e) => e.field)).toContain('type');
  });

  it('rejects installments below 1', () => {
    expect(validateEditForm({ ...baseForm(), installments: '0' }).map((e) => e.field)).toContain(
      'installments',
    );
  });

  it('rejects a non-numeric installments value', () => {
    const errors = validateEditForm({ ...baseForm(), installments: 'many' });
    expect(errors.map((e) => e.field)).toContain('installments');
  });

  it('accepts a comma decimal amount (pt-BR input)', () => {
    const errors = validateEditForm({ ...baseForm(), amount: '120,50' });
    expect(errors).toEqual([]);
  });
});

describe('formToUpdate', () => {
  it('signs the amount negative for an outgoing type', () => {
    const update = formToUpdate({ ...baseForm(), type: 'PIX_OUT', amount: '50' }, BASE_TX);
    expect(update.amount).toBe(-50);
  });

  it('signs the amount positive when the type is changed to incoming', () => {
    const update = formToUpdate({ ...baseForm(), type: 'PIX_IN', amount: '50' }, BASE_TX);
    expect(update.amount).toBe(50);
  });

  it('carries forward date/time/bank/category unchanged from the original record', () => {
    const update = formToUpdate(baseForm(), BASE_TX);
    expect(update.date).toBe(BASE_TX.date);
    expect(update.time).toBe(BASE_TX.time);
    expect(update.source_bank).toBe(BASE_TX.source_bank);
    expect(update.category).toBe(BASE_TX.category);
  });

  it('trims the description and parses installments to a number', () => {
    const update = formToUpdate({ ...baseForm(), description: '  Uber  ', installments: '3' }, BASE_TX);
    expect(update.description).toBe('Uber');
    expect(update.installments).toBe(3);
  });

  it('parses a comma decimal amount correctly, matching lib/manualEntry.ts convention', () => {
    const update = formToUpdate({ ...baseForm(), amount: '75,25' }, BASE_TX);
    expect(update.amount).toBe(-75.25);
  });
});
