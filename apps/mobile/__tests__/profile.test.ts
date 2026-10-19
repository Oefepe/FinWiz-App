import {
  configToProfileForm,
  validateProfileForm,
  profileFormToConfig,
  financialFieldsChanged,
  type ProfileForm,
} from '../lib/profile';
import type { AllowanceConfig } from '../lib/allowanceConfig';

const BASE_CONFIG: AllowanceConfig = {
  monthlyIncomeEstimate: 5000,
  fixedMonthlyExpenses: 1200.5,
  savingsGoalAmount: 800,
  period: 'monthly',
  alertThreshold: 0.2,
};

function baseForm(): ProfileForm {
  return {
    fullName: 'João Silva',
    salary: '5000.00',
    fixedExpenses: '1200.50',
    targetSaveAmount: '800.00',
    period: 'monthly',
  };
}

describe('configToProfileForm', () => {
  it('formats the config as currency strings and carries the given name', () => {
    expect(configToProfileForm(BASE_CONFIG, 'João Silva')).toEqual({
      fullName: 'João Silva',
      salary: '5000.00',
      fixedExpenses: '1200.50',
      targetSaveAmount: '800.00',
      period: 'monthly',
    });
  });

  it('accepts an empty name (Full Name is optional, same as onboarding)', () => {
    expect(configToProfileForm(BASE_CONFIG, '').fullName).toBe('');
  });

  it('carries a weekly period through unchanged', () => {
    expect(configToProfileForm({ ...BASE_CONFIG, period: 'weekly' }, '').period).toBe('weekly');
  });
});

describe('validateProfileForm', () => {
  it('passes for a fully valid form', () => {
    expect(validateProfileForm(baseForm())).toEqual([]);
  });

  it('passes with an empty full name (optional field)', () => {
    expect(validateProfileForm({ ...baseForm(), fullName: '' })).toEqual([]);
  });

  it('rejects a missing salary', () => {
    const errors = validateProfileForm({ ...baseForm(), salary: '' });
    expect(errors.map((e) => e.field)).toContain('salary');
  });

  it('rejects a zero or negative salary', () => {
    expect(validateProfileForm({ ...baseForm(), salary: '0' }).map((e) => e.field)).toContain('salary');
    expect(validateProfileForm({ ...baseForm(), salary: '-100' }).map((e) => e.field)).toContain('salary');
  });

  it('rejects a non-numeric salary', () => {
    expect(validateProfileForm({ ...baseForm(), salary: 'abc' }).map((e) => e.field)).toContain('salary');
  });

  it('allows zero fixed expenses (no fixed expenses is valid)', () => {
    expect(validateProfileForm({ ...baseForm(), fixedExpenses: '0' })).toEqual([]);
  });

  it('rejects negative fixed expenses', () => {
    expect(
      validateProfileForm({ ...baseForm(), fixedExpenses: '-5' }).map((e) => e.field),
    ).toContain('fixedExpenses');
  });

  it('rejects a missing fixed expenses value', () => {
    expect(validateProfileForm({ ...baseForm(), fixedExpenses: '' }).map((e) => e.field)).toContain(
      'fixedExpenses',
    );
  });

  it('allows zero target save amount', () => {
    expect(validateProfileForm({ ...baseForm(), targetSaveAmount: '0' })).toEqual([]);
  });

  it('rejects a negative target save amount', () => {
    expect(
      validateProfileForm({ ...baseForm(), targetSaveAmount: '-1' }).map((e) => e.field),
    ).toContain('targetSaveAmount');
  });

  it('rejects a missing target save amount', () => {
    expect(
      validateProfileForm({ ...baseForm(), targetSaveAmount: '' }).map((e) => e.field),
    ).toContain('targetSaveAmount');
  });
});

describe('profileFormToConfig', () => {
  it('parses form strings into a numeric AllowanceConfig', () => {
    expect(profileFormToConfig(baseForm(), BASE_CONFIG)).toEqual({
      monthlyIncomeEstimate: 5000,
      fixedMonthlyExpenses: 1200.5,
      savingsGoalAmount: 800,
      period: 'monthly',
      alertThreshold: 0.2,
    });
  });

  it('carries the original alertThreshold forward unchanged (not a Profile field)', () => {
    const withHigherThreshold = { ...BASE_CONFIG, alertThreshold: 0.5 };
    expect(profileFormToConfig(baseForm(), withHigherThreshold).alertThreshold).toBe(0.5);
  });

  it('supports comma decimal separators (pt-BR input)', () => {
    const form = { ...baseForm(), salary: '5000,00', fixedExpenses: '1200,50' };
    const config = profileFormToConfig(form, BASE_CONFIG);
    expect(config.monthlyIncomeEstimate).toBe(5000);
    expect(config.fixedMonthlyExpenses).toBe(1200.5);
  });

  it('reflects a period switch in the output config', () => {
    const form = { ...baseForm(), period: 'weekly' as const };
    expect(profileFormToConfig(form, BASE_CONFIG).period).toBe('weekly');
  });
});

describe('financialFieldsChanged', () => {
  it('returns false when nothing changed', () => {
    expect(financialFieldsChanged(baseForm(), baseForm())).toBe(false);
  });

  it('returns false when only the full name changed', () => {
    const edited = { ...baseForm(), fullName: 'Maria Souza' };
    expect(financialFieldsChanged(edited, baseForm())).toBe(false);
  });

  it('returns true when salary changed', () => {
    const edited = { ...baseForm(), salary: '6000.00' };
    expect(financialFieldsChanged(edited, baseForm())).toBe(true);
  });

  it('returns true when fixed expenses changed', () => {
    const edited = { ...baseForm(), fixedExpenses: '1500.00' };
    expect(financialFieldsChanged(edited, baseForm())).toBe(true);
  });

  it('returns true when target save amount changed', () => {
    const edited = { ...baseForm(), targetSaveAmount: '900.00' };
    expect(financialFieldsChanged(edited, baseForm())).toBe(true);
  });

  it('returns true when the period changed', () => {
    const edited = { ...baseForm(), period: 'weekly' as const };
    expect(financialFieldsChanged(edited, baseForm())).toBe(true);
  });
});
