import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Linking, Alert } from 'react-native';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { getOrCreateHmacSecret } from '../../lib/iosIngest';
import { requiresManualConfirmation } from '../../lib/iosVersion';
import {
  markStepComplete,
  getStepsForPlatform,
  getNextStep,
  markOnboardingComplete,
  type OnboardingPlatform,
} from '../../lib/onboarding';

const BANKS = [
  { name: 'Nubank', filename: 'Nubank.shortcut' },
  { name: 'Inter', filename: 'Inter.shortcut' },
  { name: 'Itaú', filename: 'Itau.shortcut' },
  { name: 'Bradesco', filename: 'Bradesco.shortcut' },
  { name: 'C6 Bank', filename: 'C6Bank.shortcut' },
  { name: 'Santander', filename: 'Santander.shortcut' },
];

export default function ShortcutsSetupScreen() {
  const router = useRouter();
  const [hmacKey, setHmacKey] = useState('');
  const [copied, setCopied] = useState(false);
  const needsManualConfirm = Platform.OS === 'ios' && requiresManualConfirmation();

  useEffect(() => {
    void (async () => {
      const key = await getOrCreateHmacSecret();
      setHmacKey(key);
    })();
  }, []);

  function handleCopyKey() {
    // Clipboard is not available without expo-clipboard; show via Alert as fallback.
    Alert.alert('HMAC Key', hmacKey, [{ text: 'Done' }]);
    setCopied(true);
  }

  function openShortcutsApp() {
    void Linking.openURL('shortcuts://');
  }

  async function advance() {
    await markStepComplete('shortcuts-setup');
    const platform: OnboardingPlatform = 'ios';
    const steps = getStepsForPlatform(platform);
    const next = getNextStep('shortcuts-setup', steps);
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
        <Text className="text-3xl font-bold text-gray-900 mb-3">iOS Shortcuts</Text>
        <Text className="text-base text-gray-500 mb-6 leading-relaxed">
          On iOS, FinWiz uses Apple Shortcuts to capture banking notifications. Set up one
          shortcut per bank — each shortcut runs automatically when a notification arrives.
        </Text>

        {/* iOS < 16.4 warning */}
        {needsManualConfirm && (
          <View className="bg-amber-50 rounded-2xl p-5 mb-6">
            <Text className="text-sm font-semibold text-amber-800 mb-1">
              iOS {String(Platform.Version)} — manual confirmation required
            </Text>
            <Text className="text-sm text-amber-700 leading-relaxed">
              Automation shortcuts require a manual tap to run on iOS below 16.4. Upgrade to iOS
              16.4+ for fully automatic capture.
            </Text>
          </View>
        )}

        {/* HMAC Key */}
        <View className="bg-gray-50 rounded-2xl p-5 mb-7">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Your HMAC Security Key
          </Text>
          <Text
            className="text-xs text-gray-700 font-mono leading-relaxed mb-4"
            selectable
          >
            {hmacKey !== '' ? hmacKey : '…'}
          </Text>
          <TouchableOpacity
            onPress={handleCopyKey}
            className={`py-2.5 rounded-xl items-center ${copied ? 'bg-green-100' : 'bg-purple-100'}`}
          >
            <Text className={`text-sm font-medium ${copied ? 'text-green-700' : 'text-purple-700'}`}>
              {copied ? 'Shown — paste into each shortcut' : 'Show key'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Setup steps */}
        <View className="bg-gray-50 rounded-2xl p-5 mb-7">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Setup steps
          </Text>
          {[
            'Tap "Open Shortcuts" below',
            'Import each shortcut file from the FinWiz app bundle',
            'Open each shortcut and set the four variables: NOTIFICATION_TITLE, NOTIFICATION_BODY, UNIX_TIMESTAMP_MS, HMAC_KEY',
            'Paste your HMAC key shown above into the HMAC_KEY field',
            'Enable "Run Automatically" for each shortcut',
          ].map((step, i) => (
            <View key={i} className="flex-row mb-3 last:mb-0">
              <View className="w-5 h-5 rounded-full bg-purple-100 items-center justify-center mr-3 mt-0.5">
                <Text className="text-xs font-bold text-purple-600">{i + 1}</Text>
              </View>
              <Text className="text-sm text-gray-600 flex-1 leading-relaxed">{step}</Text>
            </View>
          ))}
        </View>

        {/* Bank list */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Supported banks
        </Text>
        {BANKS.map(({ name }) => (
          <View key={name} className="flex-row items-center py-3 border-b border-gray-50">
            <View className="w-2 h-2 rounded-full bg-purple-300 mr-3" />
            <Text className="text-sm text-gray-700">{name}</Text>
          </View>
        ))}
      </ScrollView>

      <View className="px-7 pb-14 pt-4 gap-3">
        <TouchableOpacity
          onPress={openShortcutsApp}
          className="bg-purple-600 py-4 rounded-2xl items-center"
          activeOpacity={0.85}
        >
          <Text className="text-white font-semibold text-base">Open Shortcuts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { void advance(); }}
          className="py-3.5 items-center"
        >
          <Text className="text-gray-400 font-medium text-sm">Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
