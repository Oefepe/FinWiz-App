export * from './types';
export * from './window';
export * from './matcher';

import type { CandidateTx, PendingPair, SelfTransferPair, SelfTransferMatchResult } from './types';
import { tryMatch } from './matcher';
import { createPendingPair } from './window';

export interface DetectorState {
  readonly pending: readonly PendingPair[];
  readonly confirmed: readonly SelfTransferPair[];
}

export interface CheckResult {
  readonly result: SelfTransferMatchResult | null;
  readonly updatedState: DetectorState;
}

export function checkNewTransaction(
  tx: CandidateTx,
  state: DetectorState,
  ownerName?: string,
): CheckResult {
  const result = tryMatch(tx, state.pending, state.confirmed, ownerName);

  if (result !== null) {
    const matchedTxId = tx.amount <= 0 ? result.pair.inTxId : result.pair.outTxId;
    const updatedPending = state.pending.filter(p => p.txId !== matchedTxId);
    const updatedConfirmed =
      result.action === 'auto_confirm'
        ? [...state.confirmed, result.pair]
        : state.confirmed;
    return { result, updatedState: { pending: updatedPending, confirmed: updatedConfirmed } };
  }

  const direction = tx.amount <= 0 ? ('out' as const) : ('in' as const);
  const newPending = createPendingPair(tx, direction);
  return {
    result: null,
    updatedState: { ...state, pending: [...state.pending, newPending] },
  };
}
