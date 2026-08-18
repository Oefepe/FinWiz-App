import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { saveAllowanceConfig } from '../../lib/database';
import { createObsidianClient } from '@finwiz/obsidian-client';
import {
  markStepComplete,
  getStepsForPlatform,
  getNextStep,
  markOnboardingComplete,
  type OnboardingPlatform,
} from '../../lib/onboarding';
import { tokens } from '../../theme/tokens';

type Period = 'monthly' | 'weekly';
type Phase = 'income' | 'fixed' | 'savings' | 'period' | 'confirm' | 'saving';

const QUESTIONS: Record<Exclude<Phase, 'confirm' | 'saving'>, { question: string; hint: string }> = {
  income: {
    question: "What's your monthly take-home pay after taxes?",
    hint: 'Net income in R$ — the amount that hits your account each month.',
  },
  fixed: {
    question: 'What are your total fixed monthly expenses?',
    hint: 'Rent, electricity, water, internet, subscriptions, loan payments — everything fixed regardless of behaviour.',
  },
  savings: {
    question: 'How much do you want to save each month?',
    hint: 'This is set aside before your allowance is calculated.',
  },
  period: {
    question: 'Would you prefer a weekly or monthly allowance?',
    hint: 'Weekly gives more frequent check-ins. Monthly is simpler.',
  },
};

const OBSIDIAN_API_KEY = 'finwiz_obsidian_api_key';
const OBSIDIAN_URL_KEY = 'finwiz_obsidian_url';

export default function FinancialSetupScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('income');
  const [income, setIncome] = useState('');
  const [fixed, setFixed] = useState('');
  const [savings, setSavings] = useState('');
  const [period, setPeriod] = useState<Period>('monthly');
  const [inputError, setInputError] = useState('');

  function parseAmount(raw: string): number | null {
    const val = parseFloat(raw.replace(',', '.'));
    return isNaN(val) || val < 0 ? null : val;
  }

  function handleNext() {
    setInputError('');

    if (phase === 'income') {
      if (parseAmount(income) === null) { setInputError('Enter a valid amount in R$.'); return; }
      setPhase('fixed');
    } else if (phase === 'fixed') {
      if (parseAmount(fixed) === null) { setInputError('Enter a valid amount in R$.'); return; }
      setPhase('savings');
    } else if (phase === 'savings') {
      if (parseAmount(savings) === null) { setInputError('Enter a valid amount in R$.'); return; }
      setPhase('period');
    } else if (phase === 'period') {
      setPhase('confirm');
    }
  }

  async function handleSave() {
    setPhase('saving');

    const incomeVal = parseAmount(income) ?? 0;
    const fixedVal = parseAmount(fixed) ?? 0;
    const savingsVal = parseAmount(savings) ?? 0;

    try {
      await saveAllowanceConfig({
        monthlyIncomeEstimate: incomeVal,
        fixedMonthlyExpenses: fixedVal,
        savingsGoalAmount: savingsVal,
        period,
        alertThreshold: 0.2,
      });

      const apiKey = await SecureStore.getItemAsync(OBSIDIAN_API_KEY);
      if (apiKey !== null) {
        const baseUrl = (await SecureStore.getItemAsync(OBSIDIAN_URL_KEY)) ?? 'https://localhost:27124';
        const client = createObsidianClient({ secureStore: SecureStore, baseUrl });
        const today = new Date().toISOString().slice(0, 10);
        const goalsContent = [
          '---',
          `savings_goal_amount: ${savingsVal.toFixed(2)}`,
          `savings_goal_currency: BRL`,
          `savings_period: ${period}`,
          `savings_goal_start: ${today}`,
          `allowance_alert_threshold: 0.20`,
          `monthly_income_estimate: ${incomeVal.toFixed(2)}`,
          `fixed_monthly_expenses: ${fixedVal.toFixed(2)}`,
          `owner_name: ""`,
          '---',
          '',
        ].join('\n');
        await client.putNote('00-Profile/goals.md', goalsContent);
      }
    } catch {
      // Vault write failures are non-blocking; SQLite is the source of truth.
    }

    await markStepComplete('financial-setup');
    const platform: OnboardingPlatform =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other';
    const steps = getStepsForPlatform(platform);
    const next = getNextStep('financial-setup', steps);
    if (next === null) {
      await markOnboardingComplete();
      router.replace('/(tabs)');
    } else {
      router.push(`/onboarding/${next}`);
    }
  }

  const isTextInput = phase === 'income' || phase === 'fixed' || phase === 'savings';
  const currentValue =
    phase === 'income' ? income : phase === 'fixed' ? fixed : phase === 'savings' ? savings : '';
  const currentSetter =
    phase === 'income' ? setIncome : phase === 'fixed' ? setFixed : phase === 'savings' ? setSavings : null;

  if (phase === 'saving') {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color={tokens.primary} size="large" />
        <Text className="text-sm text-gray-400 mt-4">Saving your profile…</Text>
      </View>
    );
  }

  if (phase === 'confirm') {
    return (
      <View className="flex-1 bg-white">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingTop: 80, paddingBottom: 24, paddingHorizontal: 28 }}
        >
          <Text className="text-3xl font-bold text-gray-900 mb-3">Looks good?</Text>
          <Text className="text-base text-gray-500 mb-8 leading-relaxed">
            Review your financial profile before we save it.
          </Text>

          {[
            { label: 'Monthly income', value: `R$ ${income}` },
            { label: 'Fixed expenses', value: `R$ ${fixed}` },
            { label: 'Monthly savings goal', value: `R$ ${savings}` },
            { label: 'Budget period', value: period === 'monthly' ? 'Monthly' : 'Weekly' },
            {
              label: 'Spendable allowance',
              value: `R$ ${(
                (parseAmount(income) ?? 0) -
                (parseAmount(fixed) ?? 0) -
                (parseAmount(savings) ?? 0)
              ).toFixed(2)} / ${period === 'monthly' ? 'month' : 'week'}`,
            },
          ].map(({ label, value }) => (
            <View key={label} className="flex-row justify-between py-4 border-b border-gray-50">
              <Text className="text-sm text-gray-500">{label}</Text>
              <Text className="text-sm font-semibold text-gray-900">{value}</Text>
            </View>
          ))}
        </ScrollView>

        <View className="px-7 pb-14 pt-4 gap-3">
          <TouchableOpacity
            onPress={() => { void handleSave(); }}
            className="bg-purple-600 py-4 rounded-2xl items-center"
            activeOpacity={0.85}
          >
            <Text className="text-white font-semibold text-base">Save and continue</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setPhase('income'); }} className="py-3 items-center">
            <Text className="text-gray-400 text-sm">Edit answers</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const q = QUESTIONS[phase as Exclude<Phase, 'confirm' | 'saving'>];

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 80, paddingBottom: 24, paddingHorizontal: 28 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-xs font-semibold text-purple-500 uppercase tracking-widest mb-6">
          Financial Profile
        </Text>
        <Text className="text-2xl font-bold text-gray-900 mb-4 leading-snug">{q.question}</Text>
        <Text className="text-sm text-gray-400 mb-8 leading-relaxed">{q.hint}</Text>

        {isTextInput && currentSetter !== null ? (
          <TextInput
            value={currentValue}
            onChangeText={currentSetter}
            keyboardType="decimal-pad"
            placeholder="0.00"
            autoFocus
            className="text-3xl font-semibold text-gray-900 border-b-2 border-purple-200 pb-3 mb-6"
            placeholderTextColor="#D1D5DB"
          />
        ) : (
          <View className="flex-row gap-4 mb-6">
            {(['monthly', 'weekly'] as Period[]).map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => { setPeriod(p); }}
                className={`flex-1 py-4 rounded-2xl items-center border-2 ${
                  period === p ? 'border-purple-600 bg-purple-50' : 'border-gray-100 bg-gray-50'
                }`}
              >
                <Text
                  className={`font-semibold text-base capitalize ${
                    period === p ? 'text-purple-700' : 'text-gray-500'
                  }`}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {inputError !== '' && (
          <Text className="text-xs text-red-500 mb-4">{inputError}</Text>
        )}
      </ScrollView>

      <View className="px-7 pb-14 pt-4">
        <TouchableOpacity
          onPress={handleNext}
          className="bg-purple-600 py-4 rounded-2xl items-center"
          activeOpacity={0.85}
        >
          <Text className="text-white font-semibold text-base">
            {phase === 'period' ? 'Review' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
