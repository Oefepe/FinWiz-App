import { OUTGOING_TYPES, TRANSACTION_TYPES, BANK_IDS } from './transactionUtils';

export interface ManualEntryForm {
  amount: string;
  type: string;
  description: string;
  sourceBank: string;
  date: string;
  time: string;
}

export interface ValidationError {
  field: keyof ManualEntryForm;
  message: string;
}

export function emptyForm(): ManualEntryForm {
  const now = new Date();
  return {
    amount: '',
    type: TRANSACTION_TYPES[0],
    description: '',
    sourceBank: BANK_IDS[0],
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
  };
}

export function validateManualEntry(form: ManualEntryForm): ValidationError[] {
  const errors: ValidationError[] = [];

  const parsed = parseFloat(form.amount.replace(',', '.'));
  if (!form.amount.trim()) {
    errors.push({ field: 'amount', message: 'Amount is required' });
  } else if (isNaN(parsed) || parsed <= 0) {
    errors.push({ field: 'amount', message: 'Amount must be a positive number' });
  }

  if (!form.type) {
    errors.push({ field: 'type', message: 'Transaction type is required' });
  }

  if (!form.description.trim()) {
    errors.push({ field: 'description', message: 'Description is required' });
  }

  if (!form.sourceBank) {
    errors.push({ field: 'sourceBank', message: 'Bank is required' });
  }

  return errors;
}

export interface SaveableTransaction {
  id: string;
  date: string;
  time: string;
  type: string;
  amount: number;
  description: string;
  source_bank: string;
  category: string;
  self_transfer_id: string;
}

/** Converts a validated form into a transaction ready for database insertion. */
export function formToTransaction(form: ManualEntryForm): SaveableTransaction {
  const parsed = parseFloat(form.amount.replace(',', '.'));
  const signed = OUTGOING_TYPES.has(form.type) ? -Math.abs(parsed) : Math.abs(parsed);

  return {
    id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date: form.date,
    time: form.time,
    type: form.type,
    amount: signed,
    description: form.description.trim(),
    source_bank: form.sourceBank,
    category: '',
    self_transfer_id: '',
  };
}
