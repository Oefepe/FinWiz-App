import { calculateAllowance } from '@finwiz/allowance-engine';
import { tryMatch } from '@finwiz/self-transfer-detector';
import type { PendingPair, CandidateTx } from '@finwiz/self-transfer-detector';
import type { AgentRuntime, ToolCall } from './types';

export interface ToolDef {
  description: string;
  execute(args: ToolCall['args'], runtime: AgentRuntime): Promise<string>;
}

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const TOOLS: Record<string, ToolDef> = {
  read_note: {
    description: 'read_note(path) — Read a vault note by vault-relative path.',
    execute: async (args, runtime) => {
      const path = args['path'];
      if (!path) return 'Error: missing required arg "path"';
      return runtime.vault.getNote(path);
    },
  },

  write_note: {
    description: 'write_note(path, content) — Create or overwrite a vault note.',
    execute: async (args, runtime) => {
      const path = args['path'];
      const content = args['content'];
      if (!path || content === undefined) return 'Error: missing required args "path" and "content"';
      await runtime.vault.putNote(path, content);
      return 'OK';
    },
  },

  append_note: {
    description: 'append_note(path, content) — Append text to a vault note.',
    execute: async (args, runtime) => {
      const path = args['path'];
      const content = args['content'];
      if (!path || content === undefined) return 'Error: missing required args "path" and "content"';
      await runtime.vault.appendNote(path, content);
      return 'OK';
    },
  },

  query_transactions: {
    description: 'query_transactions(month, type?, category?) — Query transactions. month = YYYY-MM.',
    execute: async (args, runtime) => {
      const month = args['month'] ?? currentYearMonth();
      const txs = await runtime.store.queryTransactions(month, args['type'], args['category']);
      return JSON.stringify(txs);
    },
  },

  get_allowance_status: {
    description: 'get_allowance_status() — Get current period allowance state.',
    execute: async (_args, runtime) => {
      const config = await runtime.store.getAllowanceConfig();
      const txs = await runtime.store.queryTransactions(currentYearMonth());
      const state = calculateAllowance({
        monthlyIncomeEstimate: config.monthlyIncomeEstimate,
        fixedMonthlyExpenses: config.fixedMonthlyExpenses,
        savingsGoalAmount: config.savingsGoalAmount,
        period: config.period,
        alertThreshold: config.alertThreshold,
        transactions: txs,
      });
      return JSON.stringify(state);
    },
  },

  detect_self_transfer: {
    description:
      'detect_self_transfer(tx1_json, tx2_json) — Check if two transactions are a self-transfer pair. ' +
      'Each arg is a JSON-serialised {txId, amount, bank, timestamp, description}.',
    execute: async (args, runtime) => {
      const raw1 = args['tx1_json'];
      const raw2 = args['tx2_json'];
      if (!raw1 || !raw2) return 'Error: missing required args "tx1_json" and "tx2_json"';
      let tx1: CandidateTx, tx2: CandidateTx;
      try {
        tx1 = JSON.parse(raw1) as CandidateTx;
        tx2 = JSON.parse(raw2) as CandidateTx;
      } catch {
        return 'Error: tx1_json or tx2_json is not valid JSON';
      }
      // Place tx1 into a one-element pending buffer and check tx2 against it.
      const pending: PendingPair = {
        txId: tx1.txId,
        amount: tx1.amount,
        bank: tx1.bank,
        timestamp: tx1.timestamp,
        direction: tx1.amount <= 0 ? 'out' : 'in',
        description: tx1.description,
        expiresAt: tx1.timestamp + 30 * 60 * 1000,
      };
      const result = tryMatch(tx2, [pending], [], runtime.ownerName);
      return JSON.stringify(result);
    },
  },
};

export function getToolDescriptions(): string {
  return Object.values(TOOLS)
    .map((t) => t.description)
    .join('\n');
}

export async function executeTool(call: ToolCall, runtime: AgentRuntime): Promise<string> {
  const tool = TOOLS[call.tool];
  if (!tool) return `Error: unknown tool "${call.tool}"`;
  try {
    return await tool.execute(call.args, runtime);
  } catch (err) {
    return `Error executing "${call.tool}": ${err instanceof Error ? err.message : String(err)}`;
  }
}
