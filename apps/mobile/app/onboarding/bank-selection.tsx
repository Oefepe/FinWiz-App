import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { saveSelectedBanks } from '../../lib/database';
import { SUPPORTED_BANKS as BANKS } from '../../lib/banks';
import {
  markStepComplete,
  getStepsForPlatform,
  getNextStep,
  markOnboardingComplete,
  type OnboardingPlatform,
} from '../../lib/onboarding';

type NotifMode = 'bank_only' | 'wallet_only' | 'both';

const NOTIF_MODE_KEY = 'finwiz_notification_mode';

const MODES: { value: NotifMode; label: string; sub: string }[] = [
  {
    value: 'bank_only',
    label: 'Bank apps only',
    sub: 'PIX, transfers, card debits — most complete',
  },
  {
    value: 'wallet_only',
    label: 'Wallet only',
    sub: 'Google/Samsung Pay NFC taps only — simpler but misses PIX, ATM, recurring debits',
  },
  {
    value: 'both',
    label: 'Both (recommended)',
    sub: 'All sources with duplicate detection — best coverage',
  },
];

export default function BankSelectionScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(BANKS.map((b) => b.pkg)));
  const [mode, setMode] = useState<NotifMode>('bank_only');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const stored = await SecureStore.getItemAsync(NOTIF_MODE_KEY);
      if (stored === 'wallet_only' || stored === 'both') setMode(stored);
    })();
  }, []);

  function toggleBank(pkg: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pkg)) { next.delete(pkg); } else { next.add(pkg); }
      return next;
    });
  }

  async function handleContinue() {
    setSaving(true);
    try {
      await saveSelectedBanks(Array.from(selected));
      await SecureStore.setItemAsync(NOTIF_MODE_KEY, mode);
    } finally {
      setSaving(false);
    }

    await markStepComplete('bank-selection');
    const platform: OnboardingPlatform = 'android';
    const steps = getStepsForPlatform(platform);
    const next = getNextStep('bank-selection', steps);
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
        <Text className="text-3xl font-bold text-gray-900 mb-3">Your Banks</Text>
        <Text className="text-base text-gray-500 mb-8 leading-relaxed">
          Select the banks you use. FinWiz will only process notifications from these apps.
        </Text>

        {/* Bank list */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Supported banks
        </Text>
        {BANKS.map(({ pkg, label }) => {
          const active = selected.has(pkg);
          return (
            <TouchableOpacity
              key={pkg}
              onPress={() => { toggleBank(pkg); }}
              className="flex-row items-center py-4 border-b border-gray-50"
              activeOpacity={0.7}
            >
              <View
                className={`w-5 h-5 rounded border-2 items-center justify-center mr-4 ${
                  active ? 'border-purple-600 bg-purple-600' : 'border-gray-300'
                }`}
              >
                {active && <Text className="text-white text-xs font-bold">✓</Text>}
              </View>
              <Text className={`text-base ${active ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Notification mode */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-8 mb-4">
          Notification source
        </Text>
        {MODES.map(({ value, label, sub }) => (
          <TouchableOpacity
            key={value}
            onPress={() => { setMode(value); }}
            className={`mb-3 p-4 rounded-2xl border-2 ${
              mode === value ? 'border-purple-600 bg-purple-50' : 'border-gray-100 bg-gray-50'
            }`}
            activeOpacity={0.7}
          >
            <Text
              className={`font-semibold text-sm mb-1 ${
                mode === value ? 'text-purple-700' : 'text-gray-700'
              }`}
            >
              {label}
            </Text>
            <Text className="text-xs text-gray-400 leading-relaxed">{sub}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View className="px-7 pb-14 pt-4">
        <TouchableOpacity
          onPress={() => { void handleContinue(); }}
          disabled={saving || selected.size === 0}
          className={`py-4 rounded-2xl items-center ${
            saving || selected.size === 0 ? 'bg-purple-300' : 'bg-purple-600'
          }`}
          activeOpacity={0.85}
        >
          <Text className="text-white font-semibold text-base">
            {saving ? 'Saving…' : `Continue with ${selected.size} bank${selected.size === 1 ? '' : 's'}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
