import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  emptyForm,
  validateManualEntry,
  formToTransaction,
  type ManualEntryForm,
  type SaveableTransaction,
} from '../lib/manualEntry';
import { TRANSACTION_TYPES, BANK_IDS } from '../lib/transactionUtils';

interface ManualEntryModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (tx: SaveableTransaction) => Promise<void>;
}

function PillSelector<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: string;
  onChange: (v: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-1">
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          onPress={() => onChange(opt)}
          className={`mr-2 px-3 py-1.5 rounded-full ${
            value === opt ? 'bg-purple-600' : 'bg-gray-100'
          }`}
        >
          <Text className={`text-xs font-medium ${value === opt ? 'text-white' : 'text-gray-600'}`}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
      </Text>
      {children}
      {error ? <Text className="text-xs text-red-500 mt-1">{error}</Text> : null}
    </View>
  );
}

export function ManualEntryModal({ visible, onClose, onSave }: ManualEntryModalProps) {
  const [form, setForm] = useState<ManualEntryForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function set<K extends keyof ManualEntryForm>(key: K, value: ManualEntryForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  }

  async function handleSave() {
    const validationErrors = validateManualEntry(form);
    if (validationErrors.length > 0) {
      const map: Record<string, string> = {};
      for (const e of validationErrors) map[e.field] = e.message;
      setErrors(map);
      return;
    }
    setSaving(true);
    try {
      await onSave(formToTransaction(form));
      setForm(emptyForm());
      setErrors({});
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setForm(emptyForm());
    setErrors({});
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/40"
      >
        <View className="bg-white rounded-t-3xl px-5 pt-4 pb-8 max-h-4/5">
          {/* Handle */}
          <View className="w-10 h-1 bg-gray-200 rounded-full self-center mb-4" />
          <Text className="text-lg font-bold text-gray-900 mb-5">New Transaction</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Field label="Amount (R$)" error={errors['amount']}>
              <TextInput
                value={form.amount}
                onChangeText={(v) => set('amount', v)}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-base"
              />
            </Field>

            <Field label="Type" error={errors['type']}>
              <PillSelector
                options={TRANSACTION_TYPES}
                value={form.type}
                onChange={(v) => set('type', v)}
              />
            </Field>

            <Field label="Description" error={errors['description']}>
              <TextInput
                value={form.description}
                onChangeText={(v) => set('description', v)}
                placeholder="e.g. Supermercado"
                placeholderTextColor="#9CA3AF"
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900"
              />
            </Field>

            <Field label="Bank" error={errors['sourceBank']}>
              <PillSelector
                options={BANK_IDS}
                value={form.sourceBank}
                onChange={(v) => set('sourceBank', v)}
              />
            </Field>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label="Date">
                  <TextInput
                    value={form.date}
                    onChangeText={(v) => set('date', v)}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9CA3AF"
                    className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900"
                  />
                </Field>
              </View>
              <View className="flex-1">
                <Field label="Time">
                  <TextInput
                    value={form.time}
                    onChangeText={(v) => set('time', v)}
                    placeholder="HH:MM"
                    placeholderTextColor="#9CA3AF"
                    className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900"
                  />
                </Field>
              </View>
            </View>
          </ScrollView>

          <View className="flex-row gap-3 mt-2">
            <TouchableOpacity
              onPress={handleClose}
              className="flex-1 py-3 bg-gray-100 rounded-xl items-center"
            >
              <Text className="text-sm font-semibold text-gray-700">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { void handleSave(); }}
              disabled={saving}
              className={`flex-1 py-3 rounded-xl items-center ${saving ? 'bg-purple-300' : 'bg-purple-600'}`}
            >
              <Text className="text-sm font-semibold text-white">
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
