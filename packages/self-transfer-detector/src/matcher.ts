import { customAlphabet } from 'nanoid';
import type { CandidateTx, MatchAction, SelfTransferPair, SelfTransferMatchResult, PendingPair } from './types';

const nanoid6 = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 6);

export const AMOUNT_TOLERANCE = 0.005;
export const TIMING_WINDOW_SECONDS = 300;

const OWN_TRANSFER_KEYWORDS = [
  'transferencia propria',
  'conta propria',
  'minha conta',
  'entre contas',
  'meu nubank',
  'meu inter',
  'meu itau',
  'meu bradesco',
  'meu santander',
  'meu c6',
  'mesma titularidade',
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ');
}

function hasKeyword(description: string, ownerName?: string): boolean {
  const n = normalize(description);
  if (OWN_TRANSFER_KEYWORDS.some(kw => n.includes(kw))) return true;
  if (ownerName !== undefined && n.includes(normalize(ownerName))) return true;
  return false;
}

export function generatePairId(): string {
  return `st_${nanoid6()}`;
}

export function computeConfidence(
  newTx: CandidateTx,
  matched: PendingPair,
  confirmedHistory: readonly SelfTransferPair[],
  ownerName?: string,
): number {
  let confidence = 0.85;

  if (hasKeyword(newTx.description, ownerName) || hasKeyword(matched.description, ownerName)) {
    confidence += 0.10;
  }

  const bankPairSeen = confirmedHistory.some(
    h =>
      (h.outBank === newTx.bank && h.inBank === matched.bank) ||
      (h.outBank === matched.bank && h.inBank === newTx.bank),
  );
  if (bankPairSeen) confidence += 0.05;

  return Math.min(confidence, 1.0);
}

export function tryMatch(
  newTx: CandidateTx,
  pending: readonly PendingPair[],
  confirmedHistory: readonly SelfTransferPair[],
  ownerName?: string,
): SelfTransferMatchResult | null {
  const newAbs = Math.abs(newTx.amount);
  const newDirection = newTx.amount <= 0 ? ('out' as const) : ('in' as const);
  const oppositeDirection = newDirection === 'out' ? ('in' as const) : ('out' as const);

  const matched = pending.find(p => {
    if (p.direction !== oppositeDirection) return false;
    if (p.bank === newTx.bank) return false;
    if (Math.abs(p.amount - newAbs) > AMOUNT_TOLERANCE) return false;
    return Math.abs(newTx.timestamp - p.timestamp) / 1000 <= TIMING_WINDOW_SECONDS;
  });

  if (!matched) return null;

  const confidence = computeConfidence(newTx, matched, confirmedHistory, ownerName);
  if (confidence < 0.50) return null;

  const action: MatchAction = confidence >= 0.75 ? 'auto_confirm' : 'escalate_to_ai';

  const isNewOut = newDirection === 'out';
  const pair: SelfTransferPair = {
    id: generatePairId(),
    detectedAt: new Date(),
    outTxId: isNewOut ? newTx.txId : matched.txId,
    inTxId: isNewOut ? matched.txId : newTx.txId,
    amount: newAbs,
    outBank: isNewOut ? newTx.bank : matched.bank,
    inBank: isNewOut ? matched.bank : newTx.bank,
    confidence,
    status: action === 'auto_confirm' ? 'confirmed' : 'pending',
  };

  return { action, pair };
}

export function createConfirmedPair(
  outTx: CandidateTx,
  inTx: CandidateTx,
  confidence: number,
): SelfTransferPair {
  return {
    id: generatePairId(),
    detectedAt: new Date(),
    outTxId: outTx.txId,
    inTxId: inTx.txId,
    amount: Math.abs(outTx.amount),
    outBank: outTx.bank,
    inBank: inTx.bank,
    confidence,
    status: 'confirmed',
  };
}

export function createManualPair(outTx: CandidateTx, inTx: CandidateTx): SelfTransferPair {
  return createConfirmedPair(outTx, inTx, 1.0);
}

export function rejectPair(pair: SelfTransferPair): SelfTransferPair {
  return { ...pair, status: 'rejected' };
}
