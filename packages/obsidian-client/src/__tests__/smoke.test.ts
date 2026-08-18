import { VaultClient, SecureStore } from '../vault';
import { createObsidianClient, bootstrapVault } from '../index';

const makeStore = (initial: Record<string, string> = {}): SecureStore => {
  const data: Record<string, string> = { ...initial, finwiz_obsidian_api_key: 'tok' };
  return {
    getItemAsync: async (k) => data[k] ?? null,
    setItemAsync: async (k, v) => { data[k] = v; },
  };
};

const okFetch = (): typeof fetch =>
  jest.fn(async () => new Response('body', { status: 200 })) as unknown as typeof fetch;

describe('VaultClient', () => {
  it('getNote returns response body text', async () => {
    const client = new VaultClient({
      secureStore: makeStore(),
      fetchImpl: okFetch(),
    });
    const text = await client.getNote('00-Profile/goals.md');
    expect(text).toBe('body');
  });

  it('putNote sends PUT with correct URL-encoded path', async () => {
    const mockFetch = jest.fn(async (_url: string, _init?: RequestInit) =>
      new Response(null, { status: 200 }),
    );
    const client = new VaultClient({
      secureStore: makeStore(),
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    await client.putNote('01-Transactions/2025-04.md', 'content');
    const calledUrl = mockFetch.mock.calls[0]![0];
    expect(calledUrl).toContain('01-Transactions%2F2025-04.md');
  });

  it('throws when API key is missing', async () => {
    const emptyStore: SecureStore = {
      getItemAsync: async () => null,
      setItemAsync: async () => { /* noop */ },
    };
    const client = new VaultClient({ secureStore: emptyStore, fetchImpl: okFetch() });
    await expect(client.getNote('test.md')).rejects.toThrow('API key not found');
  });

  it('throws on HTTP error status', async () => {
    const errFetch = jest.fn(
      async () => new Response(null, { status: 404, statusText: 'Not Found' }),
    );
    const client = new VaultClient({
      secureStore: makeStore(),
      fetchImpl: errFetch as unknown as typeof fetch,
    });
    await expect(client.getNote('missing.md')).rejects.toThrow('404');
  });

  it('cert pinning stores fingerprint on first connection', async () => {
    let stored: string | null = null;
    const certVerifier = {
      getServerFingerprint: async () => 'AA:BB:CC',
    };
    const overrideStore: SecureStore = {
      getItemAsync: async (k) => (k === 'finwiz_obsidian_cert_fp' ? stored : 'tok'),
      setItemAsync: async (k, v) => { if (k === 'finwiz_obsidian_cert_fp') stored = v; },
    };
    const client = new VaultClient({
      secureStore: overrideStore,
      certVerifier,
      fetchImpl: okFetch(),
    });
    await client.getNote('test.md');
    expect(stored).toBe('AA:BB:CC');
  });

  it('cert pinning throws when fingerprint changes', async () => {
    const store = makeStore();
    store.setItemAsync('finwiz_obsidian_cert_fp', 'AA:BB:CC');
    const certVerifier = { getServerFingerprint: async () => 'XX:YY:ZZ' };
    const pinnedStore: SecureStore = {
      getItemAsync: async (k) => {
        if (k === 'finwiz_obsidian_cert_fp') return 'AA:BB:CC';
        return 'tok';
      },
      setItemAsync: async () => { /* noop */ },
    };
    const client = new VaultClient({
      secureStore: pinnedStore,
      certVerifier,
      fetchImpl: okFetch(),
    });
    await expect(client.getNote('test.md')).rejects.toThrow('fingerprint mismatch');
  });
});

describe('bootstrapVault', () => {
  it('creates all 7 required placeholder files via the write queue', async () => {
    const written: string[] = [];
    const mockFetch = jest.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
    const client = createObsidianClient({
      secureStore: makeStore(),
      fetchImpl: mockFetch,
    });

    // Track putNote calls
    const origPut = client.putNote.bind(client);
    jest.spyOn(client, 'putNote').mockImplementation(async (path, content) => {
      written.push(path);
      return origPut(path, content);
    });

    await bootstrapVault(client);

    expect(written).toEqual([
      '00-Profile/goals.md',
      '00-Profile/accounts.md',
      '01-Transactions/.keep',
      '02-Insights/.keep',
      '03-Habits/recurring-expenses.md',
      '04-SelfTransfers/pairs.md',
      '99-Agent-Log/.keep',
    ]);
  });
});
