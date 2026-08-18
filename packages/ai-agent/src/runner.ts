import type { AgentRuntime, ToolCall } from './types';
import { getToolDescriptions, executeTool } from './tools';

export const MAX_TURNS = 5;
export const FALLBACK_MESSAGE =
  "I've reached the maximum number of reasoning steps. Please try rephrasing your question.";

const TOOL_CALL_RE = /<tool_call>([\s\S]*?)<\/tool_call>/i;

const TOOL_INSTRUCTIONS = `
To call a tool, include this exact block in your response:
<tool_call>{"tool": "tool_name", "args": {"key": "value"}}</tool_call>

Tool results are returned in <tool_result> tags. Use them to inform your answer.
When you have your final answer, write it directly — no tool_call tags.
`.trim();

function buildInitialPrompt(
  systemPrompt: string,
  userInput: string,
  toolDescriptions: string,
): string {
  return [
    systemPrompt,
    '',
    'Available tools:',
    toolDescriptions,
    '',
    TOOL_INSTRUCTIONS,
    '',
    'User request:',
    userInput,
    '',
    'Response:',
  ].join('\n');
}

export function parseToolCall(text: string): ToolCall | null {
  const match = TOOL_CALL_RE.exec(text);
  if (match === null) return null;
  const raw = match[1];
  if (raw === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(raw.trim());
    if (typeof parsed !== 'object' || parsed === null) return null;
    const p = parsed as { tool?: unknown; args?: unknown };
    if (typeof p.tool !== 'string' || p.tool.length === 0) return null;
    const args =
      typeof p.args === 'object' && p.args !== null && !Array.isArray(p.args)
        ? (p.args as Record<string, string>)
        : {};
    return { tool: p.tool, args };
  } catch {
    return null;
  }
}

export async function runAgent(
  systemPrompt: string,
  userInput: string,
  runtime: AgentRuntime,
): Promise<string> {
  const toolDescriptions = getToolDescriptions();
  let context = buildInitialPrompt(systemPrompt, userInput, toolDescriptions);

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await runtime.llm.generate(context);
    const toolCall = parseToolCall(response);

    if (toolCall === null) {
      return response.trim();
    }

    const toolResult = await executeTool(toolCall, runtime);
    context += response + '\n<tool_result>' + toolResult + '</tool_result>\n';
  }

  return FALLBACK_MESSAGE;
}
