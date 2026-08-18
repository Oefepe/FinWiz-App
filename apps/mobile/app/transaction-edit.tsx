import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Header } from '../components/Header';
import { Input, DropdownInput } from '../components/Input';
import { CheckIcon } from '../components/icons';
import { getTransactionById, updateTransaction } from '../lib/database';
import {
  transactionToEditForm,
  validateEditForm,
  formToUpdate,
  type EditForm,
} from '../lib/transactionEdit';
import { TRANSACTION_TYPES, type TransactionRecord } from '../lib/transactionUtils';
import { useInvalidateAllowance } from '../hooks/useAllowance';
import { useInvalidateTransactions } from '../hooks/useTransactions';
import { tokens } from '../theme/tokens';
import { typography } from '../theme/typography';

const TYPE_OPTIONS = TRANSACTION_TYPES.map((t) => ({ label: t, value: t }));
const INSTALLMENT_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const n = i + 1;
  return { label: n === 1 ? '1 (no installments)' : `${n}x`, value: String(n) };
});

export default function TransactionEditScreen() {
  const router = useRouter();
  const invalidateAllowance = useInvalidateAllowance();
  const invalidateTransactions = useInvalidateTransactions();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [original, setOriginal] = useState<TransactionRecord | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      if (typeof id !== 'string') {
        setLoading(false);
        return;
      }
      const tx = await getTransactionById(id);
      setOriginal(tx);
      if (tx !== null) setForm(transactionToEditForm(tx));
      setLoading(false);
    })();
  }, [id]);

  function set<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((f) => (f === null ? f : { ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  }

  async function handleSave() {
    if (form === null || original === null || typeof id !== 'string') return;

    const validationErrors = validateEditForm(form);
    if (validationErrors.length > 0) {
      const map: Record<string, string> = {};
      for (const e of validationErrors) map[e.field] = e.message;
      setErrors(map);
      return;
    }

    setSaving(true);
    try {
      await updateTransaction(id, formToUpdate(form, original));
      await invalidateTransactions();
      await invalidateAllowance();
      router.back();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.surface }}>
        <ActivityIndicator color={tokens.primary} />
      </View>
    );
  }

  if (form === null || original === null) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.surface }}>
        <Header title="Edit" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: tokens.textMutedB, fontFamily: typography.body.fontFamily, fontSize: typography.body.fontSize }}>
            Transaction not found.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: tokens.surface }}
    >
      <Header
        title="Edit"
        onBack={() => router.back()}
        rightAction={
          saving ? (
            <ActivityIndicator color={tokens.primary} />
          ) : (
            <Pressable accessibilityRole="button" onPress={() => void handleSave()}>
              <CheckIcon size={22} color={tokens.primary} />
            </Pressable>
          )
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ marginBottom: 16 }}>
          <Input
            label="Transaction Source"
            value={form.description}
            onChangeText={(v) => set('description', v)}
            placeholder="e.g. Mercado"
          />
          {errors['description'] ? (
            <Text style={{ color: tokens.alert, fontSize: 12, marginTop: 4 }}>{errors['description']}</Text>
          ) : null}
        </View>

        <View style={{ marginBottom: 16 }}>
          <Input
            label="Transaction Value (R$)"
            value={form.amount}
            onChangeText={(v) => set('amount', v)}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
          {errors['amount'] ? (
            <Text style={{ color: tokens.alert, fontSize: 12, marginTop: 4 }}>{errors['amount']}</Text>
          ) : null}
        </View>

        <View style={{ marginBottom: 16 }}>
          <DropdownInput
            label="Transaction Type"
            value={form.type}
            onSelect={(v) => set('type', v)}
            options={TYPE_OPTIONS}
          />
          {errors['type'] ? (
            <Text style={{ color: tokens.alert, fontSize: 12, marginTop: 4 }}>{errors['type']}</Text>
          ) : null}
        </View>

        <View style={{ marginBottom: 16 }}>
          <DropdownInput
            label="Stallments"
            value={form.installments}
            onSelect={(v) => set('installments', v)}
            options={INSTALLMENT_OPTIONS}
          />
          {errors['installments'] ? (
            <Text style={{ color: tokens.alert, fontSize: 12, marginTop: 4 }}>{errors['installments']}</Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
