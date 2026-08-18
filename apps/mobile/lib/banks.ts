// Single source of truth for the bank checklist shown in onboarding
// (bank-selection.tsx) and Settings (M14-T2) — previously duplicated as a
// literal array in each screen. Package names must stay in sync with
// BANK_PACKAGES in ingestionPipeline.ts (that set stays separate since it's
// an allow-list keyed by package name, not a UI-facing label list).
export interface SupportedBank {
  pkg: string;
  label: string;
}

export const SUPPORTED_BANKS: SupportedBank[] = [
  { pkg: 'com.nu.production', label: 'Nubank' },
  { pkg: 'br.com.intermedium', label: 'Inter' },
  { pkg: 'com.itau', label: 'Itaú' },
  { pkg: 'com.bradesco', label: 'Bradesco' },
  { pkg: 'com.c6bank.app', label: 'C6 Bank' },
  { pkg: 'br.com.santander.benvisavale', label: 'Santander' },
];
