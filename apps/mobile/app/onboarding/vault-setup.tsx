import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { createObsidianClient, bootstrapVault } from '@finwiz/obsidian-client';
import {
  markStepComplete,
  getStepsForPlatform,
  getNextStep,
  markOnboardingComplete,
  type OnboardingPlatform,
} from '../../lib/onboarding';

const OBSIDIAN_API_KEY = 'finwiz_obsidian_api_key';
const OBSIDIAN_URL_KEY = 'finwiz_obsidian_url';
const VAULT_SKIP_KEY = 'finwiz_vault_skipped';

type Status = 'idle' | 'testing' | 'ok' | 'error';

export default function VaultSetupScreen() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('https://localhost:27124');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleTestConnection() {
    if (apiKey.trim() === '') {
      setErrorMsg('API key is required.');
      setStatus('error');
      return;
    }

    setStatus('testing');
    setErrorMsg('');

    try {
      // Save to SecureStore so the VaultClient can read it.
      await SecureStore.setItemAsync(OBSIDIAN_API_KEY, apiKey.trim());
      await SecureStore.setItemAsync(OBSIDIAN_URL_KEY, apiUrl.trim());

      const client = createObsidianClient({
        secureStore: SecureStore,
        baseUrl: apiUrl.trim(),
      });

      await client.listVault();
      await bootstrapVault(client);
      setStatus('ok');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Connection failed');
      setStatus('error');
    }
  }

  async function advance() {
    await markStepComplete('vault-setup');
    const platform: OnboardingPlatform =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other';
    const steps = getStepsForPlatform(platform);
    const next = getNextStep('vault-setup', steps);
    if (next === null) {
      await markOnboardingComplete();
      router.replace('/(tabs)');
    } else {
      router.push(`/onboarding/${next}`);
    }
  }

  async function handleSkip() {
    await SecureStore.setItemAsync(VAULT_SKIP_KEY, '1');
    await advance();
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 80, paddingBottom: 24, paddingHorizontal: 28 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-3xl font-bold text-gray-900 mb-3">Vault Setup</Text>
        <Text className="text-base text-gray-500 mb-5 leading-relaxed">
          FinWiz syncs your financial notes to an Obsidian vault. Install the{' '}
          <Text className="font-semibold text-gray-700">Local REST API</Text> plugin in Obsidian,
          then paste your API key below.
        </Text>

        {/* M16-T5 — the vault is a plaintext Markdown write channel outside
            the app's own SQLCipher-encrypted database; make that explicit
            here, not just in this milestone's plan notes. */}
        <View className="bg-amber-50 rounded-2xl p-4 mb-6 border border-amber-100">
          <Text className="text-xs font-semibold text-amber-700 mb-1">Not covered by app encryption</Text>
          <Text className="text-xs text-amber-600 leading-relaxed">
            Your transactions always stay encrypted in FinWiz's own database regardless of this
            setting. If you connect a vault, the goals and self-transfer summaries FinWiz writes to
            it are plain Markdown files, protected only by your Obsidian vault's own storage — not
            by FinWiz. This step is entirely optional; skip it if you'd rather not have any
            plaintext copy anywhere.
          </Text>
        </View>

        {/* Instructions */}
        <View className="bg-gray-50 rounded-2xl p-5 mb-7">
          {[
            'Open Obsidian → Settings → Community plugins',
            'Search for "Local REST API" and enable it',
            'Open the plugin settings and copy the API key',
            'Paste the key below and tap Test connection',
          ].map((step, i) => (
            <View key={i} className="flex-row mb-3 last:mb-0">
              <View className="w-5 h-5 rounded-full bg-purple-100 items-center justify-center mr-3 mt-0.5">
                <Text className="text-xs font-bold text-purple-600">{i + 1}</Text>
              </View>
              <Text className="text-sm text-gray-600 flex-1 leading-relaxed">{step}</Text>
            </View>
          ))}
        </View>

        {/* URL */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          API URL
        </Text>
        <TextInput
          value={apiUrl}
          onChangeText={setApiUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://localhost:27124"
          className="bg-gray-50 rounded-xl px-4 py-3.5 text-sm text-gray-900 mb-5 border border-gray-100"
        />

        {/* API Key */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          API Key
        </Text>
        <TextInput
          value={apiKey}
          onChangeText={setApiKey}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Paste your API key here"
          className="bg-gray-50 rounded-xl px-4 py-3.5 text-sm text-gray-900 mb-6 border border-gray-100"
        />

        {/* Status messages */}
        {status === 'ok' && (
          <View className="p-4 bg-green-50 rounded-2xl mb-4">
            <Text className="text-sm font-semibold text-green-700">Connected</Text>
            <Text className="text-xs text-green-500 mt-1">
              Vault bootstrapped successfully.
            </Text>
          </View>
        )}
        {status === 'error' && (
          <View className="p-4 bg-red-50 rounded-2xl mb-4">
            <Text className="text-sm font-semibold text-red-700">Connection failed</Text>
            <Text className="text-xs text-red-400 mt-1">{errorMsg}</Text>
          </View>
        )}
      </ScrollView>

      <View className="px-7 pb-14 pt-4 gap-3">
        <TouchableOpacity
          onPress={() => { void handleTestConnection(); }}
          disabled={status === 'testing'}
          className={`py-4 rounded-2xl items-center flex-row justify-center gap-2 ${
            status === 'testing' ? 'bg-purple-300' : 'bg-purple-600'
          }`}
          activeOpacity={0.85}
        >
          {status === 'testing' ? (
            <ActivityIndicator color="white" size="small" />
          ) : null}
          <Text className="text-white font-semibold text-base">
            {status === 'ok' ? 'Continue' : 'Test connection'}
          </Text>
        </TouchableOpacity>

        {status === 'ok' ? (
          <TouchableOpacity
            onPress={() => { void advance(); }}
            className="py-3.5 rounded-2xl items-center"
          >
            <Text className="text-purple-600 font-medium text-sm">Continue</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => { void handleSkip(); }}
            className="py-3.5 rounded-2xl items-center"
          >
            <Text className="text-gray-400 font-medium text-sm">Skip — set up vault later</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
