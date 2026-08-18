import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAllowance } from '../../hooks/useAllowance';
import { useTransactions } from '../../hooks/useTransactions';
import { ProgressBar } from '../../components/ProgressBar';
import { TransactionRow } from '../../components/TransactionRow';
import { TransactionDetailModal } from '../../components/TransactionDetailModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatAmount, type TransactionRecord } from '../../lib/transactionUtils';
import {
  triggerAllowanceAlert,
  triggerBudgetExhausted,
} from '../../lib/notifications';
import { updateTransactionType, deleteTransaction } from '../../lib/database';
import { useInvalidateAllowance } from '../../hooks/useAllowance';
import { tokens } from '../../theme/tokens';

export default function DashboardScreen() {
  const { data: allowance, isLoading } = useAllowance();
  const { data: txs } = useTransactions();
  const qc = useQueryClient();
  const router = useRouter();
  const invalidateAllowance = useInvalidateAllowance();
  const notifiedAlert = useRef(false);
  const notifiedExhausted = useRef(false);
  const [selected, setSelected] = useState<TransactionRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransactionRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  // Fire allowance notifications at most once per app session.
  useEffect(() => {
    if (!allowance) return;
    if (allowance.alertTriggered && !notifiedAlert.current) {
      notifiedAlert.current = true;
      void triggerAllowanceAlert(allowance.remainingAllowance, allowance.allowancePerPeriod);
    }
    if (allowance.overspend && !notifiedExhausted.current) {
      notifiedExhausted.current = true;
      void triggerBudgetExhausted(allowance.remainingAllowance);
    }
  }, [allowance]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator color={tokens.primary} />
      </View>
    );
  }

  const spentPct =
    allowance && allowance.elapsedAllowance > 0
      ? allowance.spendableTotal / allowance.elapsedAllowance
      : 0;
  const isOverspent = allowance?.overspend ?? false;
  const barStatus: 'default' | 'caution' | 'alert' = isOverspent
    ? 'alert'
    : spentPct > 0.8
    ? 'caution'
    : 'default';
  const recentTxs: TransactionRecord[] = (txs ?? []).slice(0, 5);

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Allowance card */}
      <View className="mx-4 mt-5 p-5 bg-white rounded-2xl shadow-sm">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
          Remaining allowance
        </Text>
        <Text
          className={`text-3xl font-bold mb-1 ${isOverspent ? 'text-red-600' : 'text-gray-900'}`}
        >
          {allowance ? formatAmount(allowance.remainingAllowance) : '—'}
        </Text>
        {isOverspent && (
          <Text className="text-xs text-red-500 mb-2">⚠ Over budget this period</Text>
        )}
        <ProgressBar
          progress={spentPct}
          status={barStatus}
          label="Pace"
          sublabel={
            allowance
              ? `R$${allowance.spendableTotal.toFixed(2)} of R$${allowance.elapsedAllowance.toFixed(2)} elapsed`
              : undefined
          }
        />
        <View className="flex-row justify-between mt-4">
          <View>
            <Text className="text-xs text-gray-400">Daily rate</Text>
            <Text className="text-sm font-semibold text-gray-800">
              {allowance ? formatAmount(allowance.dailyRate) : '—'}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-gray-400">Days remaining</Text>
            <Text className="text-sm font-semibold text-gray-800">
              {allowance ? `${Math.round(allowance.daysRemaining)}d` : '—'}
            </Text>
          </View>
        </View>
      </View>

      {/* Recent transactions */}
      <View className="mx-4 mt-4 p-5 bg-white rounded-2xl shadow-sm">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Recent transactions
          </Text>
          <Link href="/transactions" style={{ color: tokens.primary, fontSize: 12, fontWeight: '600' }}>
            See all
          </Link>
        </View>
        {recentTxs.length === 0 ? (
          <Text className="text-sm text-gray-400 text-center py-4">No transactions yet</Text>
        ) : (
          recentTxs.map((tx) => <TransactionRow key={tx.id} tx={tx} onPress={setSelected} />)
        )}
      </View>

      <TransactionDetailModal
        tx={selected}
        onClose={() => setSelected(null)}
        onToggleSelfTransfer={(tx, newType) => {
          void handleToggleSelfTransfer(tx, newType);
        }}
        onEdit={(tx) => {
          setSelected(null);
          router.push({ pathname: '/transaction-edit', params: { id: tx.id } });
        }}
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
    </ScrollView>
  );
}
