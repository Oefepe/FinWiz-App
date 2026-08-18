import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Text, View, type AppStateStatus } from 'react-native';
import * as Linking from 'expo-linking';
import {
  authenticateDevice,
  getAppLockTimeout,
  getDeviceSecurityLevel,
  hasNoDeviceLock,
  APP_LOCK_TIMEOUT_MS,
} from '../lib/appLock';
import { Button } from './Button';
import { PrivacyCoverScreen } from './PrivacyCoverScreen';
import { tokens } from '../theme/tokens';
import { typography } from '../theme/typography';

// M17-T4 — gates the whole app behind a live device authentication
// challenge on cold start and on foreground-resume after the configured
// timeout (M17-T5). Wraps the entire route tree in app/_layout.tsx (inside
// QueryClientProvider, outside the Stack) — the Stack, including the
// `ingest` deep-link route, simply never mounts while locked, so a deep
// link can't silently ingest or display data before unlock.
//
// A no-op while onboarding is still in progress: app-lock-setup.tsx is
// itself an onboarding step, so gating the app before that step exists
// would be a chicken-and-egg deadlock.

function NoDeviceLockScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text
        style={{
          color: tokens.alert,
          textAlign: 'center',
          marginBottom: 8,
          fontFamily: typography.headingBold.fontFamily,
          fontSize: typography.headingBold.fontSize,
          lineHeight: typography.headingBold.lineHeight,
        }}
      >
        Lock screen removed
      </Text>
      <Text
        style={{
          color: tokens.textMutedB,
          textAlign: 'center',
          marginBottom: 24,
          fontFamily: typography.body.fontFamily,
          fontSize: typography.body.fontSize,
          lineHeight: typography.body.lineHeight,
        }}
      >
        Your device no longer has a PIN, pattern, passcode, or biometric lock set up. Set one up
        again in Settings, then come back — your data is still here and unaffected.
      </Text>
      <View style={{ width: '100%', gap: 12 }}>
        <Button label="Open Settings" onPress={() => { void Linking.openSettings(); }} />
        <Button label="I've set it up" variant="contrast" onPress={onRetry} />
      </View>
    </View>
  );
}

function LockedScreen({ authenticating, onRetry }: { authenticating: boolean; onRetry: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text
        style={{
          color: tokens.textPrimary,
          textAlign: 'center',
          marginBottom: 24,
          fontFamily: typography.displayTitle.fontFamily,
          fontSize: typography.displayTitle.fontSize,
          lineHeight: typography.displayTitle.lineHeight,
        }}
      >
        FinWiz is locked
      </Text>
      {authenticating ? (
        <ActivityIndicator color={tokens.primary} />
      ) : (
        <View style={{ width: '100%' }}>
          <Button label="Unlock" onPress={onRetry} />
        </View>
      )}
    </View>
  );
}

export interface AppLockGateProps {
  children: ReactNode;
  // Shared with app/_layout.tsx's own onboarding check rather than this
  // component re-deriving it independently — two redundant async
  // SecureStore reads racing against the Stack's own mount timing was a
  // real bug risk (a locked-until-resolved gate could delay
  // router.replace()'s onboarding redirect if it resolved after the
  // redirect fired). `null` means "not yet determined" and always renders
  // children so the Stack mounts immediately regardless.
  onboardingComplete: boolean | null;
}

export function AppLockGate({ children, onboardingComplete }: AppLockGateProps) {
  const [locked, setLocked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  // M18-T7 — true for the entire span AppState isn't 'active' ('inactive'
  // covers the brief instant iOS takes its app-switcher snapshot, before
  // 'background' fires). Tracked unconditionally, unlike backgroundedAt
  // below, so the privacy cover also applies during onboarding (e.g.
  // financial-setup.tsx's salary/expenses fields), not just post-onboarding.
  const [backgrounded, setBackgrounded] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  const attemptUnlock = useCallback(async () => {
    setAuthenticating(true);
    try {
      const level = await getDeviceSecurityLevel();
      if (hasNoDeviceLock(level)) {
        setLocked(true);
        setUnlocked(false);
        return;
      }
      setLocked(false);
      setUnlocked(await authenticateDevice());
    } finally {
      setAuthenticating(false);
    }
  }, []);

  // Fires once, the moment onboarding is confirmed complete (either
  // already-true on a returning user's cold start, or the instant it
  // flips true right after the app-lock-setup onboarding step finishes).
  useEffect(() => {
    if (onboardingComplete === true) {
      void attemptUnlock();
    }
  }, [onboardingComplete, attemptUnlock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      setBackgrounded(state !== 'active');

      if (onboardingComplete !== true) return;

      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current = Date.now();
        return;
      }

      if (state === 'active' && backgroundedAt.current !== null) {
        const bgAt = backgroundedAt.current;
        backgroundedAt.current = null;
        void (async () => {
          const timeout = await getAppLockTimeout();
          if (Date.now() - bgAt >= APP_LOCK_TIMEOUT_MS[timeout]) {
            setUnlocked(false);
            await attemptUnlock();
          }
        })();
      }
    });
    return () => { sub.remove(); };
  }, [onboardingComplete, attemptUnlock]);

  // M18-T7 — takes priority over every other branch below, including
  // "not yet onboarded": whatever screen was visible must never be what
  // the OS snapshots for the app switcher, regardless of lock/onboarding
  // state.
  if (backgrounded) {
    return <PrivacyCoverScreen />;
  }

  // Onboarding not yet confirmed complete (still `null`, or genuinely
  // `false`) — onboarding (including this milestone's own app-lock-setup
  // step) handles its own flow, and the Stack must mount immediately
  // either way for app/_layout.tsx's redirect effect to work.
  if (onboardingComplete !== true) {
    return <>{children}</>;
  }

  if (locked) {
    return <NoDeviceLockScreen onRetry={() => { void attemptUnlock(); }} />;
  }

  if (!unlocked) {
    return <LockedScreen authenticating={authenticating} onRetry={() => { void attemptUnlock(); }} />;
  }

  return <>{children}</>;
}

export default AppLockGate;
