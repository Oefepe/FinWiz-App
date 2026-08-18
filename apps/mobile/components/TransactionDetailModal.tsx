import { View, Text, Modal, TouchableOpacity, ScrollView, Switch } from 'react-native';
import {
  formatAmount,
  amountColorClass,
  isSelfTransferEligible,
  isSelfTransfer,
  toSelfTransferType,
  fromSelfTransferType,
  type TransactionRecord,
} from '../lib/transactionUtils';
import { PencilIcon, TrashIcon } from './icons';
import { tokens } from '../theme/tokens';

interface TransactionDetailModalProps {
  tx: TransactionRecord | null;
  onClose: () => void;
  onToggleSelfTransfer: (tx: TransactionRecord, newType: string) => void;
  onEdit: (tx: TransactionRecord) => void;
  onDelete: (tx: TransactionRecord) => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-gray-50">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="text-sm font-medium text-gray-800 max-w-48" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function TransactionDetailModal({
  tx,
  onClose,
  onToggleSelfTransfer,
  onEdit,
  onDelete,
}: TransactionDetailModalProps) {
  if (!tx) return null;

  const selfTransferOn = isSelfTransfer(tx.type);
  const canToggle = isSelfTransferEligible(tx.type) || selfTransferOn;

  function handleToggle() {
    if (!tx) return;
    const newType = selfTransferOn
      ? fromSelfTransferType(tx.type)
      : toSelfTransferType(tx.type);
    onToggleSelfTransfer(tx, newType);
  }

  return (
    <Modal visible={tx !== null} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        className="flex-1 bg-black/40 justify-end"
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          className="bg-white rounded-t-3xl px-5 pt-4 pb-8"
          onPress={() => {}}
        >
          {/* Handle */}
          <View className="w-10 h-1 bg-gray-200 rounded-full self-center mb-4" />

          <View className="flex-row items-start justify-between mb-4">
            <Text className="text-lg font-bold text-gray-900 flex-1 mr-3" numberOfLines={2}>
              {tx.description}
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Edit transaction"
                onPress={() => onEdit(tx)}
              >
                <PencilIcon size={20} color={tokens.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Delete transaction"
                onPress={() => onDelete(tx)}
              >
                <TrashIcon size={20} color={tokens.alert} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Row label="Date" value={tx.date} />
            <Row label="Time" value={tx.time} />
            <Row label="Type" value={tx.type} />
            <Row label="Amount" value={formatAmount(tx.amount)} />
            <Row label="Bank" value={tx.source_bank} />
            {tx.category ? <Row label="Category" value={tx.category} /> : null}

            {/* Self-transfer toggle — only for eligible transaction types */}
            {canToggle && (
              <View className="flex-row items-center justify-between py-3 mt-2">
                <View className="flex-1 mr-4">
                  <Text className="text-sm font-medium text-gray-800">Self-transfer</Text>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    Excludes this transaction from your spending allowance
                  </Text>
                </View>
                <Switch
                  value={selfTransferOn}
                  onValueChange={handleToggle}
                  trackColor={{ false: '#D1D5DB', true: tokens.primary }}
                  thumbColor="white"
                />
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            onPress={onClose}
            className="mt-4 py-3 bg-gray-100 rounded-xl items-center"
          >
            <Text className="text-sm font-semibold text-gray-700">Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export type { TransactionDetailModalProps };
export { amountColorClass };
