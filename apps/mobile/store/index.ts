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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AgentSlice {
  messages: ChatMessage[];
  isThinking: boolean;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  setThinking: (thinking: boolean) => void;
  clearMessages: () => void;
}

type AppStore = TransactionSlice & AllowanceSlice & ProfileSlice & AgentSlice;

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

  // agentSlice
  messages: [],
  isThinking: false,
  addMessage: (role, content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: Math.random().toString(36).slice(2),
          role,
          content,
          timestamp: Date.now(),
        },
      ],
    })),
  setThinking: (isThinking) => set({ isThinking }),
  clearMessages: () => set({ messages: [] }),
}));

// ---------------------------------------------------------------------------
// Typed selectors (avoids re-renders by selecting only what's needed)
// ---------------------------------------------------------------------------

export const useTransactions = () => useStore((s) => s.transactions);
export const useAllowanceState = () => useStore((s) => s.allowanceState);
export const useGoals = () => useStore((s) => s.goals);
export const useChatMessages = () => useStore((s) => s.messages);
export const useIsThinking = () => useStore((s) => s.isThinking);
