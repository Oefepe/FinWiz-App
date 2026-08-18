import { encodePath, VAULT_PATHS } from '../index';

describe('encodePath — vault path URL encoding', () => {
  it('encodes slashes so the full path is a single URL segment', () => {
    expect(encodePath('01-Transactions/2025-04.md')).toBe('01-Transactions%2F2025-04.md');
  });

  it('encodes spaces', () => {
    expect(encodePath('My Notes/file name.md')).toBe('My%20Notes%2Ffile%20name.md');
  });

  it('encodes hash characters', () => {
    expect(encodePath('notes/title#section.md')).toBe('notes%2Ftitle%23section.md');
  });

  it('encodes query-string characters', () => {
    expect(encodePath('notes/q&a.md')).toBe('notes%2Fq%26a.md');
  });

  it('encodes plus signs', () => {
    expect(encodePath('folder/a+b.md')).toBe('folder%2Fa%2Bb.md');
  });

  it('leaves plain filenames unchanged', () => {
    expect(encodePath('goals.md')).toBe('goals.md');
  });

  it('encodes VAULT_PATHS.goals correctly', () => {
    expect(encodePath(VAULT_PATHS.goals)).toBe('00-Profile%2Fgoals.md');
  });

  it('encodes VAULT_PATHS.selfTransferPairs correctly', () => {
    expect(encodePath(VAULT_PATHS.selfTransferPairs)).toBe('04-SelfTransfers%2Fpairs.md');
  });

  it('encodes dynamic transaction month path correctly', () => {
    expect(encodePath(VAULT_PATHS.transactionMonth('2025-04'))).toBe(
      '01-Transactions%2F2025-04.md',
    );
  });

  it('encodes dynamic weekly insight path correctly', () => {
    expect(encodePath(VAULT_PATHS.weeklyInsight('2025-W14'))).toBe(
      '02-Insights%2Fweekly-2025-W14.md',
    );
  });
});
