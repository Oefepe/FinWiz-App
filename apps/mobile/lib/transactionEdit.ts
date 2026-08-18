import { OUTGOING_TYPES, type TransactionRecord } from './transactionUtils';
import type { TransactionUpdate } from './database';

// Figma's Edit frame exposes exactly four fields: Transaction Source
// (free-text — the merchant/description, matching what ManualEntryModal
// calls "Description"), Transaction Value, Transaction Type, and Stallments
// (installment count). Bank and date/time are not user-editable here; they
// carry over unchanged from the original record.
export interface EditForm {
  description: string;
  amount: string;
  type: string;
  installments: string;
}

export interface EditValidationError {
  field: keyof EditForm;
  message: string;
}

export function transactionToEditForm(tx: TransactionRecord): EditForm {
  return {
    description: tx.description,
    amount: Math.abs(tx.amount).toFixed(2),
    type: tx.type,
    installments: String(tx.installments > 0 ? tx.installments : 1),
  };
}

export function validateEditForm(form: EditForm): EditValidationError[] {
  const errors: EditValidationError[] = [];

  if (!form.description.trim()) {
    errors.push({ field: 'description', message: 'Transaction source is required' });
  }

  const parsedAmount = parseFloat(form.amount.replace(',', '.'));
  if (!form.amount.trim()) {
    errors.push({ field: 'amount', message: 'Value is required' });
  } else if (isNaN(parsedAmount) || parsedAmount <= 0) {
    errors.push({ field: 'amount', message: 'Value must be a positive number' });
  }

  if (!form.type) {
    errors.push({ field: 'type', message: 'Transaction type is required' });
  }

  const parsedInstallments = parseInt(form.installments, 10);
  if (!form.installments.trim() || isNaN(parsedInstallments) || parsedInstallments < 1) {
    errors.push({ field: 'installments', message: 'Installments must be a whole number, 1 or more' });
  }

  return errors;
}

/** Converts a validated form back into a full-row update, carrying forward
 * the fields this screen doesn't expose (date/time/bank/category). */
export function formToUpdate(form: EditForm, original: TransactionRecord): TransactionUpdate {
  const parsedAmount = parseFloat(form.amount.replace(',', '.'));
  const signed = OUTGOING_TYPES.has(form.type) ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);

  return {
    date: original.date,
    time: original.time,
    type: form.type,
    amount: signed,
    description: form.description.trim(),
    source_bank: original.source_bank,
    category: original.category,
    installments: parseInt(form.installments, 10),
  };
}
