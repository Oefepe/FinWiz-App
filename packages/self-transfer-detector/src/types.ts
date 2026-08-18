export type SelfTransferStatus = 'pending' | 'confirmed' | 'rejected' | 'expired';

export interface SelfTransferPair {
  id: string;            // st_[nanoid6]
  detectedAt: Date;
  outTxId: string;
  inTxId: string;
  amount: number;
  outBank: string;
  inBank: string;
  confidence: number;
  status: SelfTransferStatus;
}

export interface PendingPair {
  txId: string;
  amount: number;
  bank: string;
  timestamp: number;
  direction: 'out' | 'in';
  description: string;
  expiresAt: number;     // Unix ms
}

export interface CandidateTx {
  txId: string;
  amount: number;        // negative = outgoing, positive = incoming
  bank: string;
  timestamp: number;     // Unix ms
  description: string;
}

export type MatchAction = 'auto_confirm' | 'escalate_to_ai' | 'ignore';

export interface SelfTransferMatchResult {
  action: MatchAction;
  pair: SelfTransferPair;
}
