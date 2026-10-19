import type { AllowancePeriod } from '@finwiz/allowance-engine';

// The user's allowance inputs as persisted in the `allowance_state` table.
// Previously lived in @finwiz/ai-agent; moved here when the AI layer was
// removed, since database/profile code is the only remaining consumer.
export interface AllowanceConfig {
  monthlyIncomeEstimate: number;
  fixedMonthlyExpenses: number;
  savingsGoalAmount: number;
  period: AllowancePeriod;
  alertThreshold: number;
}
