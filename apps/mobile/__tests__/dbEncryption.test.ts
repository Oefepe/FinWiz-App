import * as SecureStore from 'expo-secure-store';
import * as dbEncryptionModule from '../lib/dbEncryption';
import { getOrCreateDbEncryptionKey, DB_ENCRYPTION_KEY_STORAGE_KEY } from '../lib/dbEncryption';
import { __reset as resetSecureStore } from '../__mocks__/expo-secure-store';

beforeEach(() => {
  resetSecureStore();
});

describe('getOrCreateDbEncryptionKey', () => {
  it('generates a new 256-bit (64 hex char) key on first call', async () => {
    const { key, wasCreated } = await getOrCreateDbEncryptionKey();
    expect(wasCreated).toBe(true);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('persists the generated key to SecureStore under the documented key name', async () => {
    const { key } = await getOrCreateDbEncryptionKey();
    expect(await SecureStore.getItemAsync(DB_ENCRYPTION_KEY_STORAGE_KEY)).toBe(key);
  });

  it('returns the same key on subsequent calls, with wasCreated: false', async () => {
    const first = await getOrCreateDbEncryptionKey();
    const second = await getOrCreateDbEncryptionKey();
    expect(second.key).toBe(first.key);
    expect(second.wasCreated).toBe(false);
  });

  it('exports only the two documented symbols — nothing else that could leak the key via a different path', () => {
    expect(Object.keys(dbEncryptionModule).sort()).toEqual([
      'DB_ENCRYPTION_KEY_STORAGE_KEY',
      'getOrCreateDbEncryptionKey',
    ]);
  });

  it('generates a different key after a store reset (simulating a fresh keychain / different device)', async () => {
    const first = await getOrCreateDbEncryptionKey();
    resetSecureStore();
    const second = await getOrCreateDbEncryptionKey();
    expect(second.key).not.toBe(first.key);
    expect(second.wasCreated).toBe(true);
  });

  it('generates cryptographically distinct keys across many calls (no fixed/predictable output)', async () => {
    const keys = new Set<string>();
    for (let i = 0; i < 20; i++) {
      resetSecureStore();
      const { key } = await getOrCreateDbEncryptionKey();
      keys.add(key);
    }
    expect(keys.size).toBe(20);
  });
});
