import { open, type DB } from '@op-engineering/op-sqlite';
import type { AllowancePeriod, AllowanceTx } from '@finwiz/allowance-engine';
import type { TransactionTableRow } from '@finwiz/obsidian-client';
import type { AllowanceConfig } from '@finwiz/ai-agent';
import type { PendingPair, SelfTransferPair } from '@finwiz/self-transfer-detector';
import type { TransactionRecord } from './transactionUtils';
import { getOrCreateDbEncryptionKey } from './dbEncryption';
import { DB_NAME, readLegacyPlaintextData, reinsertDump } from './dbMigration';

let db: DB | null = null;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

// M16 — at-rest encryption. The database is opened with a key from
// dbEncryption.ts (SQLCipher-backed once `op-sqlite.sqlcipher: true` is set
// in package.json — see the M16 plan notes) rather than plaintext. On the
// one launch where that key is freshly generated, readLegacyPlaintextData()
// checks for and migrates a pre-M16 plaintext database before this
// function's normal schema-creation batch runs.
export async function initDatabase(): Promise<void> {
  const { key, wasCreated } = await getOrCreateDbEncryptionKey();
  const legacyData = wasCreated ? await readLegacyPlaintextData() : null;

  db = open({ name: DB_NAME, encryptionKey: key });

  await createSchema(db);

  if (legacyData !== null) {
    await reinsertDump(db, legacyData.dump);
  }
}

async function createSchema(database: DB): Promise<void> {
  await database.executeBatch([
    [
      `CREATE TABLE IF NOT EXISTS confirmed_self_transfer_pairs (
        id           TEXT PRIMARY KEY,
        out_bank     TEXT NOT NULL,
        in_bank      TEXT NOT NULL,
        confirmed_at INTEGER NOT NULL
      )`,
    ],
    [
      `CREATE TABLE IF NOT EXISTS transactions (
        id               TEXT PRIMARY KEY,
        date             TEXT NOT NULL,
        time             TEXT NOT NULL,
        type             TEXT NOT NULL,
        amount           REAL NOT NULL,
        description      TEXT NOT NULL,
        source_bank      TEXT NOT NULL,
        category         TEXT NOT NULL DEFAULT '',
        self_transfer_id TEXT NOT NULL DEFAULT '',
        installments     INTEGER NOT NULL DEFAULT 1
      )`,
    ],
    [
      `CREATE TABLE IF NOT EXISTS pending_self_transfer_pairs (
        id         TEXT    PRIMARY KEY,
        tx_id      TEXT    NOT NULL,
        tx_json    TEXT    NOT NULL,
        expires_at INTEGER NOT NULL
      )`,
    ],
    [
      // Single-row config table — stores the user's allowance settings.
      // Named allowance_state to match the M7 spec task list.
      `CREATE TABLE IF NOT EXISTS allowance_state (
        id                      INTEGER PRIMARY KEY CHECK (id = 1),
        monthly_income_estimate REAL    NOT NULL DEFAULT 0,
        fixed_monthly_expenses  REAL    NOT NULL DEFAULT 0,
        savings_goal_amount     REAL    NOT NULL DEFAULT 0,
        period                  TEXT    NOT NULL DEFAULT 'monthly',
        alert_threshold         REAL    NOT NULL DEFAULT 0.2,
        selected_banks          TEXT    NOT NULL DEFAULT '[]'
      )`,
    ],
    [
      `INSERT OR IGNORE INTO allowance_state
         (id, monthly_income_estimate, fixed_monthly_expenses, savings_goal_amount, period, alert_threshold, selected_banks)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [1, 0, 0, 0, 'monthly', 0.2, '[]'],
    ],
  ]);

  // Add columns to existing DBs that predate them — ALTER TABLE is idempotent via try/catch.
  for (const migration of [
    `ALTER TABLE allowance_state ADD COLUMN selected_banks TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE allowance_state ADD COLUMN fixed_monthly_expenses REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE transactions ADD COLUMN installments INTEGER NOT NULL DEFAULT 1`,
  ]) {
    try {
      await database.execute(migration);
    } catch {
      // Column already exists — safe to ignore.
    }
  }
}

// ---------------------------------------------------------------------------
// Accessor
// ---------------------------------------------------------------------------

function getDb(): DB {
  if (db === null) {
    throw new Error('Database not initialised — call initDatabase() first');
  }
  return db;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export async function queryTransactions(
  month: string,
  type?: string,
  category?: string,
): Promise<TransactionRecord[]> {
  let sql =
    'SELECT * FROM transactions WHERE date LIKE ? ORDER BY date DESC, time DESC';
  const params: unknown[] = [`${month}%`];

  if (type !== undefined && category !== undefined) {
    sql =
      'SELECT * FROM transactions WHERE date LIKE ? AND type = ? AND category = ? ORDER BY date DESC, time DESC';
    params.push(type, category);
  } else if (type !== undefined) {
    sql =
      'SELECT * FROM transactions WHERE date LIKE ? AND type = ? ORDER BY date DESC, time DESC';
    params.push(type);
  } else if (category !== undefined) {
    sql =
      'SELECT * FROM transactions WHERE date LIKE ? AND category = ? ORDER BY date DESC, time DESC';
    params.push(category);
  }

  const result = await getDb().execute(sql, params);
  return result.rows as TransactionRecord[];
}

// M15 — chart bucketing and period-over-period comparisons need arbitrary
// date ranges (a trailing week, a closed previous month, a whole year),
// which the month-keyed queryTransactions() above can't express. `endDate`
// is exclusive, matching allowance-engine's PeriodBounds convention (`end`
// is the next period's own start), so ranges never overlap or double-count
// a boundary day.
export async function queryTransactionsInRange(
  startDate: string,
  endDate: string,
): Promise<TransactionRecord[]> {
  const result = await getDb().execute(
    'SELECT * FROM transactions WHERE date >= ? AND date < ? ORDER BY date ASC, time ASC',
    [startDate, endDate],
  );
  return result.rows as TransactionRecord[];
}

export async function getTransactionById(id: string): Promise<TransactionRecord | null> {
  const result = await getDb().execute('SELECT * FROM transactions WHERE id = ?', [id]);
  const row = result.rows[0] as TransactionRecord | undefined;
  return row ?? null;
}

export async function updateTransactionType(
  tx: Pick<TransactionTableRow, 'date' | 'time' | 'description'>,
  newType: string,
): Promise<void> {
  await getDb().execute(
    `UPDATE transactions SET type = ?
     WHERE date = ? AND time = ? AND description = ?`,
    [newType, tx.date, tx.time, tx.description],
  );
}

// Full field update for the M13 Edit screen. Deliberately does not touch
// self_transfer_id — that's owned exclusively by the self-transfer flows
// (updateTransactionSelfTransfer / the detector) so a plain field edit can
// never silently break a confirmed pair.
export interface TransactionUpdate {
  date: string;
  time: string;
  type: string;
  amount: number;
  description: string;
  source_bank: string;
  category: string;
  installments: number;
}

export async function updateTransaction(id: string, fields: TransactionUpdate): Promise<void> {
  await getDb().execute(
    `UPDATE transactions
     SET date = ?, time = ?, type = ?, amount = ?, description = ?,
         source_bank = ?, category = ?, installments = ?
     WHERE id = ?`,
    [
      fields.date,
      fields.time,
      fields.type,
      fields.amount,
      fields.description,
      fields.source_bank,
      fields.category,
      fields.installments,
      id,
    ],
  );
}

// Hard delete — no soft-delete/undo, per the Figma copy: "Deleting a
// transaction is irreversible."
export async function deleteTransaction(id: string): Promise<void> {
  await getDb().execute('DELETE FROM transactions WHERE id = ?', [id]);
}

export async function insertTransaction(
  tx: TransactionTableRow & { id: string },
): Promise<void> {
  await getDb().execute(
    `INSERT OR REPLACE INTO transactions
       (id, date, time, type, amount, description, source_bank, category, self_transfer_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tx.id,
      tx.date,
      tx.time,
      tx.type,
      tx.amount,
      tx.description,
      tx.source_bank,
      tx.category,
      tx.self_transfer_id,
    ],
  );
}

// ---------------------------------------------------------------------------
// Allowance config
// ---------------------------------------------------------------------------

export async function getAllowanceConfig(): Promise<AllowanceConfig> {
  const result = await getDb().execute(
    'SELECT * FROM allowance_state WHERE id = 1',
  );
  const row = result.rows[0] as
    | {
        monthly_income_estimate: number;
        fixed_monthly_expenses: number;
        savings_goal_amount: number;
        period: string;
        alert_threshold: number;
      }
    | undefined;

  if (row === undefined) {
    throw new Error('Allowance config row missing — was initDatabase() called?');
  }

  return {
    monthlyIncomeEstimate: row.monthly_income_estimate,
    fixedMonthlyExpenses: row.fixed_monthly_expenses,
    savingsGoalAmount: row.savings_goal_amount,
    period: row.period as AllowancePeriod,
    alertThreshold: row.alert_threshold,
  };
}

export async function saveAllowanceConfig(config: AllowanceConfig): Promise<void> {
  await getDb().execute(
    `UPDATE allowance_state
     SET monthly_income_estimate = ?,
         fixed_monthly_expenses  = ?,
         savings_goal_amount     = ?,
         period                  = ?,
         alert_threshold         = ?
     WHERE id = 1`,
    [
      config.monthlyIncomeEstimate,
      config.fixedMonthlyExpenses,
      config.savingsGoalAmount,
      config.period,
      config.alertThreshold,
    ],
  );
}

// ---------------------------------------------------------------------------
// Selected banks (notification filter)
// ---------------------------------------------------------------------------

export async function getSelectedBanks(): Promise<string[]> {
  const result = await getDb().execute(
    'SELECT selected_banks FROM allowance_state WHERE id = 1',
  );
  const row = result.rows[0] as { selected_banks: string } | undefined;
  if (row === undefined) return [];
  try {
    return JSON.parse(row.selected_banks) as string[];
  } catch {
    return [];
  }
}

export async function saveSelectedBanks(banks: string[]): Promise<void> {
  await getDb().execute(
    `UPDATE allowance_state SET selected_banks = ? WHERE id = 1`,
    [JSON.stringify(banks)],
  );
}

// ---------------------------------------------------------------------------
// Self-transfer pending buffer
// ---------------------------------------------------------------------------

export async function getPendingPairTxIds(): Promise<Set<string>> {
  const result = await getDb().execute(
    'SELECT tx_id FROM pending_self_transfer_pairs WHERE expires_at > ?',
    [Date.now()],
  );
  return new Set((result.rows as { tx_id: string }[]).map((r) => r.tx_id));
}

export async function getPendingPairsForDetector(): Promise<PendingPair[]> {
  const result = await getDb().execute(
    'SELECT tx_json FROM pending_self_transfer_pairs WHERE expires_at > ?',
    [Date.now()],
  );
  return (result.rows as { tx_json: string }[]).map((r) => JSON.parse(r.tx_json) as PendingPair);
}

export async function savePendingPair(pair: PendingPair): Promise<void> {
  await getDb().execute(
    `INSERT OR REPLACE INTO pending_self_transfer_pairs (id, tx_id, tx_json, expires_at)
     VALUES (?, ?, ?, ?)`,
    [pair.txId, pair.txId, JSON.stringify(pair), pair.expiresAt],
  );
}

export async function deletePendingPair(txId: string): Promise<void> {
  await getDb().execute(
    'DELETE FROM pending_self_transfer_pairs WHERE tx_id = ?',
    [txId],
  );
}

export async function pruneExpiredPairs(): Promise<void> {
  await getDb().execute(
    'DELETE FROM pending_self_transfer_pairs WHERE expires_at <= ?',
    [Date.now()],
  );
}

// ---------------------------------------------------------------------------
// Confirmed self-transfer pairs (bank-pair history for confidence scoring)
// ---------------------------------------------------------------------------

export async function getConfirmedPairBanks(): Promise<Array<{ outBank: string; inBank: string }>> {
  const result = await getDb().execute(
    'SELECT out_bank, in_bank FROM confirmed_self_transfer_pairs',
  );
  return (result.rows as { out_bank: string; in_bank: string }[]).map((r) => ({
    outBank: r.out_bank,
    inBank: r.in_bank,
  }));
}

export async function saveConfirmedPair(pair: SelfTransferPair): Promise<void> {
  await getDb().execute(
    `INSERT OR REPLACE INTO confirmed_self_transfer_pairs (id, out_bank, in_bank, confirmed_at)
     VALUES (?, ?, ?, ?)`,
    [pair.id, pair.outBank, pair.inBank, Date.now()],
  );
}

// ---------------------------------------------------------------------------
// Transaction self-transfer update
// ---------------------------------------------------------------------------

export async function updateTransactionSelfTransfer(
  id: string,
  newType: string,
  selfTransferId: string,
): Promise<void> {
  await getDb().execute(
    'UPDATE transactions SET type = ?, self_transfer_id = ? WHERE id = ?',
    [newType, selfTransferId, id],
  );
}

// ---------------------------------------------------------------------------
// Allowance-aware transaction query (includes selfTransferStatus for pending exclusion)
// ---------------------------------------------------------------------------

async function toAllowanceTxs(rows: TransactionRecord[]): Promise<AllowanceTx[]> {
  const pendingTxIds = await getPendingPairTxIds();
  return rows.map((row) => {
    const r = row as typeof row & { id: string };
    return {
      type: r.type,
      amount: r.amount,
      selfTransferStatus: pendingTxIds.has(r.id) ? 'pending' : undefined,
    };
  });
}

export async function queryAllowanceTransactions(month: string): Promise<AllowanceTx[]> {
  return toAllowanceTxs(await queryTransactions(month));
}

// M15 — previous-period comparisons need an arbitrary date range (a closed
// prior week/month), not a single calendar month. `endDate` exclusive, same
// convention as queryTransactionsInRange.
export async function queryAllowanceTransactionsInRange(
  startDate: string,
  endDate: string,
): Promise<AllowanceTx[]> {
  return toAllowanceTxs(await queryTransactionsInRange(startDate, endDate));
}
