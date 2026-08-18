import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { createObsidianClient } from '@finwiz/obsidian-client';
import {
  markStepComplete,
  getStepsForPlatform,
  getNextStep,
  markOnboardingComplete,
  type OnboardingPlatform,
} from '../../lib/onboarding';
import { OWNER_NAME_KEY } from '../../lib/ingestionPipeline';

const OBSIDIAN_API_KEY = 'finwiz_obsidian_api_key';
const OBSIDIAN_URL_KEY = 'finwiz_obsidian_url';

export default function SelfTransferHintScreen() {
  const router = useRouter();
  const [ownerName, setOwnerName] = useState('');

  async function handleContinue() {
    const name = ownerName.trim();

    if (name !== '') {
      await SecureStore.setItemAsync(OWNER_NAME_KEY, name);

      // Patch owner_name in goals.md if vault is configured.
      try {
        const apiKey = await SecureStore.getItemAsync(OBSIDIAN_API_KEY);
        if (apiKey !== null) {
          const baseUrl =
            (await SecureStore.getItemAsync(OBSIDIAN_URL_KEY)) ?? 'https://localhost:27124';
          const client = createObsidianClient({ secureStore: SecureStore, baseUrl });
          const content = await client.getNote('00-Profile/goals.md');
          const patched = content.replace(
            /owner_name:\s*"[^"]*"/,
            `owner_name: "${name.replace(/"/g, '\\"')}"`,
          );
          await client.putNote('00-Profile/goals.md', patched);
        }
      } catch {
        // Vault unavailable — name stored in SecureStore only.
      }
    }

    await markStepComplete('self-transfer-hint');
    const platform: OnboardingPlatform =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other';
    const steps = getStepsForPlatform(platform);
    const next = getNextStep('self-transfer-hint', steps);
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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-3xl font-bold text-gray-900 mb-3">Self-Transfer Detection</Text>
        <Text className="text-base text-gray-500 mb-8 leading-relaxed">
          When you transfer money between your own accounts (e.g. Nubank → Itaú), FinWiz
          automatically pairs both legs so they don't count as spending.
        </Text>

        <View className="bg-gray-50 rounded-2xl p-5 mb-8">
          <Text className="text-sm font-semibold text-gray-700 mb-3">How it works</Text>
          {[
            'Two transactions within 5 minutes with opposite directions and matching amounts are paired automatically.',
            'Paired transactions are tagged SELF_TRANSFER and excluded from your allowance calculation.',
            'You can manually confirm or reject pairs from the transaction detail screen.',
          ].map((point, i) => (
            <View key={i} className="flex-row mb-3 last:mb-0">
              <View className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 mr-3" />
              <Text className="text-sm text-gray-600 flex-1 leading-relaxed">{point}</Text>
            </View>
          ))}
        </View>

        {/* Owner name */}
        <Text className="text-sm font-semibold text-gray-700 mb-2">
          Your name{' '}
          <Text className="text-gray-400 font-normal">(optional)</Text>
        </Text>
        <Text className="text-xs text-gray-400 mb-4 leading-relaxed">
          Adding your name improves detection accuracy — keywords like "para {ownerName || 'você'}"
          increase confidence for self-transfer pairing. Stored on-device only, never transmitted.
        </Text>
        <TextInput
          value={ownerName}
          onChangeText={setOwnerName}
          placeholder="e.g. João Silva"
          autoCapitalize="words"
          autoCorrect={false}
          className="bg-gray-50 rounded-xl px-4 py-3.5 text-sm text-gray-900 border border-gray-100"
        />
      </ScrollView>

      <View className="px-7 pb-14 pt-4">
        <TouchableOpacity
          onPress={() => { void handleContinue(); }}
          className="bg-purple-600 py-4 rounded-2xl items-center"
          activeOpacity={0.85}
        >
          <Text className="text-white font-semibold text-base">Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
