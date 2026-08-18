import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import {
  markStepComplete,
  getStepsForPlatform,
  getNextStep,
  markOnboardingComplete,
  type OnboardingPlatform,
} from '../../lib/onboarding';

const BULLET_POINTS = [
  {
    title: 'No account. No cloud.',
    body: 'Everything stays on your phone. FinWiz never sends your data to a server.',
  },
  {
    title: 'Smart allowance system.',
    body: 'Set your income, fixed expenses and savings goal — FinWiz calculates exactly how much you can spend each day.',
  },
  {
    title: 'You own your data.',
    body: 'Notes sync to your Obsidian vault — a folder you control.',
  },
  {
    title: 'Free, forever.',
    body: 'No subscription. No ads. Open-source.',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();

  async function handleContinue() {
    await markStepComplete('welcome');
    const platform: OnboardingPlatform =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other';
    const steps = getStepsForPlatform(platform);
    const next = getNextStep('welcome', steps);
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
        <Text className="text-4xl font-bold text-gray-900 mb-2">Welcome to</Text>
        <Text className="text-4xl font-bold text-purple-600 mb-6">FinWiz</Text>
        <Text className="text-base text-gray-500 mb-10 leading-relaxed">
          A personal finance advisor that lives entirely on your device — no account, no cloud,
          no subscriptions.
        </Text>

        {BULLET_POINTS.map(({ title, body }) => (
          <View key={title} className="flex-row mb-7">
            <View className="w-2 h-2 rounded-full bg-purple-500 mt-2 mr-4" />
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900 mb-1">{title}</Text>
              <Text className="text-sm text-gray-500 leading-relaxed">{body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View className="px-7 pb-14 pt-4">
        <TouchableOpacity
          onPress={() => { void handleContinue(); }}
          className="bg-purple-600 py-4 rounded-2xl items-center"
          activeOpacity={0.85}
        >
          <Text className="text-white font-semibold text-base">Get started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
