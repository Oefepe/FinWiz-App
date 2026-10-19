import '../global.css';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  OpenSans_400Regular,
  OpenSans_600SemiBold,
  OpenSans_700Bold,
} from '@expo-google-fonts/open-sans';
import * as SplashScreen from 'expo-splash-screen';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { initDatabase } from '../lib/database';
import { configureNotificationChannels } from '../lib/notifications';
import { useNotificationListener } from '../hooks/useNotificationListener';
import { AppLockGate } from '../components/AppLockGate';
import {
  checkOnboardingComplete,
  getCompletedSteps,
  getResumeStep,
  getStepsForPlatform,
  type OnboardingPlatform,
} from '../lib/onboarding';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// Android: starts the native NotificationListenerService bridge, gated by
// the Transaction Capture setting. iOS: no-op — see the .ios.ts variant.
// Rendered as a child of QueryClientProvider below (not called directly in
// RootLayout) because the hook needs useQueryClient() in scope.
function NotificationListenerBridge() {
  useNotificationListener();
  return null;
}

export default function RootLayout() {
  const router = useRouter();
  // M18-T7 — Android: sets FLAG_SECURE for the app's whole lifetime (blocks
  // screenshots and screen recording outright, including in the recents
  // list thumbnail). iOS: blocks both screenshots and recordings on 13+ per
  // the library's own docs — unverified on a real device this session, see
  // the M18 plan notes. Held for the entire component lifetime (mounted
  // once, never unmounted while the app runs), unlike a per-screen call —
  // every screen shows financial data by this app's nature, so there's no
  // screen it should ever be off for.
  usePreventScreenCapture();
  const [fontsLoaded, fontError] = useFonts({
    OpenSans_400Regular,
    OpenSans_600SemiBold,
    OpenSans_700Bold,
  });
  // Single source of truth for onboarding status, shared with AppLockGate
  // (M17) below via a prop rather than each doing its own independent
  // SecureStore read — two redundant checks racing against the Stack's own
  // mount timing was a real bug risk, not just duplication.
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    void (async () => {
      await initDatabase().catch((err: unknown) => {
        console.error('[FinWiz] Database init failed:', err);
      });
      await configureNotificationChannels().catch((err: unknown) => {
        console.error('[FinWiz] Notification setup failed:', err);
      });

      const complete = await checkOnboardingComplete();
      setOnboardingComplete(complete);
      if (!complete) {
        const platform: OnboardingPlatform =
          Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other';
        const steps = getStepsForPlatform(platform);
        const completed = await getCompletedSteps();
        const resumeStep = getResumeStep(completed, steps);
        router.replace(`/onboarding/${resumeStep}`);
      }
    })();
  }, [router]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NotificationListenerBridge />
      {/* M17 — gates every route below, including the `ingest` deep-link
          handler, behind a live device authentication challenge. A locked
          app must not silently ingest or display data via a deep link
          before unlock (M18-T10) — wrapping the whole Stack, rather than
          gating individual screens, is what guarantees that: the Stack
          (and therefore `ingest.tsx`) simply doesn't mount while locked. */}
      <AppLockGate onboardingComplete={onboardingComplete}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="ingest" options={{ headerShown: false }} />
          <Stack.Screen name="transactions" options={{ title: 'Transactions', headerBackTitle: 'Back' }} />
          <Stack.Screen name="transaction-edit" options={{ headerShown: false }} />
          {__DEV__ && <Stack.Screen name="dev-components" options={{ headerShown: false }} />}
        </Stack>
      </AppLockGate>
    </QueryClientProvider>
  );
}
