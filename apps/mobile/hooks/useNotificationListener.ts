import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import {
  addNotificationListener,
  drainPendingNotifications,
  startListening,
  stopListening,
  type RawNotificationEvent,
} from '@finwiz/notification-listener-android';
import { createDedupCache } from '@finwiz/notification-parser';
import type { NotificationMode } from '@finwiz/notification-parser';
import { getWatchedPackages, ingestNotification } from '../lib/ingestionPipeline';
import { getSelectedBanks } from '../lib/database';
import { getCaptureMode, type CaptureMode } from '../lib/captureMode';

const NOTIF_MODE_KEY = 'finwiz_notification_mode';

interface ListenerConfig {
  captureMode: CaptureMode;
  mode: NotificationMode;
  packages: string[];
}

async function getListenerConfig(): Promise<ListenerConfig> {
  const captureMode = await getCaptureMode();
  const modeRaw = await SecureStore.getItemAsync(NOTIF_MODE_KEY);
  const mode: NotificationMode =
    modeRaw === 'wallet_only' || modeRaw === 'both' ? modeRaw : 'bank_only';
  const packages = getWatchedPackages(mode, await getSelectedBanks());
  return { captureMode, mode, packages };
}

// Android only — see useNotificationListener.ios.ts for the no-op iOS
// counterpart. The native module this file imports doesn't exist on iOS.
//
// The app owns the watch request: in Automatic mode it asks the native
// service to watch the configured packages (persisted natively, so it keeps
// watching after the app is closed and queues what arrives); in Manual-only
// mode it tells the service to stop. Queued notifications are ingested on
// launch and every time the app returns to the foreground.
export function useNotificationListener(): void {
  const queryClient = useQueryClient();
  const dedupCacheRef = useRef(createDedupCache());

  // Keyed under ['captureMode'] so Settings' invalidation of that key on
  // save also refreshes the bank/wallet selection here, without a restart.
  const { data: config } = useQuery({
    queryKey: ['captureMode', 'listener'],
    queryFn: getListenerConfig,
  });
  const configKey = config ? JSON.stringify(config) : null;

  useEffect(() => {
    // Undefined while the query is still loading — leave the native state
    // untouched until we know for sure.
    if (!config) return;

    if (config.captureMode !== 'automatic') {
      stopListening();
      return;
    }

    const { mode } = config;
    let disposed = false;

    async function ingest(raw: RawNotificationEvent): Promise<boolean> {
      try {
        return await ingestNotification(raw, mode, dedupCacheRef.current);
      } catch (err) {
        console.error('[useNotificationListener] ingest error', err);
        return false;
      }
    }

    function refresh(): void {
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['allowance'] });
    }

    async function drainPending(): Promise<void> {
      const pending = drainPendingNotifications();
      let anyIngested = false;
      // Sequential: the self-transfer matcher depends on earlier inserts.
      for (const raw of pending) {
        if (disposed) return;
        if (await ingest(raw)) anyIngested = true;
      }
      if (anyIngested) refresh();
    }

    startListening(config.packages);

    const sub = addNotificationListener((raw) => {
      void ingest(raw).then((ingested) => {
        if (ingested) refresh();
      });
    });

    drainPending().catch((err) => console.error('[useNotificationListener] drain error', err));

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        dedupCacheRef.current = createDedupCache();
        drainPending().catch((err) => console.error('[useNotificationListener] drain error', err));
      }
    });

    // Unsubscribing only detaches JS — the native watch request stays on so
    // notifications keep being queued while the app is closed.
    return () => {
      disposed = true;
      sub.remove();
      appStateSub.remove();
    };
    // configKey captures every field of config by value, so `config` itself
    // is deliberately not a dependency (its identity changes on refetch).
  }, [queryClient, configKey]);
}
