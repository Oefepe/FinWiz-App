import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import {
  markStepComplete,
  markOnboardingComplete,
  getStepsForPlatform,
  isLastStep,
  type OnboardingPlatform,
} from '../../lib/onboarding';

const STEPS = [
  {
    title: 'Tap the + button',
    body: 'The floating action button appears on every tab — Dashboard, Transactions, and Insights.',
  },
  {
    title: 'Enter the amount',
    body: 'Type the amount in R$. Outgoing transactions (spending) are automatically negative.',
  },
  {
    title: 'Choose a type',
    body: 'Select DEBIT, CREDIT, PIX_OUT, PIX_IN, or one of the transfer types. The app pre-selects DEBIT for most entries.',
  },
  {
    title: 'Pick a bank',
    body: 'Select which account the transaction belongs to. This helps FinWiz detect self-transfers.',
  },
  {
    title: 'Save',
    body: 'The transaction is saved instantly. Your allowance recalculates in real time.',
  },
];

export default function ManualEntryTutorialScreen() {
  const router = useRouter();

  async function handleDone() {
    await markStepComplete('manual-entry-tutorial');
    const platform: OnboardingPlatform =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other';
    const steps = getStepsForPlatform(platform);
    // This is always the last step — mark onboarding complete.
    if (isLastStep('manual-entry-tutorial', steps)) {
      await markOnboardingComplete();
    }
    router.replace('/(tabs)');
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 80, paddingBottom: 24, paddingHorizontal: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-3xl font-bold text-gray-900 mb-3">Manual Entry</Text>
        <Text className="text-base text-gray-500 mb-8 leading-relaxed">
          For cash payments, card swipes without notifications, or any transaction you want to
          record manually — the quick-entry widget has you covered.
        </Text>

        {STEPS.map(({ title, body }, i) => (
          <View key={title} className="flex-row mb-8">
            <View className="items-center mr-5">
              <View className="w-8 h-8 rounded-full bg-purple-600 items-center justify-center">
                <Text className="text-white text-sm font-bold">{i + 1}</Text>
              </View>
              {i < STEPS.length - 1 && (
                <View className="w-0.5 flex-1 bg-purple-100 mt-2" />
              )}
            </View>
            <View className="flex-1 pb-4">
              <Text className="text-base font-semibold text-gray-900 mb-1">{title}</Text>
              <Text className="text-sm text-gray-500 leading-relaxed">{body}</Text>
            </View>
          </View>
        ))}

        <View className="bg-purple-50 rounded-2xl p-5 mt-2">
          <Text className="text-sm font-semibold text-purple-700 mb-2">
            You're all set!
          </Text>
          <Text className="text-sm text-purple-600 leading-relaxed">
            FinWiz is ready to track your finances. Your allowance updates in real time as
            transactions come in — automatically from notifications or manually from this widget.
          </Text>
        </View>
      </ScrollView>

      <View className="px-7 pb-14 pt-4">
        <TouchableOpacity
          onPress={() => { void handleDone(); }}
          className="bg-purple-600 py-4 rounded-2xl items-center"
          activeOpacity={0.85}
        >
          <Text className="text-white font-semibold text-base">Start using FinWiz</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
