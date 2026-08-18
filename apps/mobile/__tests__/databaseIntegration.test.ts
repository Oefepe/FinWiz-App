/**
 * M18-T8/T9 — Integration tests against a real (if fake-backed) encrypted
 * DB connection.
 *
 * Every other test touching `lib/database.ts` mocks that whole module away
 * (see `pipeline.test.ts`'s own header comment and M13-T9/M16-T7's notes on
 * why: nothing in this codebase mocks `@op-engineering/op-sqlite` at a level
 * that lets `database.ts`'s real SQL run). That leaves one real gap: does
 * `initDatabase()`'s encryption-key wiring (M16) actually feed the *same*
 * connection every CRUD function in `database.ts` uses, or could those be
 * silently talking to two different things? Mocking `../lib/database`
 * wholesale can never catch that, because it never lets `database.ts`'s own
 * code run at all.
 *
 * This file mocks one layer deeper instead — `@op-engineering/op-sqlite`'s
 * `open()` itself, following the exact pattern `dbMigration.test.ts`
 * established — behind a small in-memory SQL shim purpose-built for this
 * schema's exact query set (not a general SQL engine). That lets
 * `initDatabase()`, every `database.ts` export, and `ingestionPipeline.ts`'s
 * `runPipeline()` all run as real code against one fake connection, proving
 * they're wired together correctly. What this still cannot cover — same
 * ceiling as M16-T7 — is real SQLCipher encrypt/decrypt behavior itself,
 * since that requires a compiled native binary this environment doesn't
 * have.
 */

import type { Transaction } from '@finwiz/notification-parser';
import type { QueryResult } from '@op-engineering/op-sqlite';

// ---------------------------------------------------------------------------
// In-memory SQL shim — one table per CREATE TABLE in database.ts's schema,
// pattern-matched on the exact queries that schema's functions issue.
// ---------------------------------------------------------------------------

interface FakeRow {
  [key: string]: unknown;
}

function makeFakeDb() {
  const transactions = new Map<string, FakeRow>();
  const pendingPairs = new Map<string, FakeRow>();
  const confirmedPairs = new Map<string, FakeRow>();
  let allowanceState: FakeRow | null = null;

  async function execute(query: string, params: unknown[] = []): Promise<QueryResult> {
    const q = query.replace(/\s+/g, ' ').trim();

    // --- schema / migration statements: no-ops against an in-memory store ---
    if (q.startsWith('CREATE TABLE') || q.startsWith('ALTER TABLE')) {
      return { rows: [], rowsAffected: 0 };
    }

    // --- allowance_state ---
    if (q.startsWith('INSERT OR IGNORE INTO allowance_state')) {
      if (allowanceState === null) {
        const [id, income, fixed, savings, period, alert, banks] = params;
        allowanceState = {
          id,
          monthly_income_estimate: income,
          fixed_monthly_expenses: fixed,
          savings_goal_amount: savings,
          period,
          alert_threshold: alert,
          selected_banks: banks,
        };
      }
      return { rows: [], rowsAffected: 0 };
    }
    if (q === 'SELECT * FROM allowance_state WHERE id = 1') {
      return { rows: allowanceState !== null ? [allowanceState] : [], rowsAffected: 0 };
    }
    if (q === 'SELECT selected_banks FROM allowance_state WHERE id = 1') {
      return {
        rows: allowanceState !== null ? [{ selected_banks: allowanceState['selected_banks'] }] : [],
        rowsAffected: 0,
      };
    }
    if (q.startsWith('UPDATE allowance_state SET selected_banks')) {
      if (allowanceState !== null) allowanceState['selected_banks'] = params[0];
      return { rows: [], rowsAffected: 1 };
    }
    if (q.startsWith('UPDATE allowance_state SET')) {
      if (allowanceState !== null) {
        const [income, fixed, savings, period, alert] = params;
        Object.assign(allowanceState, {
          monthly_income_estimate: income,
          fixed_monthly_expenses: fixed,
          savings_goal_amount: savings,
          period,
          alert_threshold: alert,
        });
      }
      return { rows: [], rowsAffected: 1 };
    }

    // --- transactions ---
    if (q.startsWith('INSERT OR REPLACE INTO transactions')) {
      const [id, date, time, type, amount, description, source_bank, category, self_transfer_id] =
        params;
      transactions.set(id as string, {
        id,
        date,
        time,
        type,
        amount,
        description,
        source_bank,
        category,
        self_transfer_id,
        installments: 1,
      });
      return { rows: [], rowsAffected: 1 };
    }
    if (q.startsWith('SELECT * FROM transactions WHERE date LIKE ?')) {
      const monthPrefix = (params[0] as string).replace('%', '');
      let rows = [...transactions.values()].filter((r) =>
        (r['date'] as string).startsWith(monthPrefix),
      );
      if (q.includes('AND type = ?') && q.includes('AND category = ?')) {
        rows = rows.filter((r) => r['type'] === params[1] && r['category'] === params[2]);
      } else if (q.includes('AND type = ?')) {
        rows = rows.filter((r) => r['type'] === params[1]);
      } else if (q.includes('AND category = ?')) {
        rows = rows.filter((r) => r['category'] === params[1]);
      }
      rows.sort((a, b) =>
        `${b['date']}${b['time']}`.localeCompare(`${a['date']}${a['time']}`),
      );
      return { rows, rowsAffected: 0 };
    }
    if (q.startsWith('SELECT * FROM transactions WHERE date >= ?')) {
      const [start, end] = params as [string, string];
      const rows = [...transactions.values()]
        .filter((r) => (r['date'] as string) >= start && (r['date'] as string) < end)
        .sort((a, b) => `${a['date']}${a['time']}`.localeCompare(`${b['date']}${b['time']}`));
      return { rows, rowsAffected: 0 };
    }
    if (q === 'SELECT * FROM transactions WHERE id = ?') {
      const row = transactions.get(params[0] as string);
      return { rows: row !== undefined ? [row] : [], rowsAffected: 0 };
    }
    if (q.startsWith('UPDATE transactions SET type = ?, self_transfer_id = ?')) {
      const [newType, selfTransferId, id] = params;
      const row = transactions.get(id as string);
      if (row !== undefined) {
        row['type'] = newType;
        row['self_transfer_id'] = selfTransferId;
      }
      return { rows: [], rowsAffected: row !== undefined ? 1 : 0 };
    }
    if (q.startsWith('UPDATE transactions SET') && q.includes('WHERE id = ?')) {
      const id = params[params.length - 1] as string;
      const row = transactions.get(id);
      if (row !== undefined) {
        const [date, time, type, amount, description, source_bank, category, installments] =
          params;
        Object.assign(row, { date, time, type, amount, description, source_bank, category, installments });
      }
      return { rows: [], rowsAffected: row !== undefined ? 1 : 0 };
    }
    if (q === 'DELETE FROM transactions WHERE id = ?') {
      const existed = transactions.delete(params[0] as string);
      return { rows: [], rowsAffected: existed ? 1 : 0 };
    }

    // --- pending_self_transfer_pairs ---
    if (q.startsWith('INSERT OR REPLACE INTO pending_self_transfer_pairs')) {
      const [id, tx_id, tx_json, expires_at] = params;
      pendingPairs.set(id as string, { id, tx_id, tx_json, expires_at });
      return { rows: [], rowsAffected: 1 };
    }
    if (q === 'SELECT tx_id FROM pending_self_transfer_pairs WHERE expires_at > ?') {
      const now = params[0] as number;
      const rows = [...pendingPairs.values()]
        .filter((r) => (r['expires_at'] as number) > now)
        .map((r) => ({ tx_id: r['tx_id'] }));
      return { rows, rowsAffected: 0 };
    }
    if (q === 'SELECT tx_json FROM pending_self_transfer_pairs WHERE expires_at > ?') {
      const now = params[0] as number;
      const rows = [...pendingPairs.values()]
        .filter((r) => (r['expires_at'] as number) > now)
        .map((r) => ({ tx_json: r['tx_json'] }));
      return { rows, rowsAffected: 0 };
    }
    if (q === 'DELETE FROM pending_self_transfer_pairs WHERE tx_id = ?') {
      const txId = params[0] as string;
      for (const [key, row] of pendingPairs) {
        if (row['tx_id'] === txId) pendingPairs.delete(key);
      }
      return { rows: [], rowsAffected: 1 };
    }
    if (q === 'DELETE FROM pending_self_transfer_pairs WHERE expires_at <= ?') {
      const now = params[0] as number;
      for (const [key, row] of pendingPairs) {
        if ((row['expires_at'] as number) <= now) pendingPairs.delete(key);
      }
      return { rows: [], rowsAffected: 1 };
    }

    // --- confirmed_self_transfer_pairs ---
    if (q.startsWith('INSERT OR REPLACE INTO confirmed_self_transfer_pairs')) {
      const [id, out_bank, in_bank, confirmed_at] = params;
      confirmedPairs.set(id as string, { id, out_bank, in_bank, confirmed_at });
      return { rows: [], rowsAffected: 1 };
    }
    if (q === 'SELECT out_bank, in_bank FROM confirmed_self_transfer_pairs') {
      const rows = [...confirmedPairs.values()].map((r) => ({
        out_bank: r['out_bank'],
        in_bank: r['in_bank'],
      }));
      return { rows, rowsAffected: 0 };
    }

    throw new Error(`FakeDb: unhandled query — ${q}`);
  }

  return {
    execute: jest.fn(execute),
    executeBatch: jest.fn(async (commands: [string, unknown[]?][]) => {
      for (const [query, params] of commands) {
        await execute(query, params ?? []);
      }
      return { rowsAffected: 0 };
    }),
    close: jest.fn(),
    getDbPath: jest.fn(() => '/fake/documents/finwiz.db'),
  };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const FAKE_ENCRYPTION_KEY = 'a'.repeat(64);
let fakeDb: ReturnType<typeof makeFakeDb>;
const openMock = jest.fn((..._args: unknown[]) => fakeDb);

jest.mock('@op-engineering/op-sqlite', () => ({
  open: (...args: unknown[]) => openMock(...args),
}));

// Scoped narrowly to this test's own concern (does the pipeline talk to an
// encrypted-key-initialized DB), not M16-T7's already-covered migration
// path — so the key-provisioning step is faked as "already provisioned"
// (wasCreated: false) rather than exercising first-launch generation again.
jest.mock('../lib/dbEncryption', () => ({
  getOrCreateDbEncryptionKey: jest.fn(async () => ({
    key: FAKE_ENCRYPTION_KEY,
    wasCreated: false,
  })),
  DB_ENCRYPTION_KEY_STORAGE_KEY: 'finwiz_db_encryption_key',
}));

// database.ts imports dbMigration.ts at module load time, which imports the
// real expo-file-system package — untransformed ESM that jest can't parse
// under this project's ts-jest-only setup. Not exercised directly by these
// tests (getOrCreateDbEncryptionKey is mocked to wasCreated: false above, so
// initDatabase() never actually calls into dbMigration's functions), but the
// import still needs a stand-in purely so the module graph loads. Same
// pattern dbMigration.test.ts itself already establishes.
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  moveAsync: jest.fn(async () => undefined),
}));

jest.mock('@finwiz/obsidian-client', () => ({
  createObsidianClient: jest.fn().mockReturnValue({
    appendNote: jest.fn().mockResolvedValue(undefined),
    putNote: jest.fn().mockResolvedValue(undefined),
    getNote: jest.fn().mockResolvedValue(''),
    listVault: jest.fn().mockResolvedValue([]),
    search: jest.fn().mockResolvedValue([]),
  }),
  bootstrapVault: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TS_OUT = 1712750400000;
const TS_IN = TS_OUT + 120_000; // 2 minutes later — within the 300s window

const PIX_OUT_TX: Transaction = {
  id: 'tx-out-001',
  type: 'PIX_OUT',
  amount: -500,
  currency: 'BRL',
  description: 'Pix enviado',
  bank: 'nubank',
  rawNotification: 'Pix enviado: R$ 500,00',
  selfTransferId: '',
  timestamp: new Date(TS_OUT),
  confidence: 0.95,
  source: 'bank',
  walletId: null,
};

const PIX_IN_TX: Transaction = {
  id: 'tx-in-001',
  type: 'PIX_IN',
  amount: 500,
  currency: 'BRL',
  description: 'Pix recebido',
  bank: 'itau',
  rawNotification: 'Pix recebido: R$ 500,00',
  selfTransferId: '',
  timestamp: new Date(TS_IN),
  confidence: 0.95,
  source: 'bank',
  walletId: null,
};

// ---------------------------------------------------------------------------
// M18-T8 — full ingestion pipeline, encrypted-DB init, real database.ts
// ---------------------------------------------------------------------------

describe('M18-T8 — ingestion pipeline against a real (encrypted-key-initialized) DB', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    openMock.mockClear();
    fakeDb = makeFakeDb();
    const { initDatabase } = jest.requireActual('../lib/database') as typeof import('../lib/database');
    await initDatabase();
  });

  it('initDatabase() opens with the encryption key from getOrCreateDbEncryptionKey()', () => {
    expect(openMock).toHaveBeenCalledWith(
      expect.objectContaining({ encryptionKey: FAKE_ENCRYPTION_KEY }),
    );
  });

  it('runPipeline() writes through database.ts real SQL to the same connection initDatabase() opened', async () => {
    const { runPipeline } =
      jest.requireActual('../lib/ingestionPipeline') as typeof import('../lib/ingestionPipeline');
    const { queryTransactions } =
      jest.requireActual('../lib/database') as typeof import('../lib/database');

    await runPipeline(PIX_OUT_TX);

    const rows = await queryTransactions('2024-04');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'tx-out-001',
      type: 'PIX_OUT',
      amount: -500,
      source_bank: 'nubank',
    });
  });

  it('a second, unrelated call to open() is never made mid-pipeline (one connection, not two)', async () => {
    const { runPipeline } =
      jest.requireActual('../lib/ingestionPipeline') as typeof import('../lib/ingestionPipeline');
    openMock.mockClear();

    await runPipeline(PIX_OUT_TX);

    expect(openMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// M18-T9 — self-transfer confirm/expiry flows against the same encrypted-DB path
// ---------------------------------------------------------------------------

describe('M18-T9 — self-transfer pair confirm/expiry against a real (encrypted-key-initialized) DB', () => {
  // `runPipeline()` unconditionally calls the real `pruneExpiredPairs()` at
  // the end of every invocation (see T7's own "expired pairs are pruned
  // after every runPipeline call" coverage in pipeline.test.ts), and that
  // real prune compares each pending pair's `expiresAt` against the real
  // `Date.now()` — not the fixture's 2024 timestamps. Left unmocked, the
  // very first `runPipeline()` call in this block would prune its own
  // just-created pending pair before the second leg ever arrived, since
  // 2024 + 30 minutes is always "expired" relative to whenever this suite
  // actually runs. Freezing `Date.now()` to a fixed instant anchored to the
  // fixtures (and only moving it forward inside the expiry test itself)
  // keeps every other assertion in this block decoupled from wall-clock
  // time, the way a real 2-minutes-apart pair of bank notifications would
  // behave regardless of what day the app happens to run on.
  const FROZEN_NOW = TS_IN + 1000; // just after the second leg — nothing is expired yet

  beforeEach(async () => {
    jest.clearAllMocks();
    openMock.mockClear();
    jest.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
    fakeDb = makeFakeDb();
    const { initDatabase } = jest.requireActual('../lib/database') as typeof import('../lib/database');
    await initDatabase();
  });

  afterEach(() => {
    jest.spyOn(Date, 'now').mockRestore();
  });

  it('two legs within the matching window are both re-typed and a confirmed pair is persisted', async () => {
    const { runPipeline } =
      jest.requireActual('../lib/ingestionPipeline') as typeof import('../lib/ingestionPipeline');
    const { getTransactionById, getConfirmedPairBanks, getPendingPairTxIds } =
      jest.requireActual('../lib/database') as typeof import('../lib/database');

    await runPipeline(PIX_OUT_TX);
    // Still pending — no match yet.
    expect(await getPendingPairTxIds()).toEqual(new Set(['tx-out-001']));

    await runPipeline(PIX_IN_TX);

    const outLeg = await getTransactionById('tx-out-001');
    const inLeg = await getTransactionById('tx-in-001');
    expect(outLeg?.type).toBe('SELF_TRANSFER_OUT');
    expect(inLeg?.type).toBe('SELF_TRANSFER_IN');
    expect(outLeg?.self_transfer_id).toBe(inLeg?.self_transfer_id);

    const confirmed = await getConfirmedPairBanks();
    expect(confirmed).toEqual([{ outBank: 'nubank', inBank: 'itau' }]);

    // The pending buffer entry is consumed once matched.
    expect(await getPendingPairTxIds()).toEqual(new Set());
  });

  it('an expired pending pair is pruned and its transaction is re-included in the allowance query', async () => {
    const { runPipeline } =
      jest.requireActual('../lib/ingestionPipeline') as typeof import('../lib/ingestionPipeline');
    const { queryAllowanceTransactions, pruneExpiredPairs } =
      jest.requireActual('../lib/database') as typeof import('../lib/database');

    // Insert while "now" is right at the transaction's own timestamp, so
    // runPipeline's own end-of-call prune sees a not-yet-expired pair.
    jest.spyOn(Date, 'now').mockReturnValue(TS_OUT);
    await runPipeline({ ...PIX_OUT_TX, id: 'tx-stale-001', timestamp: new Date(TS_OUT) });

    // Excluded from allowance while the pending pair is still live.
    // (AllowanceTx carries no `id`, only type/amount/selfTransferStatus — this
    // is the only transaction in this test's fake DB, so indexing is safe.)
    const beforePrune = await queryAllowanceTransactions('2024-04');
    expect(beforePrune).toHaveLength(1);
    expect(beforePrune[0]?.selfTransferStatus).toBe('pending');

    // Advance past the 30-minute expiry window (M4/M16-T7 boundary) and
    // prune — the next unrelated pipeline run does this automatically too,
    // called directly here for clarity.
    jest.spyOn(Date, 'now').mockReturnValue(TS_OUT + 31 * 60 * 1000);
    await pruneExpiredPairs();

    const afterPrune = await queryAllowanceTransactions('2024-04');
    expect(afterPrune).toHaveLength(1);
    expect(afterPrune[0]?.selfTransferStatus).toBeUndefined();
  });
});
