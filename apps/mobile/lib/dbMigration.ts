import { open, type DB } from '@op-engineering/op-sqlite';
import * as FileSystem from 'expo-file-system';

export const DB_NAME = 'finwiz.db';

// Every table this app has ever created, in the order database.ts's own
// schema batch creates them. No foreign keys exist between them, so
// dump/reinsert order doesn't matter for referential integrity — kept
// stable here purely for readability.
const LEGACY_TABLES = [
  'allowance_state',
  'transactions',
  'pending_self_transfer_pairs',
  'confirmed_self_transfer_pairs',
] as const;

export interface LegacyDump {
  readonly dump: Readonly<Record<string, readonly Record<string, unknown>[]>>;
}

// M16-T3 — legacy-plaintext-database migration. Only ever called on the one
// launch where dbEncryption.ts's getOrCreateDbEncryptionKey() just generated
// a brand-new key (a fresh install or the first launch after this feature
// shipped) — never on a later launch, where the DB is already known to be
// encrypted and re-probing it with no key would be both pointless and
// unverified behavior against a real compiled SQLCipher build.
//
// Deliberately does NOT use SQLCipher's `sqlcipher_export()` pragma / the
// ATTACH-DATABASE-KEY-'x' migration recipe that's the "standard" SQLCipher
// approach elsewhere — that path depends on native SQLCipher SQL behavior
// this environment has no way to compile and verify. Instead this reads
// every row out via the exact same `execute()` calls the rest of this
// codebase already relies on and is tested against, then reinserts them
// into a freshly-created encrypted database using the app's normal schema
// setup. Slower for a large DB, but this is a personal finance tracker's
// local SQLite file, not an enterprise dataset — and every step here is
// exercised by the existing DB-layer code paths rather than an unverified
// native pragma.
//
// NEEDS REAL-DEVICE VERIFICATION before shipping: this logic is exercised
// in tests via a mocked '@op-engineering/op-sqlite' and 'expo-file-system'
// (see __tests__/dbMigration.test.ts), not against an actual compiled
// SQLCipher build. Test the full migration against real pre-encryption dev
// data on a real Android/iOS build before any device upgrades — this is the
// same requirement already called out in the plan's Risk Register.
export async function readLegacyPlaintextData(): Promise<LegacyDump | null> {
  let legacy: DB;
  try {
    legacy = open({ name: DB_NAME }); // no key -> reads a plaintext file as-is
  } catch {
    return null; // couldn't even open — nothing to migrate
  }

  try {
    await legacy.execute('SELECT count(*) as c FROM sqlite_master');
  } catch {
    // Already encrypted (or corrupt) — nothing readable without the right
    // key. Unexpected on this code path (see the wasCreated gate above),
    // but failing closed — skip migration, let the caller open a clean
    // encrypted DB — is the safe default over guessing what went wrong.
    legacy.close();
    return null;
  }

  const dump: Record<string, Record<string, unknown>[]> = {};
  for (const table of LEGACY_TABLES) {
    try {
      const result = await legacy.execute(`SELECT * FROM ${table}`);
      dump[table] = result.rows as Record<string, unknown>[];
    } catch {
      // Table didn't exist yet in this particular legacy DB (e.g. a very
      // old dev install predating a later ALTER TABLE) — nothing to carry
      // over for it.
      dump[table] = [];
    }
  }

  const legacyPath = legacy.getDbPath();
  legacy.close();
  await backupLegacyFile(legacyPath);

  return { dump };
}

// Renames (never deletes) the plaintext file so the subsequent fresh
// `open({ name: DB_NAME, encryptionKey })` call creates a clean encrypted
// file under the original name. Per the plan's Risk Register: "keep a
// pre-migration backup file until migration is verified" — this is that
// backup, left in place indefinitely rather than auto-deleted.
async function backupLegacyFile(path: string): Promise<void> {
  const uri = path.startsWith('file://') ? path : `file://${path}`;
  const backupUri = `${uri}.pre-encryption.bak`;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.moveAsync({ from: uri, to: backupUri });
    }
  } catch {
    // Best-effort: if the rename fails for some platform-specific reason,
    // the plaintext file is simply left in place under its original name.
    // The fresh encrypted DB is still created and used going forward
    // regardless — this only affects whether the stale plaintext copy
    // lingers under its original name vs. a `.pre-encryption.bak` one.
  }
}

// Re-inserts a dump produced by readLegacyPlaintextData() into a DB that has
// already had the normal schema-creation batch run against it.
export async function reinsertDump(db: DB, dump: LegacyDump['dump']): Promise<void> {
  for (const table of LEGACY_TABLES) {
    const rows = dump[table] ?? [];
    for (const row of rows) {
      const columns = Object.keys(row);
      if (columns.length === 0) continue;
      const placeholders = columns.map(() => '?').join(', ');
      await db.execute(
        `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        columns.map((c) => row[c]),
      );
    }
  }
}
