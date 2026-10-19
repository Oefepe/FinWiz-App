import type { AllowanceConfig } from './allowanceConfig';
import type { AllowancePeriod } from '@finwiz/allowance-engine';

// Figma's Profile frame exposes exactly five fields: Full Name, Salary,
// Fixed Expenses, Target Save Amount, Allowance Period (Weekly/Monthly).
// Profile owns all *user* data (M14 split) — nothing app/connection-related
// lives here, that's Settings' job.
export interface ProfileForm {
  fullName: string;
  salary: string;
  fixedExpenses: string;
  targetSaveAmount: string;
  period: AllowancePeriod;
}

export interface ProfileValidationError {
  field: keyof ProfileForm;
  message: string;
}

export function configToProfileForm(config: AllowanceConfig, fullName: string): ProfileForm {
  return {
    fullName,
    salary: config.monthlyIncomeEstimate.toFixed(2),
    fixedExpenses: config.fixedMonthlyExpenses.toFixed(2),
    targetSaveAmount: config.savingsGoalAmount.toFixed(2),
    period: config.period,
  };
}

export function validateProfileForm(form: ProfileForm): ProfileValidationError[] {
  const errors: ProfileValidationError[] = [];

  const salary = parseFloat(form.salary.replace(',', '.'));
  if (!form.salary.trim()) {
    errors.push({ field: 'salary', message: 'Salary is required' });
  } else if (isNaN(salary) || salary <= 0) {
    errors.push({ field: 'salary', message: 'Salary must be a positive number' });
  }

  const fixedExpenses = parseFloat(form.fixedExpenses.replace(',', '.'));
  if (!form.fixedExpenses.trim()) {
    errors.push({ field: 'fixedExpenses', message: 'Fixed expenses is required' });
  } else if (isNaN(fixedExpenses) || fixedExpenses < 0) {
    errors.push({ field: 'fixedExpenses', message: 'Fixed expenses cannot be negative' });
  }

  const targetSaveAmount = parseFloat(form.targetSaveAmount.replace(',', '.'));
  if (!form.targetSaveAmount.trim()) {
    errors.push({ field: 'targetSaveAmount', message: 'Target save amount is required' });
  } else if (isNaN(targetSaveAmount) || targetSaveAmount < 0) {
    errors.push({ field: 'targetSaveAmount', message: 'Target save amount cannot be negative' });
  }

  // No period check here: `period` is typed as AllowancePeriod
  // ('weekly' | 'monthly') — the RadioButton UI can't produce any other
  // value, so there's nothing for a runtime check to catch.

  return errors;
}

/** Converts a validated form back into a full config, carrying forward the
 * one field this screen doesn't expose (alertThreshold — owned by Settings'
 * allowance-alert behavior, not user financial data). */
export function profileFormToConfig(form: ProfileForm, original: AllowanceConfig): AllowanceConfig {
  return {
    monthlyIncomeEstimate: parseFloat(form.salary.replace(',', '.')),
    fixedMonthlyExpenses: parseFloat(form.fixedExpenses.replace(',', '.')),
    savingsGoalAmount: parseFloat(form.targetSaveAmount.replace(',', '.')),
    period: form.period,
    alertThreshold: original.alertThreshold,
  };
}

/** Whether any field that feeds the active allowance calculation changed —
 * gates the "Are you sure?" ConfirmDialog per M14-T1. A Full Name-only edit
 * doesn't affect the allowance, so it saves without confirmation. */
export function financialFieldsChanged(form: ProfileForm, original: ProfileForm): boolean {
  return (
    form.salary !== original.salary ||
    form.fixedExpenses !== original.fixedExpenses ||
    form.targetSaveAmount !== original.targetSaveAmount ||
    form.period !== original.period
  );
}

// M14-T6 open question, resolved: switching Allowance Period does NOT need
// an explicit "reset the current cycle" step. allowance-engine's period.ts
// always derives daysInPeriod/daysElapsed from the period *type* (weekly ->
// Monday 00:00 start, monthly -> the 1st) and the current date — there is no
// persisted "cycle start" state anywhere to reset. So a switch takes effect
// on the very next allowance calculation (immediately after save, since this
// screen invalidates the ['allowance'] query), recomputed against the new
// period's own boundary. Nothing to prorate, nothing to reset.
export const PERIOD_SWITCH_BEHAVIOR =
  'immediate — next calculation uses the new period type\'s own start boundary';
