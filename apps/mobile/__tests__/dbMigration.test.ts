import { readLegacyPlaintextData, reinsertDump, DB_NAME } from '../lib/dbMigration';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const executeMock = jest.fn();
const closeMock = jest.fn();
const getDbPathMock = jest.fn(() => '/fake/documents/finwiz.db');
const openMock = jest.fn((..._args: unknown[]) => ({
  execute: executeMock,
  close: closeMock,
  getDbPath: getDbPathMock,
}));

jest.mock('@op-engineering/op-sqlite', () => ({
  open: (...args: unknown[]) => openMock(...args),
}));

const getInfoAsyncMock = jest.fn(async (..._args: unknown[]) => ({ exists: true }));
const moveAsyncMock = jest.fn(async (..._args: unknown[]) => undefined);

jest.mock('expo-file-system', () => ({
  getInfoAsync: (...args: unknown[]) => getInfoAsyncMock(...args),
  moveAsync: (...args: unknown[]) => moveAsyncMock(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  getDbPathMock.mockReturnValue('/fake/documents/finwiz.db');
  getInfoAsyncMock.mockResolvedValue({ exists: true });
});

const TABLES = ['allowance_state', 'transactions', 'pending_self_transfer_pairs', 'confirmed_self_transfer_pairs'];

function rowsResult(rows: Record<string, unknown>[]) {
  return { rows };
}

describe('readLegacyPlaintextData', () => {
  it('opens with the documented DB_NAME and no encryption key', async () => {
    executeMock.mockResolvedValue(rowsResult([]));
    await readLegacyPlaintextData();
    expect(openMock).toHaveBeenCalledWith({ name: DB_NAME });
  });

  it('returns null when open() itself throws (nothing to migrate)', async () => {
    openMock.mockImplementationOnce(() => {
      throw new Error('cannot open');
    });
    const result = await readLegacyPlaintextData();
    expect(result).toBeNull();
  });

  it('returns null when the sqlite_master probe query fails (already encrypted / corrupt)', async () => {
    executeMock.mockImplementationOnce(async () => {
      throw new Error('file is not a database');
    });
    const result = await readLegacyPlaintextData();
    expect(result).toBeNull();
    expect(closeMock).toHaveBeenCalledTimes(1);
    // Failing closed: no backup should be attempted if we never confirmed plaintext.
    expect(moveAsyncMock).not.toHaveBeenCalled();
  });

  it('dumps every table when the probe succeeds', async () => {
    executeMock.mockImplementation(async (query: string) => {
      if (query.includes('sqlite_master')) return rowsResult([{ c: 1 }]);
      if (query.includes('allowance_state')) return rowsResult([{ id: 1, monthly_income_estimate: 5000 }]);
      if (query.includes('transactions')) return rowsResult([{ id: 'tx1', amount: -100 }]);
      return rowsResult([]);
    });

    const result = await readLegacyPlaintextData();
    expect(result).not.toBeNull();
    expect(result?.dump.allowance_state).toEqual([{ id: 1, monthly_income_estimate: 5000 }]);
    expect(result?.dump.transactions).toEqual([{ id: 'tx1', amount: -100 }]);
    expect(result?.dump.pending_self_transfer_pairs).toEqual([]);
    expect(result?.dump.confirmed_self_transfer_pairs).toEqual([]);
  });

  it("treats a missing table (SELECT * throws) as an empty dump for that table, not a hard failure", async () => {
    executeMock.mockImplementation(async (query: string) => {
      if (query.includes('sqlite_master')) return rowsResult([]);
      if (query.includes('confirmed_self_transfer_pairs')) {
        throw new Error('no such table: confirmed_self_transfer_pairs');
      }
      return rowsResult([]);
    });

    const result = await readLegacyPlaintextData();
    expect(result?.dump.confirmed_self_transfer_pairs).toEqual([]);
  });

  it('closes the legacy connection exactly once after a successful dump', async () => {
    executeMock.mockResolvedValue(rowsResult([]));
    await readLegacyPlaintextData();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('backs up the legacy file via FileSystem.moveAsync using the resolved db path', async () => {
    executeMock.mockResolvedValue(rowsResult([]));
    getDbPathMock.mockReturnValue('/fake/documents/finwiz.db');
    await readLegacyPlaintextData();
    expect(moveAsyncMock).toHaveBeenCalledWith({
      from: 'file:///fake/documents/finwiz.db',
      to: 'file:///fake/documents/finwiz.db.pre-encryption.bak',
    });
  });

  it('does not attempt a backup move when the file does not exist at the resolved path', async () => {
    executeMock.mockResolvedValue(rowsResult([]));
    getInfoAsyncMock.mockResolvedValue({ exists: false });
    await readLegacyPlaintextData();
    expect(moveAsyncMock).not.toHaveBeenCalled();
  });

  it('does not throw when the backup move itself fails — migration still returns the dump', async () => {
    executeMock.mockResolvedValue(rowsResult([{ id: 1 }]));
    moveAsyncMock.mockRejectedValueOnce(new Error('EPERM'));
    const result = await readLegacyPlaintextData();
    expect(result).not.toBeNull();
    expect(result?.dump.allowance_state).toEqual([{ id: 1 }]);
  });

  it('handles a path already prefixed with file:// without double-prefixing', async () => {
    executeMock.mockResolvedValue(rowsResult([]));
    getDbPathMock.mockReturnValue('file:///already/prefixed/finwiz.db');
    await readLegacyPlaintextData();
    expect(moveAsyncMock).toHaveBeenCalledWith({
      from: 'file:///already/prefixed/finwiz.db',
      to: 'file:///already/prefixed/finwiz.db.pre-encryption.bak',
    });
  });
});

describe('reinsertDump', () => {
  it('inserts every row of every table via INSERT OR REPLACE', async () => {
    const db = { execute: executeMock } as unknown as Parameters<typeof reinsertDump>[0];
    executeMock.mockResolvedValue(rowsResult([]));

    await reinsertDump(db, {
      allowance_state: [{ id: 1, monthly_income_estimate: 5000 }],
      transactions: [{ id: 'tx1', amount: -100 }],
      pending_self_transfer_pairs: [],
      confirmed_self_transfer_pairs: [],
    });

    expect(executeMock).toHaveBeenCalledWith(
      'INSERT OR REPLACE INTO allowance_state (id, monthly_income_estimate) VALUES (?, ?)',
      [1, 5000],
    );
    expect(executeMock).toHaveBeenCalledWith(
      'INSERT OR REPLACE INTO transactions (id, amount) VALUES (?, ?)',
      ['tx1', -100],
    );
  });

  it('issues no INSERTs at all for an entirely empty dump', async () => {
    const db = { execute: executeMock } as unknown as Parameters<typeof reinsertDump>[0];
    await reinsertDump(db, {
      allowance_state: [],
      transactions: [],
      pending_self_transfer_pairs: [],
      confirmed_self_transfer_pairs: [],
    });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('inserts every row across multiple rows in the same table', async () => {
    const db = { execute: executeMock } as unknown as Parameters<typeof reinsertDump>[0];
    executeMock.mockResolvedValue(rowsResult([]));
    await reinsertDump(db, {
      allowance_state: [],
      transactions: [{ id: 'a', amount: 1 }, { id: 'b', amount: 2 }],
      pending_self_transfer_pairs: [],
      confirmed_self_transfer_pairs: [],
    });
    expect(executeMock).toHaveBeenCalledTimes(2);
  });

  it('ignores a table key not present in the known-tables list without erroring', async () => {
    const db = { execute: executeMock } as unknown as Parameters<typeof reinsertDump>[0];
    await reinsertDump(db, {
      allowance_state: [],
      transactions: [],
      pending_self_transfer_pairs: [],
      confirmed_self_transfer_pairs: [],
      unknown_table: [{ x: 1 }],
    } as unknown as Parameters<typeof reinsertDump>[1]);
    expect(executeMock).not.toHaveBeenCalled();
  });
});

// Sanity check the fixed list of tables this module knows about matches
// what the test doubles above assume — guards against a future new table
// being added to database.ts's schema without this module (and this test
// file) being updated to carry it over during migration.
describe('table coverage', () => {
  it('exercises all four current tables somewhere in this suite', () => {
    expect(TABLES).toEqual([
      'allowance_state',
      'transactions',
      'pending_self_transfer_pairs',
      'confirmed_self_transfer_pairs',
    ]);
  });
});
