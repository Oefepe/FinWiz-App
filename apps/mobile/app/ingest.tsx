import { useEffect } from 'react';
import { View, Text, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { ingestIosNotification, HMAC_SECRET_KEY } from '../lib/iosIngest';
import { getCaptureMode } from '../lib/captureMode';
import { useInvalidateAllowance } from '../hooks/useAllowance';

export default function IngestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    bank?: string;
    title?: string;
    body?: string;
    ts?: string;
    hmac?: string;
  }>();
  const invalidate = useInvalidateAllowance();

  useEffect(() => {
    void (async () => {
      const storedSecret = await SecureStore.getItemAsync(HMAC_SECRET_KEY);

      if (storedSecret !== null) {
        const captureMode = await getCaptureMode();
        const result = await ingestIosNotification({
          bank: params.bank ?? null,
          title: params.title ?? null,
          body: params.body ?? null,
          ts: params.ts ?? null,
          hmac: params.hmac ?? null,
          storedSecret,
          captureMode,
        });

        if (result === 'ok') {
          void invalidate();
        } else if (result === 'manual_only') {
          Alert.alert(
            'Automated capture is paused',
            'Turn on Automatic in Settings > Transaction Capture, or add this transaction manually.',
          );
        }
      }

      router.back();
    })();
  }, [params.bank, params.title, params.body, params.ts, params.hmac, router, invalidate]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-sm text-gray-400">Processing…</Text>
    </View>
  );
}
