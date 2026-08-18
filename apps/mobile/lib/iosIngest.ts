import * as SecureStore from 'expo-secure-store';
import { parseNotification } from '@finwiz/notification-parser';
import { runPipeline } from './ingestionPipeline';
import type { CaptureMode } from './captureMode';

export const HMAC_SECRET_KEY = 'finwiz_hmac_secret';

// ---------------------------------------------------------------------------
// Constant-time comparison
// ---------------------------------------------------------------------------

// Compares two strings without early exit on the first differing character.
// XOR accumulation ensures every character pair is always evaluated, so
// timing cannot reveal which character caused a mismatch.
// Never use === for secret comparison — this replaces it.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// HMAC secret lifecycle
// ---------------------------------------------------------------------------

// Returns the stored HMAC secret, generating and persisting a new one on
// first call. Uses crypto.getRandomValues (Hermes CSPRNG) for the secret.
export async function getOrCreateHmacSecret(): Promise<string> {
  const stored = await SecureStore.getItemAsync(HMAC_SECRET_KEY);
  if (stored !== null) return stored;

  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(HMAC_SECRET_KEY, secret);
  return secret;
}

// ---------------------------------------------------------------------------
// Idempotency guard
// ---------------------------------------------------------------------------

// Prevents the same Shortcut trigger from ingesting a duplicate transaction
// when iOS fires the automation more than once for a single notification.
// Keys are `bank:ts`; entries expire after 60 s.
const _seenKeys = new Map<string, number>();

export function isDuplicateIngestion(bank: string, ts: string): boolean {
  const now = Date.now();
  for (const [k, t] of _seenKeys) {
    if (now - t > 60_000) _seenKeys.delete(k);
  }
  const key = `${bank}:${ts}`;
  if (_seenKeys.has(key)) return true;
  _seenKeys.set(key, now);
  return false;
}

// Exposed for test teardown only — not for production use.
export function _clearIdempotencyCache(): void {
  _seenKeys.clear();
}

// ---------------------------------------------------------------------------
// iOS ingest entry point
// ---------------------------------------------------------------------------

export type IngestResult =
  | 'ok'
  | 'invalid_hmac'
  | 'duplicate'
  | 'parse_error'
  | 'missing_params'
  | 'manual_only';

export async function ingestIosNotification(params: {
  bank: string | null;
  title: string | null;
  body: string | null;
  ts: string | null;
  hmac: string | null;
  storedSecret: string;
  captureMode: CaptureMode;
}): Promise<IngestResult> {
  const { bank, title, body, ts, hmac, storedSecret, captureMode } = params;

  if (bank === null || title === null || body === null || ts === null || hmac === null) {
    return 'missing_params';
  }

  // Constant-time comparison — never use === here.
  if (!timingSafeEqual(hmac, storedSecret)) return 'invalid_hmac';

  // User has paused automated capture — Shortcuts automations still fire and
  // call this deep link, but we must not silently insert a transaction.
  if (captureMode === 'manual_only') return 'manual_only';

  if (isDuplicateIngestion(bank, ts)) return 'duplicate';

  const timestamp = parseInt(ts, 10);
  if (isNaN(timestamp)) return 'parse_error';

  const tx = parseNotification({ appPackage: bank, title, body, timestamp });
  if (tx === null) return 'parse_error';

  await runPipeline(tx);
  return 'ok';
}
