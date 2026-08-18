import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, AppState, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  markStepComplete,
  getStepsForPlatform,
  getNextStep,
  markOnboardingComplete,
  type OnboardingPlatform,
} from '../../lib/onboarding';
import { getDeviceSecurityLevel, hasNoDeviceLock, type SecurityLevel } from '../../lib/appLock';

export default function AppLockSetupScreen() {
  const router = useRouter();
  const [level, setLevel] = useState<SecurityLevel | null>(null);
  const [checking, setChecking] = useState(true);

  const check = useCallback(async () => {
    setChecking(true);
    setLevel(await getDeviceSecurityLevel());
    setChecking(false);
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  // Re-check whenever the user comes back from the OS Settings app (they
  // may have just enrolled a PIN/pattern/biometric) and whenever this
  // screen regains focus within the onboarding stack.
  useFocusEffect(
    useCallback(() => {
      void check();
    }, [check]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => { sub.remove(); };
  }, [check]);

  async function advance() {
    await markStepComplete('app-lock-setup');
    const platform: OnboardingPlatform =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other';
    const steps = getStepsForPlatform(platform);
    const next = getNextStep('app-lock-setup', steps);
    if (next === null) {
      await markOnboardingComplete();
      router.replace('/(tabs)');
    } else {
      router.push(`/onboarding/${next}`);
    }
  }

  const blocked = level !== null && hasNoDeviceLock(level);

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 80, paddingBottom: 24, paddingHorizontal: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-3xl font-bold text-gray-900 mb-3">App Lock</Text>
        <Text className="text-base text-gray-500 mb-8 leading-relaxed">
          FinWiz doesn't ask you to create a separate password. Instead, it uses your phone's own
          screen lock — Face ID, Touch ID, fingerprint, or your PIN/pattern/passcode, whichever
          you already have set up.
        </Text>

        {checking && (
          <View className="items-center py-10">
            <ActivityIndicator color="#9747FF" />
          </View>
        )}

        {!checking && blocked && (
          <View className="bg-red-50 rounded-2xl p-5 mb-6">
            <Text className="text-sm font-semibold text-red-700 mb-2">
              No lock screen is set up on this device
            </Text>
            <Text className="text-xs text-red-600 leading-relaxed mb-4">
              FinWiz can't protect your financial data without a device lock screen. Set up a PIN,
              pattern, passcode, or biometric unlock in your phone's Settings, then come back here.
            </Text>
            <TouchableOpacity
              onPress={() => { void Linking.openSettings(); }}
              className="bg-red-600 py-3 rounded-xl items-center"
              activeOpacity={0.85}
            >
              <Text className="text-white font-semibold text-sm">Open Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        {!checking && !blocked && (
          <View className="bg-emerald-50 rounded-2xl p-5 mb-6">
            <Text className="text-sm font-semibold text-emerald-700 mb-1">Lock screen detected</Text>
            <Text className="text-xs text-emerald-600 leading-relaxed">
              FinWiz will ask you to unlock with it whenever you open the app.
            </Text>
          </View>
        )}

        {/* M17-T6 — explain the one residual data-loss path up front, per this
            milestone's explicit requirement, rather than let it be a surprise later. */}
        <View className="bg-gray-50 rounded-2xl p-5">
          <Text className="text-sm font-semibold text-gray-700 mb-2">One thing to know</Text>
          <Text className="text-xs text-gray-500 leading-relaxed">
            If you ever remove your phone's lock screen entirely, FinWiz will ask you to set one up
            again before you can get back in — the same requirement as right now. This only happens
            if you deliberately turn off your device's own lock screen; it's not something you can
            forget the way a separate app password could be.
          </Text>
        </View>
      </ScrollView>

      <View className="px-7 pb-14 pt-4">
        <TouchableOpacity
          onPress={() => { void advance(); }}
          disabled={checking || blocked}
          className={`py-4 rounded-2xl items-center ${
            checking || blocked ? 'bg-purple-300' : 'bg-purple-600'
          }`}
          activeOpacity={0.85}
        >
          <Text className="text-white font-semibold text-base">Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
