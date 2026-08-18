export const VAULT_PATHS = {
  goals: '00-Profile/goals.md',
  accounts: '00-Profile/accounts.md',
  recurringExpenses: '03-Habits/recurring-expenses.md',
  selfTransferPairs: '04-SelfTransfers/pairs.md',
  transactionMonth: (yearMonth: string): string => `01-Transactions/${yearMonth}.md`,
  weeklyInsight: (isoWeek: string): string => `02-Insights/weekly-${isoWeek}.md`,
  monthlyInsight: (yearMonth: string): string => `02-Insights/monthly-${yearMonth}.md`,
} as const;

export interface GoalsFrontmatter {
  savings_goal_amount: number;
  savings_goal_currency: 'BRL';
  savings_period: 'weekly' | 'monthly';
  savings_goal_start: string; // YYYY-MM-DD
  allowance_alert_threshold: number;
  monthly_income_estimate: number;
  fixed_monthly_expenses: number; // rent, bills, subscriptions — aggregate total
  owner_name: string;
}

export interface TransactionTableRow {
  date: string;            // YYYY-MM-DD
  time: string;            // HH:MM
  type: string;            // TransactionType value
  amount: number;          // negative for outgoing
  description: string;
  source_bank: string;     // BankId value
  category: string;
  self_transfer_id: string; // '' for normal transactions
}

export type SelfTransferStatus = 'pending' | 'confirmed' | 'rejected' | 'expired';

export interface SelfTransferPairRow {
  id: string;           // st_[nanoid6]
  detected_at: string;  // ISO timestamp
  out_tx_id: string;
  in_tx_id: string;
  amount: number;
  out_bank: string;
  in_bank: string;
  confidence: number;
  status: SelfTransferStatus;
}
