export interface SecureStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

// Platform-specific: extracts the SHA-256 fingerprint from the server's TLS cert.
// In React Native use react-native-ssl-pinning or a native module.
// In Node.js (dev/tests) inject a mock or use https.Agent.
export interface CertVerifier {
  getServerFingerprint(url: string): Promise<string>;
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface VaultClientConfig {
  secureStore: SecureStore;
  baseUrl?: string;
  apiKeyStoreKey?: string;
  certFingerprintStoreKey?: string;
  // Optional — if omitted, cert pinning is skipped (e.g. unit tests with mocked HTTP).
  certVerifier?: CertVerifier;
  // Injectable for testing; defaults to global fetch.
  fetchImpl?: FetchFn;
}

const DEFAULT_BASE_URL = 'https://localhost:27124';
const DEFAULT_API_KEY_KEY = 'finwiz_obsidian_api_key';
const DEFAULT_CERT_FP_KEY = 'finwiz_obsidian_cert_fp';

export function encodePath(vaultPath: string): string {
  return encodeURIComponent(vaultPath);
}

export class VaultClient {
  private readonly baseUrl: string;
  private readonly secureStore: SecureStore;
  private readonly apiKeyStoreKey: string;
  private readonly certFingerprintStoreKey: string;
  private readonly certVerifier: CertVerifier | undefined;
  private readonly fetchImpl: FetchFn;

  constructor(config: VaultClientConfig) {
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.secureStore = config.secureStore;
    this.apiKeyStoreKey = config.apiKeyStoreKey ?? DEFAULT_API_KEY_KEY;
    this.certFingerprintStoreKey = config.certFingerprintStoreKey ?? DEFAULT_CERT_FP_KEY;
    this.certVerifier = config.certVerifier;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async getNote(path: string): Promise<string> {
    const res = await this.request('GET', `/vault/${encodePath(path)}`);
    return res.text();
  }

  async putNote(path: string, content: string): Promise<void> {
    await this.request('PUT', `/vault/${encodePath(path)}`, content);
  }

  async appendNote(path: string, content: string): Promise<void> {
    await this.request('PATCH', `/vault/${encodePath(path)}`, content);
  }

  async listVault(): Promise<string[]> {
    const res = await this.request('GET', '/vault/');
    const data = (await res.json()) as { files: string[] };
    return data.files;
  }

  async search(query: string): Promise<string[]> {
    const body = JSON.stringify({ query });
    const res = await this.request('POST', '/search/simple/', body, 'application/json');
    const data = (await res.json()) as Array<{ filename: string }>;
    return data.map((r) => r.filename);
  }

  private async getApiKey(): Promise<string> {
    const key = await this.secureStore.getItemAsync(this.apiKeyStoreKey);
    if (!key) throw new Error('Obsidian API key not found in secure store');
    return key;
  }

  private async verifyCert(): Promise<void> {
    if (!this.certVerifier) return;
    const serverFp = await this.certVerifier.getServerFingerprint(this.baseUrl);
    const storedFp = await this.secureStore.getItemAsync(this.certFingerprintStoreKey);
    if (storedFp === null) {
      // First connection: pin the fingerprint.
      await this.secureStore.setItemAsync(this.certFingerprintStoreKey, serverFp);
    } else if (serverFp !== storedFp) {
      throw new Error('TLS certificate fingerprint mismatch — possible MITM attack');
    }
  }

  private async request(
    method: string,
    path: string,
    body?: string,
    contentType?: string,
  ): Promise<Response> {
    await this.verifyCert();
    const apiKey = await this.getApiKey();
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    };
    if (contentType !== undefined) {
      headers['Content-Type'] = contentType;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'text/markdown';
    }

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = body;
    }

    const res = await this.fetchImpl(url, init);
    if (!res.ok) {
      throw new Error(`Obsidian API error: ${res.status} ${res.statusText}`);
    }
    return res;
  }
}
