import { generateTxId } from '../utils';
import type { RawNotification, Transaction } from '../types';

const WALLET_ID = 'applewallet' as const;

// Apple Pay / Apple Wallet notifications are system-level on iOS and cannot be
// intercepted by third-party Shortcuts automations. canParse always returns false;
// this parser is a structural no-op kept for the wallet_only mode registry.
export function canParse(_n: RawNotification): boolean {
  return false;
}

export function parse(n: RawNotification): Transaction {
  return {
    id: generateTxId(),
    timestamp: new Date(n.timestamp),
    type: 'UNKNOWN',
    amount: 0,
    currency: 'BRL',
    description: n.body.slice(0, 100),
    bank: 'unknown',
    rawNotification: n.body,
    confidence: 0,
    selfTransferId: '',
    source: 'wallet',
    walletId: WALLET_ID,
  };
}
