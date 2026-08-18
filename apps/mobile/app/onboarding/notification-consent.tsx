import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  markStepComplete,
  getStepsForPlatform,
  getNextStep,
  markOnboardingComplete,
  type OnboardingPlatform,
} from '../../lib/onboarding';
import { SUPPORTED_BANKS } from '../../lib/banks';

// M19-T2 — a dedicated, explicit disclosure screen shown immediately before
// the Android Notification Access permission request (notification-permission.tsx,
// the next step). This doesn't replace that screen's own "how to enable" copy —
// it exists because Android's notification-listener permission is a single
// system-wide grant with no narrower option: once enabled, FinWiz's process
// technically receives every notification posted on the device, from every
// app. What actually protects the user is FinWiz's own code discarding
// anything that isn't from a recognized bank/wallet app — and Play/App Store
// financial-app policy requires that distinction be disclosed prominently and
// explicitly, with affirmative consent, before the OS permission prompt, not
// buried inside the "how to enable" instructions.
export default function NotificationConsentScreen() {
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(false);

  async function advance() {
    await markStepComplete('notification-consent');
    const platform: OnboardingPlatform = 'android'; // this step is Android-only
    const steps = getStepsForPlatform(platform);
    const next = getNextStep('notification-consent', steps);
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
        <Text className="text-3xl font-bold text-gray-900 mb-3">Before you continue</Text>
        <Text className="text-base text-gray-500 mb-8 leading-relaxed">
          The next step asks Android for Notification Access. Android only offers one, system-wide
          version of this permission — there's no way to grant it for just your banking apps.
          Here's exactly what FinWiz does with it.
        </Text>

        <View className="bg-amber-50 rounded-2xl p-5 mb-6">
          <Text className="text-sm font-semibold text-amber-800 mb-2">
            What the permission technically allows
          </Text>
          <Text className="text-sm text-amber-700 leading-relaxed">
            Once granted, FinWiz's app process receives every notification posted on your phone,
            from every app — not just banks. This is an Android platform limitation, not a FinWiz
            design choice.
          </Text>
        </View>

        <View className="bg-emerald-50 rounded-2xl p-5 mb-6">
          <Text className="text-sm font-semibold text-emerald-800 mb-2">
            What FinWiz actually does with it
          </Text>
          <Text className="text-sm text-emerald-700 leading-relaxed mb-3">
            FinWiz's own code checks every notification's source app the instant it arrives. Only
            notifications from these apps are read any further:
          </Text>
          {SUPPORTED_BANKS.map((bank) => (
            <View key={bank.pkg} className="flex-row items-center mb-1.5">
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2.5" />
              <Text className="text-sm text-emerald-700">{bank.label}</Text>
            </View>
          ))}
          <Text className="text-xs text-emerald-600 leading-relaxed mt-3">
            (Plus mobile wallet apps — Google Pay, Samsung Pay, Garmin Pay — only if you turn on
            Wallet notifications later in Settings; off by default.)
          </Text>
          <Text className="text-sm text-emerald-700 leading-relaxed mt-3">
            Every other notification — messages, social apps, other financial apps you use, anything
            not on this list — is discarded immediately by FinWiz and never read, stored, or acted
            on in any way.
          </Text>
        </View>

        <View className="bg-gray-50 rounded-2xl p-5 mb-8">
          <Text className="text-sm font-semibold text-gray-700 mb-2">
            What's stored from a recognized notification
          </Text>
          <Text className="text-sm text-gray-600 leading-relaxed">
            Only the parsed transaction amount and type. The raw notification text itself is
            discarded immediately after parsing — it's never saved to the database, the vault, or
            anywhere else.
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => { setAcknowledged((v) => !v); }}
          className="flex-row items-start mb-4"
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acknowledged }}
        >
          <View
            className={`w-5 h-5 rounded items-center justify-center mr-3 mt-0.5 ${
              acknowledged ? 'bg-purple-600' : 'bg-white border-2 border-gray-300'
            }`}
          >
            {acknowledged && <Text className="text-white text-xs font-bold">✓</Text>}
          </View>
          <Text className="text-sm text-gray-600 flex-1 leading-relaxed">
            I understand Android grants FinWiz access to all my notifications, and that FinWiz only
            reads and stores data from the apps listed above.
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View className="px-7 pb-14 pt-4">
        <TouchableOpacity
          onPress={() => { void advance(); }}
          disabled={!acknowledged}
          className={`py-4 rounded-2xl items-center ${acknowledged ? 'bg-purple-600' : 'bg-purple-300'}`}
          activeOpacity={0.85}
        >
          <Text className="text-white font-semibold text-base">Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
