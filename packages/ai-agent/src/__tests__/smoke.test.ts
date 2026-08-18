import {
  bootstrapPrompt,
  classifyTransactionPrompt,
  detectSelfTransferPrompt,
  generateWeeklySummaryPrompt,
  answerUserQuestionPrompt,
} from '../index';
import { getToolDescriptions, TOOLS } from '../tools';

describe('prompt templates', () => {
  it('bootstrapPrompt returns a non-empty string containing the YAML schema', () => {
    const p = bootstrapPrompt();
    expect(p.length).toBeGreaterThan(0);
    expect(p).toContain('savings_goal_amount');
    expect(p).toContain('monthly_income_estimate');
  });

  it('classifyTransactionPrompt includes the self-transfer shortcut rule', () => {
    const p = classifyTransactionPrompt();
    expect(p).toContain('SELF_TRANSFER_OUT');
    expect(p).toContain('self_transfer');
  });

  it('detectSelfTransferPrompt mentions the bias rule', () => {
    const p = detectSelfTransferPrompt();
    expect(p).toContain('false negatives');
    expect(p).toContain('is_self_transfer');
  });

  it('generateWeeklySummaryPrompt mentions self-transfer exclusion and 400 word limit', () => {
    const p = generateWeeklySummaryPrompt();
    expect(p).toContain('SELF_TRANSFER');
    expect(p).toContain('400');
  });

  it('answerUserQuestionPrompt mentions language detection', () => {
    const p = answerUserQuestionPrompt();
    expect(p).toContain('pt-BR');
    expect(p).toContain('en-US');
  });
});

describe('tool registry', () => {
  it('registers all 6 tools', () => {
    const names = Object.keys(TOOLS);
    expect(names).toContain('read_note');
    expect(names).toContain('write_note');
    expect(names).toContain('append_note');
    expect(names).toContain('query_transactions');
    expect(names).toContain('get_allowance_status');
    expect(names).toContain('detect_self_transfer');
    expect(names).toHaveLength(6);
  });

  it('getToolDescriptions returns a non-empty string', () => {
    const desc = getToolDescriptions();
    expect(desc.length).toBeGreaterThan(0);
    expect(desc).toContain('read_note');
  });
});
