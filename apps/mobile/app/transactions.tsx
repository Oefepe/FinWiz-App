import { useState, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTransactions } from '../hooks/useTransactions';
import { useInvalidateAllowance } from '../hooks/useAllowance';
import { TransactionRow } from '../components/TransactionRow';
import { TransactionDetailModal } from '../components/TransactionDetailModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { tokens } from '../theme/tokens';
import { groupByDate, type TransactionRecord } from '../lib/transactionUtils';
import { updateTransactionType, deleteTransaction } from '../lib/database';

const TYPE_FILTERS = ['All', 'PIX_OUT', 'PIX_IN', 'TRANSFER_OUT', 'TRANSFER_IN', 'DEBIT'] as const;

export default function TransactionsScreen() {
  const { data: txs, isLoading } = useTransactions();
  const invalidateAllowance = useInvalidateAllowance();
  const qc = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [selected, setSelected] = useState<TransactionRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransactionRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = (txs ?? []).filter((tx) => {
    const matchesType = typeFilter === 'All' || tx.type === typeFilter;
    const matchesSearch =
      search === '' ||
      tx.description.toLowerCase().includes(search.toLowerCase()) ||
      tx.source_bank.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const sections = groupByDate(filtered);

  const handleToggleSelfTransfer = useCallback(
    async (tx: TransactionRecord, newType: string) => {
      await updateTransactionType(tx, newType);
      await qc.invalidateQueries({ queryKey: ['transactions'] });
      await invalidateAllowance();
      setSelected((prev) =>
        prev && prev.date === tx.date && prev.description === tx.description
          ? { ...prev, type: newType }
          : prev,
      );
    },
    [qc, invalidateAllowance],
  );

  function handleEdit(tx: TransactionRecord) {
    setSelected(null);
    router.push({ pathname: '/transaction-edit', params: { id: tx.id } });
  }

  async function handleConfirmDelete() {
    if (deleteTarget === null) return;
    setDeleting(true);
    try {
      await deleteTransaction(deleteTarget.id);
      await qc.invalidateQueries({ queryKey: ['transactions'] });
      await invalidateAllowance();
      setDeleteTarget(null);
      setSelected(null);
    } finally {
      setDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator color={tokens.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Search bar */}
      <View className="mx-4 mt-4 mb-2 bg-white rounded-xl px-3 py-2 flex-row items-center border border-gray-100">
        <Text className="text-gray-400 mr-2">⌕</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search transactions…"
          placeholderTextColor="#9CA3AF"
          className="flex-1 text-gray-800 text-sm"
        />
        {search !== '' && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text className="text-gray-400 ml-2">✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Type filter chips */}
      <View className="mx-4 mb-3">
        <SectionList
          horizontal
          sections={[{ title: '', data: TYPE_FILTERS as unknown as string[] }]}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setTypeFilter(item)}
              className={`mr-2 px-3 py-1 rounded-full ${
                typeFilter === item ? 'bg-purple-600' : 'bg-white border border-gray-200'
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  typeFilter === item ? 'text-white' : 'text-gray-600'
                }`}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
          renderSectionHeader={() => null}
          showsHorizontalScrollIndicator={false}
        />
      </View>

      {/* Transaction list grouped by date */}
      {sections.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 text-sm">No transactions found</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <View className="px-4 py-2 bg-gray-50">
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View className="px-4 bg-white">
              <TransactionRow tx={item} onPress={setSelected} />
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      <TransactionDetailModal
        tx={selected}
        onClose={() => setSelected(null)}
        onToggleSelfTransfer={(tx, newType) => {
          void handleToggleSelfTransfer(tx, newType);
        }}
        onEdit={handleEdit}
        onDelete={(tx) => setDeleteTarget(tx)}
      />

      <ConfirmDialog
        visible={deleteTarget !== null}
        message="Deleting a transaction is irreversible."
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        onDismiss={() => setDeleteTarget(null)}
      />
    </View>
  );
}
