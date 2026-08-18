import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import {
  markStepComplete,
  getStepsForPlatform,
  getNextStep,
  markOnboardingComplete,
  type OnboardingPlatform,
} from '../../lib/onboarding';

export default function NotificationPermissionScreen() {
  const router = useRouter();
  const [granted, setGranted] = useState<boolean | null>(null);

  function checkPermission() {
    if (Platform.OS !== 'android') {
      setGranted(true);
      return;
    }
    // Lazy-import to avoid loading native module on iOS.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { isPermissionGranted } = require('@finwiz/notification-listener-android') as {
      isPermissionGranted: () => boolean;
    };
    setGranted(isPermissionGranted());
  }

  function openSettings() {
    if (Platform.OS !== 'android') return;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { openPermissionSettings } = require('@finwiz/notification-listener-android') as {
      openPermissionSettings: () => void;
    };
    openPermissionSettings();
  }

  async function advance() {
    await markStepComplete('notification-permission');
    const platform: OnboardingPlatform = 'android';
    const steps = getStepsForPlatform(platform);
    const next = getNextStep('notification-permission', steps);
    if (next === null) {
      await markOnboardingComplete();
      router.replace('/(tabs)');
    } else {
      router.push(`/onboarding/${next}`);
    }
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 80, paddingBottom: 24, paddingHorizontal: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-3xl font-bold text-gray-900 mb-3">Notification Access</Text>
        <Text className="text-base text-gray-500 mb-8 leading-relaxed">
          FinWiz reads banking app notifications to automatically record transactions. This permission
          is required for automatic tracking on Android.
        </Text>

        <View className="bg-amber-50 rounded-2xl p-5 mb-7">
          <Text className="text-sm font-semibold text-amber-800 mb-2">Privacy note</Text>
          <Text className="text-sm text-amber-700 leading-relaxed">
            FinWiz only processes notifications from your selected bank apps. Raw notification
            content is discarded immediately after parsing — only the transaction amount and type
            are stored.
          </Text>
        </View>

        <View className="bg-gray-50 rounded-2xl p-5 mb-7">
          {[
            'Tap "Open Settings" below',
            'Find FinWiz in the list',
            'Toggle "Allow notification access" on',
            'Return here and tap "Check permission"',
          ].map((step, i) => (
            <View key={i} className="flex-row mb-3 last:mb-0">
              <View className="w-5 h-5 rounded-full bg-purple-100 items-center justify-center mr-3 mt-0.5">
                <Text className="text-xs font-bold text-purple-600">{i + 1}</Text>
              </View>
              <Text className="text-sm text-gray-600 flex-1 leading-relaxed">{step}</Text>
            </View>
          ))}
        </View>

        {granted === true && (
          <View className="p-4 bg-green-50 rounded-2xl mb-4">
            <Text className="text-sm font-semibold text-green-700">Permission granted</Text>
          </View>
        )}
        {granted === false && (
          <View className="p-4 bg-red-50 rounded-2xl mb-4">
            <Text className="text-sm font-semibold text-red-700">Not granted yet</Text>
            <Text className="text-xs text-red-400 mt-1">
              Open Settings and enable notification access for FinWiz.
            </Text>
          </View>
        )}
      </ScrollView>

      <View className="px-7 pb-14 pt-4 gap-3">
        <TouchableOpacity
          onPress={openSettings}
          className="bg-purple-600 py-4 rounded-2xl items-center"
          activeOpacity={0.85}
        >
          <Text className="text-white font-semibold text-base">Open Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={checkPermission}
          className="py-4 rounded-2xl items-center border-2 border-purple-200"
          activeOpacity={0.85}
        >
          <Text className="text-purple-600 font-semibold text-base">Check permission</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { void advance(); }}
          className="py-3 items-center"
        >
          <Text className="text-gray-400 font-medium text-sm">
            {granted ? 'Continue' : 'Skip — enable later'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
