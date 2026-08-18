import type { GoalsFrontmatter, TransactionTableRow } from '@finwiz/obsidian-client';
import type { AllowanceState } from '@finwiz/allowance-engine';

export interface AgentContextInput {
  goals: GoalsFrontmatter;
  allowanceState: AllowanceState;
  recentTransactions: TransactionTableRow[];
  taskPrompt: string;
}

const MAX_TRANSACTIONS = 10;
const CURRENCY = 'BRL';

export function buildContext(input: AgentContextInput): string {
  const { goals, allowanceState: s, recentTransactions, taskPrompt } = input;

  const txSlice = recentTransactions.slice(0, MAX_TRANSACTIONS);
  const txLines =
    txSlice.length > 0
      ? txSlice
          .map(
            (tx) =>
              `${tx.date} ${tx.time} | ${tx.type.padEnd(20)} | ` +
              `${tx.amount >= 0 ? '+' : ''}${tx.amount.toFixed(2)} ${CURRENCY} | ` +
              `${tx.description} | ${tx.category}`,
          )
          .join('\n')
      : '(no transactions)';

  return [
    `=== Financial State (${goals.savings_period} period) ===`,
    `Allowance budget:    R$ ${s.allowancePerPeriod.toFixed(2)}`,
    `Daily rate:          R$ ${s.dailyRate.toFixed(2)}/day`,
    `Spent so far:        R$ ${s.spendableTotal.toFixed(2)}`,
    `Elapsed allowance:   R$ ${s.elapsedAllowance.toFixed(2)}`,
    `Remaining allowance: R$ ${s.remainingAllowance.toFixed(2)}${s.overspend ? ' ⚠ OVERSPEND' : ''}`,
    `Remaining in period: R$ ${s.remainingForPeriod.toFixed(2)}`,
    `Adjusted daily rate: R$ ${s.adjustedDailyRate.toFixed(2)}/day`,
    `Days remaining:      ${s.daysRemaining.toFixed(1)}`,
    '',
    `=== Last ${txSlice.length} Transaction${txSlice.length !== 1 ? 's' : ''} ===`,
    txLines,
    '',
    '=== Task ===',
    taskPrompt,
  ].join('\n');
}
