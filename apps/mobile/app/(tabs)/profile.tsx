import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useQueryClient } from '@tanstack/react-query';
import { Header } from '../../components/Header';
import { Input } from '../../components/Input';
import { RadioButton } from '../../components/RadioButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CheckIcon } from '../../components/icons';
import { tokens } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { getAllowanceConfig, saveAllowanceConfig } from '../../lib/database';
import { OWNER_NAME_KEY } from '../../lib/ingestionPipeline';
import {
  configToProfileForm,
  validateProfileForm,
  profileFormToConfig,
  financialFieldsChanged,
  type ProfileForm,
} from '../../lib/profile';

const EMPTY_FORM: ProfileForm = {
  fullName: '',
  salary: '',
  fixedExpenses: '',
  targetSaveAmount: '',
  period: 'monthly',
};

export default function ProfileScreen() {
  const qc = useQueryClient();
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [original, setOriginal] = useState<ProfileForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  useEffect(() => {
    void (async () => {
      const config = await getAllowanceConfig();
      const fullName = (await SecureStore.getItemAsync(OWNER_NAME_KEY)) ?? '';
      const loaded = configToProfileForm(config, fullName);
      setForm(loaded);
      setOriginal(loaded);
      setLoading(false);
    })();
  }, []);

  async function commitSave(): Promise<void> {
    setSaving(true);
    try {
      const currentConfig = await getAllowanceConfig();
      await saveAllowanceConfig(profileFormToConfig(form, currentConfig));

      const trimmedName = form.fullName.trim();
      if (trimmedName !== '') {
        await SecureStore.setItemAsync(OWNER_NAME_KEY, trimmedName);
      } else {
        await SecureStore.deleteItemAsync(OWNER_NAME_KEY);
      }

      // Recompute: any open allowance query (Dashboard, Insights) refetches
      // against the newly saved salary/fixed-expenses/target-save/period.
      await qc.invalidateQueries({ queryKey: ['allowance'] });

      setOriginal(form);
      Alert.alert('Saved', 'Profile updated successfully.');
    } finally {
      setSaving(false);
      setConfirmVisible(false);
    }
  }

  function handleSavePress(): void {
    const errors = validateProfileForm(form);
    if (errors.length > 0) {
      Alert.alert('Check your info', errors.map((e) => e.message).join('\n'));
      return;
    }
    if (financialFieldsChanged(form, original)) {
      setConfirmVisible(true);
    } else {
      void commitSave();
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.surface, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={tokens.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <Header
        title="Profile"
        rightAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save profile"
            onPress={handleSavePress}
            disabled={saving}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: saving ? 0.5 : 1 }}
          >
            <CheckIcon size={20} color={tokens.primary} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Input
          label="Full Name"
          value={form.fullName}
          onChangeText={(fullName) => { setForm((prev) => ({ ...prev, fullName })); }}
          placeholder="e.g. João Silva"
          autoCapitalize="words"
          autoCorrect={false}
        />
        <Input
          label="Salary"
          value={form.salary}
          onChangeText={(salary) => { setForm((prev) => ({ ...prev, salary })); }}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <Input
          label="Fixed Expenses"
          value={form.fixedExpenses}
          onChangeText={(fixedExpenses) => { setForm((prev) => ({ ...prev, fixedExpenses })); }}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <Input
          label="Target Save Amount"
          value={form.targetSaveAmount}
          onChangeText={(targetSaveAmount) => { setForm((prev) => ({ ...prev, targetSaveAmount })); }}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        <View>
          <Text
            style={{
              color: tokens.textPrimary,
              marginBottom: 6,
              fontFamily: typography.bodyBold.fontFamily,
              fontSize: typography.bodyBold.fontSize,
              lineHeight: typography.bodyBold.lineHeight,
            }}
          >
            Allowance Period
          </Text>
          <RadioButton
            label="Weekly"
            selected={form.period === 'weekly'}
            onPress={() => { setForm((prev) => ({ ...prev, period: 'weekly' })); }}
          />
          <RadioButton
            label="Monthly"
            selected={form.period === 'monthly'}
            onPress={() => { setForm((prev) => ({ ...prev, period: 'monthly' })); }}
          />
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmVisible}
        message="This changes your active allowance calculation. Continue?"
        confirmLabel="Save Changes"
        onConfirm={() => { void commitSave(); }}
        onDismiss={() => { setConfirmVisible(false); }}
      />
    </View>
  );
}
