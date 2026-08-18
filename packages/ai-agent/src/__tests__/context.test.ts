import { buildContext } from '../context';
import type { AgentContextInput } from '../context';
import type { AllowanceState } from '@finwiz/allowance-engine';
import type { GoalsFrontmatter, TransactionTableRow } from '@finwiz/obsidian-client';

const mockGoals: GoalsFrontmatter = {
  savings_goal_amount: 1000,
  savings_goal_currency: 'BRL',
  savings_period: 'monthly',
  savings_goal_start: '2025-04-01',
  allowance_alert_threshold: 0.2,
  monthly_income_estimate: 5000,
  fixed_monthly_expenses: 0,
  owner_name: '',
};

// April 10 noon values matching the calculator fixture.
const mockState: AllowanceState = {
  allowancePerPeriod: 4000,
  dailyRate: 133.33,
  elapsedAllowance: 1266.67,
  spendableTotal: 0,
  remainingAllowance: 1266.67,
  overspend: false,
  alertTriggered: false,
  remainingForPeriod: 4000,
  daysRemaining: 20.5,
  adjustedDailyRate: 195.12,
};

const mockTx: TransactionTableRow = {
  date: '2025-04-08',
  time: '14:30',
  type: 'PIX_OUT',
  amount: -150,
  description: 'Supermercado',
  source_bank: 'nubank',
  category: 'groceries',
  self_transfer_id: '',
};

function makeInput(overrides: Partial<AgentContextInput> = {}): AgentContextInput {
  return {
    goals: mockGoals,
    allowanceState: mockState,
    recentTransactions: [],
    taskPrompt: 'What is my remaining allowance?',
    ...overrides,
  };
}

describe('buildContext', () => {
  it('includes the task prompt in the output', () => {
    const result = buildContext(makeInput({ taskPrompt: 'how much can I spend today?' }));
    expect(result).toContain('how much can I spend today?');
  });

  it('includes allowance budget and remaining figures', () => {
    const result = buildContext(makeInput());
    expect(result).toContain('4000.00');
    expect(result).toContain('1266.67');
  });

  it('includes the adjusted daily rate', () => {
    const result = buildContext(makeInput());
    expect(result).toContain('195.12');
  });

  it('shows (no transactions) when list is empty', () => {
    const result = buildContext(makeInput({ recentTransactions: [] }));
    expect(result).toContain('(no transactions)');
  });

  it('includes transaction rows when provided', () => {
    const result = buildContext(makeInput({ recentTransactions: [mockTx] }));
    expect(result).toContain('Supermercado');
    expect(result).toContain('PIX_OUT');
    expect(result).toContain('-150.00');
  });

  it('limits to the most recent 10 transactions', () => {
    // Create 15 transactions with distinguishable descriptions.
    const txs: TransactionTableRow[] = Array.from({ length: 15 }, (_, i) => ({
      ...mockTx,
      description: `Transaction-${i}`,
    }));
    const result = buildContext(makeInput({ recentTransactions: txs }));
    // First 10 should appear; last 5 should not.
    expect(result).toContain('Transaction-0');
    expect(result).toContain('Transaction-9');
    expect(result).not.toContain('Transaction-10');
  });

  it('includes ⚠ OVERSPEND label when overspend is true', () => {
    const overspentState: AllowanceState = { ...mockState, overspend: true, remainingAllowance: -200 };
    const result = buildContext(makeInput({ allowanceState: overspentState }));
    expect(result).toContain('OVERSPEND');
  });

  it('does not include OVERSPEND label when overspend is false', () => {
    const result = buildContext(makeInput());
    expect(result).not.toContain('OVERSPEND');
  });
});
