import { parseBRL } from '../locale';
import { generateTxId } from '../utils';
import type { BankId, RawNotification, Transaction, TransactionType } from '../types';

const BANK_ID: BankId = 'inter';
const PACKAGE = 'br.com.intermedium';

export function canParse(n: RawNotification): boolean {
  return n.appPackage === PACKAGE;
}

export function parse(n: RawNotification): Transaction {
  const { body, timestamp } = n;

  const amountMatch = /R\$\s?[\d.,]+/.exec(body);
  if (!amountMatch) return unknownTx(n);
  const amountToken = amountMatch[0];
  if (!amountToken) return unknownTx(n);

  let rawAmount: number;
  try {
    rawAmount = parseBRL(amountToken);
  } catch {
    return unknownTx(n);
  }

  let type: TransactionType;
  let sign = -1;

  if (/pix enviado/i.test(body)) {
    type = 'PIX_OUT';
  } else if (/pix recebido/i.test(body)) {
    type = 'PIX_IN';
    sign = 1;
  } else if (/transferência enviada|transferência realizada/i.test(body)) {
    type = 'TRANSFER_OUT';
  } else if (/transferência recebida/i.test(body)) {
    type = 'TRANSFER_IN';
    sign = 1;
  } else if (/saque/i.test(body)) {
    type = 'WITHDRAWAL';
  } else if (/compra aprovada|compra no débito|débito/i.test(body)) {
    type = 'DEBIT';
  } else if (/crédito|recebido|recebeu/i.test(body)) {
    type = 'CREDIT';
    sign = 1;
  } else {
    return unknownTx(n);
  }

  return {
    id: generateTxId(),
    timestamp: new Date(timestamp),
    type,
    amount: rawAmount * sign,
    currency: 'BRL',
    description: body.replace(amountToken, '').replace(/\s+/g, ' ').trim().slice(0, 100),
    bank: BANK_ID,
    rawNotification: body,
    confidence: 0.9,
    selfTransferId: '',
    source: 'bank',
    walletId: null,
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
    bank: BANK_ID,
    rawNotification: n.body,
    confidence: 0,
    selfTransferId: '',
    source: 'bank',
    walletId: null,
  };
}
