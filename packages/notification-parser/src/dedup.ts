import type { Transaction } from './types';

export type DedupCache = Set<string>;

export function createDedupCache(): DedupCache {
  return new Set<string>();
}

function dedupKey(tx: Transaction): string {
  const amountCents = Math.round(Math.abs(tx.amount) * 100);
  const bucket = Math.floor(tx.timestamp.getTime() / 30_000);
  return `${amountCents}:${bucket}`;
}

// Returns true if tx is a duplicate already seen in this cache window.
// Records the transaction fingerprint when it is new.
export function checkAndRecord(cache: DedupCache, tx: Transaction): boolean {
  const key = dedupKey(tx);
  if (cache.has(key)) return true;
  cache.add(key);
  return false;
}
