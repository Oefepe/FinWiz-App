import { View, Text, TouchableOpacity } from 'react-native';
import {
  formatAmount,
  amountColorClass,
  badgeColorClass,
  isSelfTransfer,
  type TransactionRecord,
} from '../lib/transactionUtils';

interface TransactionRowProps {
  tx: TransactionRecord;
  onPress: (tx: TransactionRecord) => void;
}

export function TransactionRow({ tx, onPress }: TransactionRowProps) {
  const isGray = isSelfTransfer(tx.type);

  return (
    <TouchableOpacity
      onPress={() => onPress(tx)}
      activeOpacity={0.7}
      className="flex-row items-center py-3 border-b border-gray-50"
    >
      {/* Type badge */}
      <View className={`px-2 py-0.5 rounded-full mr-3 ${badgeColorClass(tx.type)}`}>
        <Text className="text-xs font-medium">{tx.type}</Text>
      </View>

      {/* Description + bank */}
      <View className="flex-1 min-w-0">
        <Text
          className={`text-sm font-medium ${isGray ? 'text-gray-400' : 'text-gray-800'}`}
          numberOfLines={1}
        >
          {tx.description}
        </Text>
        <Text className="text-xs text-gray-400">{tx.source_bank}</Text>
      </View>

      {/* Amount */}
      <Text className={`text-sm font-semibold ml-2 ${amountColorClass(tx.amount)}`}>
        {formatAmount(tx.amount)}
      </Text>
    </TouchableOpacity>
  );
}
