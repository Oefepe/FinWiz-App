import { parseBRL } from '../locale';
import { generateTxId } from '../utils';
import type { BankId, RawNotification, Transaction, TransactionType } from '../types';

// Itaú notifications use an unusual format without $ and minimal spaces:
// "Débito de R150,00em 15/04" or "Pix de R500,00 enviado"

const BANK_ID: BankId = 'itau';
const PACKAGE = 'com.itau';

export function canParse(n: RawNotification): boolean {
  return n.appPackage === PACKAGE;
}

export function parse(n: RawNotification): Transaction {
  const { body, timestamp } = n;

  // Itaú uses "R" directly followed by digits (no $ or space) in many notifications
  const amountMatch = /R\$?\s?[\d.,]+/.exec(body);
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

  if (/pix.*enviado|enviado.*pix/i.test(body)) {
    type = 'PIX_OUT';
  } else if (/pix.*recebido|recebido.*pix/i.test(body)) {
    type = 'PIX_IN';
    sign = 1;
  } else if (/pix/i.test(body)) {
    // Ambiguous Itaú Pix — default to PIX_OUT with lower confidence
    type = 'PIX_OUT';
  } else if (/saque/i.test(body)) {
    type = 'WITHDRAWAL';
  } else if (/transferência.*recebid|crédito/i.test(body)) {
    type = 'TRANSFER_IN';
    sign = 1;
  } else if (/transferência/i.test(body)) {
    type = 'TRANSFER_OUT';
  } else if (/débito|compra|pagamento/i.test(body)) {
    type = 'DEBIT';
  } else {
    return unknownTx(n);
  }

  const confidence = /pix/i.test(body) && !/enviado|recebido/i.test(body) ? 0.7 : 0.9;

  return {
    id: generateTxId(),
    timestamp: new Date(timestamp),
    type,
    amount: rawAmount * sign,
    currency: 'BRL',
    description: body.replace(amountToken, '').replace(/\s+/g, ' ').trim().slice(0, 100),
    bank: BANK_ID,
    rawNotification: body,
    confidence,
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
