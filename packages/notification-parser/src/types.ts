export type BankId =
  | 'nubank'
  | 'inter'
  | 'itau'
  | 'bradesco'
  | 'c6'
  | 'santander'
  | 'unknown';

export type WalletId = 'googlepay' | 'samsungpay' | 'applewallet';

export type NotificationSource = 'bank' | 'wallet';

export type NotificationMode = 'bank_only' | 'wallet_only' | 'both';

export type TransactionType =
  | 'CREDIT'
  | 'DEBIT'
  | 'PIX_IN'
  | 'PIX_OUT'
  | 'WITHDRAWAL'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'SELF_TRANSFER_OUT'
  | 'SELF_TRANSFER_IN'
  | 'UNKNOWN';

export interface RawNotification {
  appPackage: string;
  title: string;
  body: string;
  timestamp: number; // Unix ms
}

export interface Transaction {
  id: string;
  timestamp: Date;
  type: TransactionType;
  amount: number;            // negative for outgoing, positive for incoming
  currency: 'BRL';
  description: string;
  bank: BankId;
  rawNotification: string;
  confidence: number;        // 0–1
  selfTransferId: string;    // always "" at parse time
  source: NotificationSource;
  walletId: WalletId | null; // null for bank transactions
}
