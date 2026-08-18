import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { runAgent, answerUserQuestionPrompt } from '@finwiz/ai-agent';
import type { AgentRuntime, LlmBackend } from '@finwiz/ai-agent';
import { useStore } from '../store';
import { queryTransactions, getAllowanceConfig } from '../lib/database';
import { tokens } from '../theme/tokens';
import type { ChatMessage } from '../store';

// ---------------------------------------------------------------------------
// Stub LLM — replaced in M11 with react-native-llama.cpp
// ---------------------------------------------------------------------------

const stubLlm: LlmBackend = {
  generate: async () =>
    'The on-device AI model is not yet installed. ' +
    'Go to Settings → Download Model to set it up during onboarding.',
};

const agentRuntime: AgentRuntime = {
  llm: stubLlm,
  vault: {
    getNote: async () => '',
    listVault: async () => [],
    search: async () => [],
    putNote: async () => {},
    appendNote: async () => {},
  },
  store: {
    queryTransactions,
    getAllowanceConfig,
  },
};

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <View
      className={`mx-4 my-1 max-w-4/5 ${isUser ? 'self-end' : 'self-start'}`}
    >
      <View
        className={`px-4 py-3 rounded-2xl ${
          isUser ? 'bg-purple-600 rounded-br-sm' : 'bg-white rounded-bl-sm shadow-sm'
        }`}
      >
        <Text className={`text-sm leading-5 ${isUser ? 'text-white' : 'text-gray-800'}`}>
          {message.content}
        </Text>
      </View>
      <Text className={`text-xs text-gray-400 mt-0.5 ${isUser ? 'text-right' : 'text-left'} mx-1`}>
        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ChatScreen() {
  const messages = useStore((s) => s.messages);
  const addMessage = useStore((s) => s.addMessage);
  const isThinking = useStore((s) => s.isThinking);
  const setThinking = useStore((s) => s.setThinking);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  async function handleSend() {
    const text = input.trim();
    if (!text || isThinking) return;
    setInput('');
    addMessage('user', text);

    setThinking(true);
    try {
      const answer = await runAgent(
        answerUserQuestionPrompt(),
        text,
        agentRuntime,
      );
      addMessage('assistant', answer);
    } catch {
      addMessage('assistant', 'Something went wrong. Please try again.');
    } finally {
      setThinking(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-50"
      keyboardVerticalOffset={88}
    >
      {messages.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-2xl mb-2">✦</Text>
          <Text className="text-base font-semibold text-gray-700 mb-1">FinWiz Assistant</Text>
          <Text className="text-sm text-gray-400 text-center">
            Ask anything about your finances — spending, allowance, or transactions.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={{ paddingVertical: 12 }}
        />
      )}

      {isThinking && (
        <View className="flex-row items-center mx-5 my-1 self-start bg-white px-4 py-2 rounded-2xl shadow-sm">
          <ActivityIndicator size="small" color={tokens.primary} />
          <Text className="text-xs text-gray-400 ml-2">Thinking…</Text>
        </View>
      )}

      {/* Input bar */}
      <View className="flex-row items-end mx-4 mb-4 mt-2 bg-white rounded-2xl border border-gray-100 px-3 py-2 shadow-sm">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your finances…"
          placeholderTextColor="#9CA3AF"
          multiline
          className="flex-1 text-sm text-gray-800 max-h-28 py-1"
          onSubmitEditing={() => { void handleSend(); }}
        />
        <TouchableOpacity
          onPress={() => { void handleSend(); }}
          disabled={!input.trim() || isThinking}
          className={`ml-2 w-8 h-8 rounded-full items-center justify-center ${
            input.trim() && !isThinking ? 'bg-purple-600' : 'bg-gray-200'
          }`}
        >
          <Text className="text-white text-sm">↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
