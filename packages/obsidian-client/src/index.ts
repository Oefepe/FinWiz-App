import PQueue from 'p-queue';
import { VaultClient, VaultClientConfig } from './vault';

export * from './vault';
export * from './schema';

// Singleton write queue — concurrency 1 guarantees FIFO ordering for all vault writes.
// All callers MUST use this queue for putNote / appendNote; never call vault methods directly.
export const writeQueue = new PQueue({ concurrency: 1 });

export function createObsidianClient(config: VaultClientConfig) {
  const client = new VaultClient(config);
  return {
    getNote: (path: string): Promise<string> => client.getNote(path),
    listVault: (): Promise<string[]> => client.listVault(),
    search: (query: string): Promise<string[]> => client.search(query),
    // Write operations go through the singleton queue.
    putNote: (path: string, content: string): Promise<void> =>
      writeQueue.add(() => client.putNote(path, content)) as Promise<void>,
    appendNote: (path: string, content: string): Promise<void> =>
      writeQueue.add(() => client.appendNote(path, content)) as Promise<void>,
  };
}

export type ObsidianClient = ReturnType<typeof createObsidianClient>;

const GOALS_TEMPLATE = `---
savings_goal_amount: 0.00
savings_goal_currency: BRL
savings_period: monthly
savings_goal_start: ''
allowance_alert_threshold: 0.20
monthly_income_estimate: 0.00
fixed_monthly_expenses: 0.00
owner_name: ''
---
`;

const PAIRS_HEADER =
  '| id | detected_at | out_tx_id | in_tx_id | amount | out_bank | in_bank | confidence | status |\n' +
  '|---|---|---|---|---|---|---|---|---|\n';

// Creates all required vault directories and placeholder files on first launch.
// Safe to call multiple times — PUT is idempotent.
export async function bootstrapVault(client: ObsidianClient): Promise<void> {
  await client.putNote('00-Profile/goals.md', GOALS_TEMPLATE);
  await client.putNote('00-Profile/accounts.md', '');
  await client.putNote('01-Transactions/.keep', '');
  await client.putNote('02-Insights/.keep', '');
  await client.putNote('03-Habits/recurring-expenses.md', '');
  await client.putNote('04-SelfTransfers/pairs.md', PAIRS_HEADER);
  await client.putNote('99-Agent-Log/.keep', '');
}
