import { extractBRL } from '../locale';
import { generateTxId } from '../utils';
import type { RawNotification, Transaction } from '../types';

const WALLET_ID = 'samsungpay' as const;
const PACKAGE = 'com.samsung.android.spay';

export function canParse(n: RawNotification): boolean {
  return n.appPackage === PACKAGE;
}

export function parse(n: RawNotification): Transaction {
  const { body, title, timestamp } = n;

  const amount = extractBRL(`${title} ${body}`);
  if (amount === null) return unknownTx(n);

  return {
    id: generateTxId(),
    timestamp: new Date(timestamp),
    type: 'DEBIT',
    amount: -amount,
    currency: 'BRL',
    description: body.slice(0, 100),
    bank: 'unknown',
    rawNotification: body,
    confidence: 0.8,
    selfTransferId: '',
    source: 'wallet',
    walletId: WALLET_ID,
  };
}

function unknownTx(n: RawNotification): Transaction {
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
