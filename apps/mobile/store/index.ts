import { create } from 'zustand';
import type { GoalsFrontmatter, TransactionTableRow } from '@finwiz/obsidian-client';
import type { AllowanceState as AllowanceEngineState } from '@finwiz/allowance-engine';

// ---------------------------------------------------------------------------
// Slice types
// ---------------------------------------------------------------------------

interface TransactionSlice {
  transactions: TransactionTableRow[];
  isLoadingTransactions: boolean;
  setTransactions: (txs: TransactionTableRow[]) => void;
  setLoadingTransactions: (loading: boolean) => void;
}

interface AllowanceSlice {
  allowanceState: AllowanceEngineState | null;
  setAllowanceState: (state: AllowanceEngineState) => void;
}

interface ProfileSlice {
  goals: GoalsFrontmatter | null;
  ownerName: string;
  setGoals: (goals: GoalsFrontmatter) => void;
}

type AppStore = TransactionSlice & AllowanceSlice & ProfileSlice;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useStore = create<AppStore>()((set) => ({
  // transactionSlice
  transactions: [],
  isLoadingTransactions: false,
  setTransactions: (transactions) => set({ transactions }),
  setLoadingTransactions: (isLoadingTransactions) => set({ isLoadingTransactions }),

  // allowanceSlice
  allowanceState: null,
  setAllowanceState: (allowanceState) => set({ allowanceState }),

  // profileSlice
  goals: null,
  ownerName: '',
  setGoals: (goals) =>
    set({ goals, ownerName: goals.owner_name }),
}));

// ---------------------------------------------------------------------------
// Typed selectors (avoids re-renders by selecting only what's needed)
// ---------------------------------------------------------------------------

export const useTransactions = () => useStore((s) => s.transactions);
export const useAllowanceState = () => useStore((s) => s.allowanceState);
export const useGoals = () => useStore((s) => s.goals);
