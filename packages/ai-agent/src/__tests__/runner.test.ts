import { runAgent, parseToolCall, MAX_TURNS, FALLBACK_MESSAGE } from '../runner';
import type { AgentRuntime } from '../types';
import type { ObsidianClient } from '@finwiz/obsidian-client';

function makeRuntime(generateResponses: string[]): AgentRuntime {
  let call = 0;
  return {
    llm: {
      generate: jest.fn().mockImplementation(async () => {
        const resp = generateResponses[call];
        call++;
        return resp ?? FALLBACK_MESSAGE;
      }),
    },
    vault: {
      getNote: jest.fn().mockResolvedValue('vault note content'),
      listVault: jest.fn().mockResolvedValue([]),
      search: jest.fn().mockResolvedValue([]),
      putNote: jest.fn().mockResolvedValue(undefined),
      appendNote: jest.fn().mockResolvedValue(undefined),
    } as unknown as ObsidianClient,
    store: {
      queryTransactions: jest.fn().mockResolvedValue([]),
      getAllowanceConfig: jest.fn().mockResolvedValue({
        monthlyIncomeEstimate: 5000,
        fixedMonthlyExpenses: 0,
        savingsGoalAmount: 1000,
        period: 'monthly' as const,
        alertThreshold: 0.2,
      }),
    },
  };
}

// ── parseToolCall ──────────────────────────────────────────────────────────────

describe('parseToolCall', () => {
  it('returns null when no tool_call tag is present', () => {
    expect(parseToolCall('Just a plain answer.')).toBeNull();
  });

  it('parses a valid inline tool call', () => {
    const result = parseToolCall(
      'I need to check something. <tool_call>{"tool":"read_note","args":{"path":"goals.md"}}</tool_call>',
    );
    expect(result).toEqual({ tool: 'read_note', args: { path: 'goals.md' } });
  });

  it('parses a multi-line tool call', () => {
    const result = parseToolCall(
      '<tool_call>\n{"tool":"query_transactions","args":{"month":"2025-04"}}\n</tool_call>',
    );
    expect(result).toEqual({
      tool: 'query_transactions',
      args: { month: '2025-04' },
    });
  });

  it('returns null for invalid JSON inside tag', () => {
    expect(parseToolCall('<tool_call>not json</tool_call>')).toBeNull();
  });

  it('returns null when tool field is missing', () => {
    expect(parseToolCall('<tool_call>{"args":{}}</tool_call>')).toBeNull();
  });

  it('returns null when tool field is empty string', () => {
    expect(parseToolCall('<tool_call>{"tool":"","args":{}}</tool_call>')).toBeNull();
  });

  it('defaults args to {} when args field is missing', () => {
    const result = parseToolCall('<tool_call>{"tool":"get_allowance_status"}</tool_call>');
    expect(result).toEqual({ tool: 'get_allowance_status', args: {} });
  });
});

// ── runAgent ──────────────────────────────────────────────────────────────────

describe('runAgent', () => {
  it('returns final answer immediately when no tool call in first response', async () => {
    const runtime = makeRuntime(['The answer is 42.']);
    const result = await runAgent('system', 'user question', runtime);
    expect(result).toBe('The answer is 42.');
    expect((runtime.llm.generate as jest.Mock)).toHaveBeenCalledTimes(1);
  });

  it('caps loop at exactly MAX_TURNS and returns FALLBACK_MESSAGE', async () => {
    // Every response contains a tool call → loop always continues.
    const toolCallResponse =
      '<tool_call>{"tool":"read_note","args":{"path":"test.md"}}</tool_call>';
    const runtime = makeRuntime(Array(MAX_TURNS).fill(toolCallResponse));
    const result = await runAgent('system', 'user question', runtime);
    expect(result).toBe(FALLBACK_MESSAGE);
    expect((runtime.llm.generate as jest.Mock)).toHaveBeenCalledTimes(MAX_TURNS);
  });

  it('MAX_TURNS is 5', () => {
    expect(MAX_TURNS).toBe(5);
  });

  it('dispatches a tool call and appends result to context before next turn', async () => {
    const firstResponse =
      '<tool_call>{"tool":"read_note","args":{"path":"goals.md"}}</tool_call>';
    const finalAnswer = 'Here is your answer based on the note.';
    const runtime = makeRuntime([firstResponse, finalAnswer]);

    const result = await runAgent('system', 'what is my goal?', runtime);

    expect(result).toBe(finalAnswer);
    expect((runtime.llm.generate as jest.Mock)).toHaveBeenCalledTimes(2);
    // Second call context must include the tool result.
    const secondCallArg = (runtime.llm.generate as jest.Mock).mock.calls[1]?.[0] as string;
    expect(secondCallArg).toContain('<tool_result>');
    expect(secondCallArg).toContain('vault note content');
  });

  it('gracefully handles invalid JSON inside tool_call tag — treats as final answer', async () => {
    const badToolCall = '<tool_call>not valid json</tool_call>';
    const runtime = makeRuntime([badToolCall]);
    const result = await runAgent('system', 'question', runtime);
    // parseToolCall returns null → runner returns the raw text as final answer
    expect(result).toBe(badToolCall.trim());
    expect((runtime.llm.generate as jest.Mock)).toHaveBeenCalledTimes(1);
  });

  it('unknown tool name returns an error in context and continues', async () => {
    const unknownTool =
      '<tool_call>{"tool":"nonexistent_tool","args":{}}</tool_call>';
    const finalAnswer = 'Fallback answer.';
    const runtime = makeRuntime([unknownTool, finalAnswer]);

    const result = await runAgent('system', 'question', runtime);

    expect(result).toBe(finalAnswer);
    const secondCallArg = (runtime.llm.generate as jest.Mock).mock.calls[1]?.[0] as string;
    expect(secondCallArg).toContain('Error: unknown tool "nonexistent_tool"');
  });

  it('trims whitespace from final answer', async () => {
    const runtime = makeRuntime(['   answer with spaces   ']);
    const result = await runAgent('system', 'question', runtime);
    expect(result).toBe('answer with spaces');
  });
});
