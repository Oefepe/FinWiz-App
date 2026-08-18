import type { CandidateTx, PendingPair } from './types';

const EXPIRY_MS = 30 * 60 * 1000;

export function createPendingPair(
  tx: CandidateTx,
  direction: 'out' | 'in',
  now: number = Date.now(),
): PendingPair {
  return {
    txId: tx.txId,
    amount: Math.abs(tx.amount),
    bank: tx.bank,
    timestamp: tx.timestamp,
    direction,
    description: tx.description,
    expiresAt: now + EXPIRY_MS,
  };
}

export function isExpired(pair: PendingPair, now: number = Date.now()): boolean {
  return now >= pair.expiresAt;
}

export function getExpired(buffer: readonly PendingPair[], now: number = Date.now()): PendingPair[] {
  return buffer.filter(p => isExpired(p, now));
}

export function removeFromBuffer(buffer: readonly PendingPair[], txId: string): PendingPair[] {
  return buffer.filter(p => p.txId !== txId);
}

export function pruneExpired(buffer: readonly PendingPair[], now: number = Date.now()): PendingPair[] {
  return buffer.filter(p => !isExpired(p, now));
}
