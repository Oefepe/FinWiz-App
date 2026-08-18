import { extractBRL } from './locale';
import { generateTxId } from './utils';
import type { RawNotification, Transaction, NotificationMode } from './types';
import { checkAndRecord } from './dedup';
import type { DedupCache } from './dedup';

import * as nubank from './banks/nubank';
import * as inter from './banks/inter';
import * as itau from './banks/itau';
import * as bradesco from './banks/bradesco';
import * as c6 from './banks/c6';
import * as santander from './banks/santander';
import * as googlepay from './banks/googlepay';
import * as samsungpay from './banks/samsungpay';
import * as applewallet from './banks/applewallet';

export * from './types';
export * from './locale';
export * from './dedup';

interface BankParser {
  canParse: (n: RawNotification) => boolean;
  parse: (n: RawNotification) => Transaction;
}

const BANK_PARSERS: BankParser[] = [nubank, inter, itau, bradesco, c6, santander];
const WALLET_PARSERS: BankParser[] = [googlepay, samsungpay, applewallet];

export interface ParseOptions {
  mode?: NotificationMode;
  dedupCache?: DedupCache;
}

export function parseNotification(notification: RawNotification): Transaction;
export function parseNotification(notification: RawNotification, options: ParseOptions): Transaction | null;
export function parseNotification(notification: RawNotification, options?: ParseOptions): Transaction | null {
  const mode: NotificationMode = options?.mode ?? 'bank_only';
  const cache = options?.dedupCache;

  const parsers: BankParser[] =
    mode === 'wallet_only' ? WALLET_PARSERS :
    mode === 'bank_only'   ? BANK_PARSERS :
    [...BANK_PARSERS, ...WALLET_PARSERS];

  for (const parser of parsers) {
    if (parser.canParse(notification)) {
      const tx = parser.parse(notification);
      if (mode === 'both' && cache !== undefined && checkAndRecord(cache, tx)) {
        return null;
      }
      return tx;
    }
  }

  if (mode === 'wallet_only') return null;

  const fallback = genericFallback(notification);
  if (mode === 'both' && cache !== undefined && checkAndRecord(cache, fallback)) {
    return null;
  }
  return fallback;
}

function genericFallback(n: RawNotification): Transaction {
  const combined = `${n.title} ${n.body}`;
  const amount = extractBRL(combined) ?? 0;

  return {
    id: generateTxId(),
    timestamp: new Date(n.timestamp),
    type: 'UNKNOWN',
    amount,
    currency: 'BRL',
    description: n.body.slice(0, 100),
    bank: 'unknown',
    rawNotification: n.body,
    confidence: 0,
    selfTransferId: '',
    source: 'bank',
    walletId: null,
  };
}
