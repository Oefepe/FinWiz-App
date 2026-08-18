import type { TransactionTableRow } from '@finwiz/obsidian-client';

// The vault schema (TransactionTableRow) has no id or installments column —
// those are SQLite-only. Everything reading from the local DB (as opposed to
// writing to the vault) should use this shape instead.
export interface TransactionRecord extends TransactionTableRow {
  id: string;
  installments: number;
}

export const OUTGOING_TYPES = new Set([
  'PIX_OUT', 'TRANSFER_OUT', 'SELF_TRANSFER_OUT',
  'DEBIT', 'CARD_PURCHASE', 'ATM_WITHDRAWAL', 'BILL_PAYMENT',
]);

export const SELF_TRANSFER_ELIGIBLE = new Set([
  'PIX_OUT', 'PIX_IN', 'TRANSFER_OUT', 'TRANSFER_IN',
]);

export const TRANSACTION_TYPES = [
  'PIX_OUT', 'PIX_IN', 'TRANSFER_OUT', 'TRANSFER_IN',
  'DEBIT', 'CREDIT', 'CARD_PURCHASE', 'ATM_WITHDRAWAL', 'BILL_PAYMENT',
] as const;

export const BANK_IDS = [
  'nubank', 'inter', 'itau', 'bradesco', 'c6', 'santander',
] as const;

export type KnownTransactionType = (typeof TRANSACTION_TYPES)[number];
export type BankId = (typeof BANK_IDS)[number];

export function isOutgoing(type: string): boolean {
  return OUTGOING_TYPES.has(type);
}

export function isSelfTransferEligible(type: string): boolean {
  return SELF_TRANSFER_ELIGIBLE.has(type);
}

export function isSelfTransfer(type: string): boolean {
  return type === 'SELF_TRANSFER_OUT' || type === 'SELF_TRANSFER_IN';
}

export function formatAmount(amount: number): string {
  const abs = Math.abs(amount).toFixed(2);
  return amount < 0 ? `-R$${abs}` : `+R$${abs}`;
}

export function amountColorClass(amount: number): string {
  return amount < 0 ? 'text-red-600' : 'text-emerald-600';
}

export function badgeColorClass(type: string): string {
  if (isSelfTransfer(type)) return 'bg-gray-100 text-gray-500';
  if (isOutgoing(type)) return 'bg-red-100 text-red-700';
  return 'bg-emerald-100 text-emerald-700';
}

/** Returns the SELF_TRANSFER_* counterpart of an eligible type. */
export function toSelfTransferType(type: string): string {
  return isOutgoing(type) ? 'SELF_TRANSFER_OUT' : 'SELF_TRANSFER_IN';
}

/** Reverts a SELF_TRANSFER_* type back to the most likely original type. */
export function fromSelfTransferType(original: string): string {
  if (original === 'SELF_TRANSFER_OUT') return 'PIX_OUT';
  if (original === 'SELF_TRANSFER_IN') return 'PIX_IN';
  return original;
}

export function formatRelativeDate(date: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (date === today) return 'Today';
  if (date === yesterday) return 'Yesterday';
  const parts = date.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m = parseInt(parts[1] ?? '1', 10);
  const d = parts[2] ?? '';
  const y = parts[0] ?? '';
  return `${months[m - 1] ?? ''} ${d}, ${y}`;
}

export function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function groupByDate<T extends TransactionTableRow>(
  txs: T[],
): Array<{ title: string; data: T[] }> {
  const map = new Map<string, T[]>();
  for (const tx of txs) {
    const bucket = map.get(tx.date);
    if (bucket) {
      bucket.push(tx);
    } else {
      map.set(tx.date, [tx]);
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, data]) => ({ title: formatRelativeDate(date), data }));
}
