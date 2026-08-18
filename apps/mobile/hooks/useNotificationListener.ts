import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import {
  addNotificationListener,
  setAllowedPackages,
  type NotificationSubscription,
} from '@finwiz/notification-listener-android';
import { createDedupCache } from '@finwiz/notification-parser';
import type { NotificationMode } from '@finwiz/notification-parser';
import { ingestNotification } from '../lib/ingestionPipeline';
import { getSelectedBanks } from '../lib/database';
import { getCaptureMode } from '../lib/captureMode';

const NOTIF_MODE_KEY = 'finwiz_notification_mode';

// Android only — see useNotificationListener.ios.ts for the no-op iOS
// counterpart. The native module this file imports doesn't exist on iOS.
export function useNotificationListener(): void {
  const queryClient = useQueryClient();
  const dedupCacheRef = useRef(createDedupCache());

  // Re-read whenever Settings saves a new value (settings.tsx invalidates
  // this query key), so flipping the toggle takes effect without an app
  // restart.
  const { data: captureMode } = useQuery({
    queryKey: ['captureMode'],
    queryFn: getCaptureMode,
  });

  useEffect(() => {
    // Undefined while the query is still loading — stay paused until we know
    // for sure, rather than starting the listener optimistically.
    if (captureMode !== 'automatic') return;

    let sub: NotificationSubscription | null = null;

    async function start(): Promise<void> {
      const modeRaw = await SecureStore.getItemAsync(NOTIF_MODE_KEY);
      const mode: NotificationMode =
        modeRaw === 'wallet_only' || modeRaw === 'both' ? modeRaw : 'bank_only';

      const selectedPackages = await getSelectedBanks();
      if (selectedPackages.length > 0) {
        setAllowedPackages(selectedPackages);
      }

      sub = addNotificationListener(async (raw) => {
        try {
          const ingested = await ingestNotification(raw, mode, dedupCacheRef.current);
          if (ingested) {
            void queryClient.invalidateQueries({ queryKey: ['transactions'] });
            void queryClient.invalidateQueries({ queryKey: ['allowance'] });
          }
        } catch (err) {
          console.error('[useNotificationListener] ingest error', err);
        }
      });
    }

    start().catch((err) => console.error('[useNotificationListener] start error', err));

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        dedupCacheRef.current = createDedupCache();
      }
    });

    return () => {
      sub?.remove();
      appStateSub.remove();
    };
  }, [queryClient, captureMode]);
}
