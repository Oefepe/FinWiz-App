import * as SecureStore from 'expo-secure-store';

// M16 — at-rest encryption key for the SQLCipher-backed SQLite database.
// Generated once, stored exclusively in expo-secure-store (iOS Keychain /
// Android Keystore, hardware-backed where the device supports it) — never
// written into the database itself, never derived from a device identifier
// or anything else that would travel with a raw file copy. This is what
// actually defeats the "cloned phone" threat model this milestone answers:
// copying the encrypted .db file's bytes to another device does not carry
// this key material with it.
export const DB_ENCRYPTION_KEY_STORAGE_KEY = 'finwiz_db_encryption_key';

// Same CSPRNG pattern already established in iosIngest.ts's
// getOrCreateHmacSecret (M10) — relies on expo-crypto's global
// `crypto.getRandomValues` polyfill (Hermes CSPRNG) rather than importing a
// named function from 'expo-crypto' directly, for consistency with that
// existing precedent.
function generateKeyHex(): string {
  const bytes = new Uint8Array(32); // 256 bits
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface DbEncryptionKeyResult {
  readonly key: string;
  // True only on the one call that generated a brand-new key — i.e. this is
  // either a fresh install or the first launch after this feature shipped.
  // dbMigration.ts uses this flag to gate legacy-plaintext-DB detection so
  // it only ever runs once per install, never on a later launch where the
  // DB is already known to be encrypted.
  readonly wasCreated: boolean;
}

export async function getOrCreateDbEncryptionKey(): Promise<DbEncryptionKeyResult> {
  const stored = await SecureStore.getItemAsync(DB_ENCRYPTION_KEY_STORAGE_KEY);
  if (stored !== null) {
    return { key: stored, wasCreated: false };
  }

  const key = generateKeyHex();
  await SecureStore.setItemAsync(DB_ENCRYPTION_KEY_STORAGE_KEY, key, {
    // iOS: entry is device-bound and requires the device to be unlocked at
    // least once since boot to read/write — not migrated to a new device
    // during a Keychain restore. Android: expo-secure-store already backs
    // every entry with the hardware Keystore by default, so there's no
    // equivalent flag to set here.
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return { key, wasCreated: true };
}
