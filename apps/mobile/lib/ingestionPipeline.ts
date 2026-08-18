import {
  parseNotification,
  type NotificationMode,
  type DedupCache,
  type Transaction,
} from '@finwiz/notification-parser';
import type { TransactionTableRow } from '@finwiz/obsidian-client';
import type { RawNotificationEvent } from '@finwiz/notification-listener-android';
import {
  checkNewTransaction,
  createPendingPair,
  type DetectorState,
  type SelfTransferPair,
} from '@finwiz/self-transfer-detector';
import { createObsidianClient } from '@finwiz/obsidian-client';
import * as SecureStore from 'expo-secure-store';
import {
  insertTransaction,
  getPendingPairsForDetector,
  getConfirmedPairBanks,
  savePendingPair,
  deletePendingPair,
  saveConfirmedPair,
  updateTransactionSelfTransfer,
  pruneExpiredPairs,
} from './database';

// ---------------------------------------------------------------------------
// Package allow-lists — must mirror the parsers' canParse conditions.
// ---------------------------------------------------------------------------

export const BANK_PACKAGES = new Set([
  'com.nu.production',              // Nubank
  'br.com.intermedium',             // Inter
  'com.itau',                       // Itaú
  'com.bradesco',                   // Bradesco
  'com.c6bank.app',                 // C6
  'br.com.santander.benvisavale',   // Santander
]);

export const WALLET_PACKAGES = new Set([
  'com.google.android.apps.walletnfcrel',   // Google Pay
  'com.google.android.apps.nbu.paisa.user', // Google Pay (alt)
  'com.samsung.android.spay',               // Samsung Pay
  'com.garmin.android.apps.connectmobile',  // Garmin Pay
]);

// SecureStore key written by self-transfer-hint onboarding step.
export const OWNER_NAME_KEY = 'finwiz_owner_name';

const OBSIDIAN_API_KEY = 'finwiz_obsidian_api_key';
const OBSIDIAN_URL_KEY = 'finwiz_obsidian_url';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isKnownPackage(appPackage: string, mode: NotificationMode): boolean {
  if (mode === 'bank_only') return BANK_PACKAGES.has(appPackage);
  if (mode === 'wallet_only') return WALLET_PACKAGES.has(appPackage);
  return BANK_PACKAGES.has(appPackage) || WALLET_PACKAGES.has(appPackage);
}

export function transactionToRow(
  tx: Transaction,
): TransactionTableRow & { id: string } {
  const d = tx.timestamp;
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return {
    id: tx.id,
    date,
    time,
    type: tx.type,
    amount: tx.amount,
    description: tx.description,
    source_bank: tx.bank,
    category: '',
    self_transfer_id: tx.selfTransferId,
  };
}

// ---------------------------------------------------------------------------
// Vault helper — append a confirmed pair row to 04-SelfTransfers/pairs.md.
// Best-effort: silently swallows errors when vault is not configured.
// ---------------------------------------------------------------------------

async function appendPairToVault(pair: SelfTransferPair): Promise<void> {
  try {
    const apiKey = await SecureStore.getItemAsync(OBSIDIAN_API_KEY);
    if (apiKey === null) return;
    const baseUrl =
      (await SecureStore.getItemAsync(OBSIDIAN_URL_KEY)) ?? 'https://localhost:27124';
    const client = createObsidianClient({ secureStore: SecureStore, baseUrl });
    const detectedAt = pair.detectedAt.toISOString().replace('T', ' ').slice(0, 19);
    const row =
      `| ${pair.id} | ${detectedAt} | ${pair.outTxId} | ${pair.inTxId} | ` +
      `${pair.amount.toFixed(2)} | ${pair.outBank} | ${pair.inBank} | ` +
      `${pair.confidence.toFixed(2)} | ${pair.status} |\n`;
    await client.appendNote('04-SelfTransfers/pairs.md', row);
  } catch {
    // Vault unavailable — pair recorded in SQLite only.
  }
}

// ---------------------------------------------------------------------------
// Core pipeline — shared by Android and iOS ingestion paths.
// ---------------------------------------------------------------------------

export async function runPipeline(tx: Transaction): Promise<void> {
  // Read owner name for self-transfer keyword bonus.
  const ownerNameRaw = await SecureStore.getItemAsync(OWNER_NAME_KEY);
  const ownerName = ownerNameRaw ?? undefined;

  // Load current detector state from SQLite.
  const pending = await getPendingPairsForDetector();
  const confirmedBanks = await getConfirmedPairBanks();
  // Reconstruct minimal SelfTransferPair objects for confidence scoring.
  const confirmedHistory = confirmedBanks.map((b) => ({
    id: '',
    detectedAt: new Date(0),
    outTxId: '',
    inTxId: '',
    amount: 0,
    outBank: b.outBank,
    inBank: b.inBank,
    confidence: 1.0,
    status: 'confirmed' as const,
  }));

  const candidate = {
    txId: tx.id,
    amount: tx.amount,
    bank: tx.bank,
    timestamp: tx.timestamp.getTime(),
    description: tx.description,
  };

  const state: DetectorState = { pending, confirmed: confirmedHistory };
  const { result } = checkNewTransaction(candidate, state, ownerName);

  if (result !== null && result.action === 'auto_confirm') {
    // Match found with high confidence — pair both legs as self-transfers.
    const isNewOut = tx.amount <= 0;
    const newTxType = isNewOut ? 'SELF_TRANSFER_OUT' : 'SELF_TRANSFER_IN';
    const matchedTxType = isNewOut ? 'SELF_TRANSFER_IN' : 'SELF_TRANSFER_OUT';
    const matchedTxId = isNewOut ? result.pair.inTxId : result.pair.outTxId;

    const row = transactionToRow(tx);
    await insertTransaction({ ...row, type: newTxType, self_transfer_id: result.pair.id });
    await updateTransactionSelfTransfer(matchedTxId, matchedTxType, result.pair.id);
    await deletePendingPair(matchedTxId);
    await saveConfirmedPair(result.pair);
    await appendPairToVault(result.pair);
  } else {
    // No match or low-confidence match — insert as base type, add to pending buffer.
    // (escalate_to_ai is deferred until M6-T2 LLM integration; treat as no-match to
    // avoid false positive self-transfer exclusion.)
    await insertTransaction(transactionToRow(tx));
    const direction: 'out' | 'in' = tx.amount <= 0 ? 'out' : 'in';
    await savePendingPair(createPendingPair(candidate, direction));
  }

  await pruneExpiredPairs();
}

// ---------------------------------------------------------------------------
// Android entry point
// ---------------------------------------------------------------------------

/**
 * Processes one raw notification event from the native bridge.
 * @returns true if a new transaction was persisted, false if filtered/deduped.
 */
export async function ingestNotification(
  raw: RawNotificationEvent,
  mode: NotificationMode,
  dedupCache: DedupCache,
): Promise<boolean> {
  if (!isKnownPackage(raw.appPackage, mode)) return false;

  const tx = parseNotification(
    {
      appPackage: raw.appPackage,
      title: raw.title,
      body: raw.body,
      timestamp: raw.timestamp,
    },
    { mode, dedupCache },
  );

  if (tx === null) return false;

  await runPipeline(tx);
  return true;
}
