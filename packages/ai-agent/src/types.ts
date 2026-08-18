import type { AllowancePeriod } from '@finwiz/allowance-engine';
import type { ObsidianClient } from '@finwiz/obsidian-client';

export type { ObsidianClient };

export interface ToolCall {
  tool: string;
  args: Record<string, string>;
}

export interface LlmBackend {
  generate(prompt: string): Promise<string>;
}

export interface AllowanceConfig {
  monthlyIncomeEstimate: number;
  fixedMonthlyExpenses: number;
  savingsGoalAmount: number;
  period: AllowancePeriod;
  alertThreshold: number;
}

// Subset of AllowanceTx — sufficient for the DataStore contract.
export interface TransactionSummary {
  type: string;
  amount: number;
  description: string;
  category: string;
  selfTransferStatus?: '' | 'pending' | 'confirmed' | 'rejected' | 'expired';
}

export interface DataStore {
  queryTransactions(month: string, type?: string, category?: string): Promise<TransactionSummary[]>;
  getAllowanceConfig(): Promise<AllowanceConfig>;
}

export interface AgentRuntime {
  llm: LlmBackend;
  vault: ObsidianClient;
  store: DataStore;
  ownerName?: string;
}
