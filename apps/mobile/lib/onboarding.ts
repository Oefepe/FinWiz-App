import * as SecureStore from 'expo-secure-store';

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

export type OnboardingStep =
  | 'welcome'
  | 'vault-setup'
  | 'financial-setup'
  | 'notification-consent' // M19-T2 — Android only, explicit disclosure ahead of the permission prompt
  | 'notification-permission' // Android only
  | 'shortcuts-setup' // iOS only
  | 'bank-selection' // Android only
  | 'self-transfer-hint'
  | 'app-lock-setup' // M17 — replaces the old "create a PIN" slot with a device-lock check
  | 'manual-entry-tutorial';

export type OnboardingPlatform = 'ios' | 'android' | 'other';

const ALL_STEPS: OnboardingStep[] = [
  'welcome',
  'vault-setup',
  'financial-setup',
  'notification-consent',
  'notification-permission',
  'shortcuts-setup',
  'bank-selection',
  'self-transfer-hint',
  'app-lock-setup',
  'manual-entry-tutorial',
];

const ANDROID_ONLY = new Set<OnboardingStep>([
  'notification-consent',
  'notification-permission',
  'bank-selection',
]);
const IOS_ONLY = new Set<OnboardingStep>(['shortcuts-setup']);

// ---------------------------------------------------------------------------
// Pure step-sequencer functions (no side-effects — testable in Node.js)
// ---------------------------------------------------------------------------

export function getStepsForPlatform(platform: OnboardingPlatform): OnboardingStep[] {
  return ALL_STEPS.filter((step) => {
    if (ANDROID_ONLY.has(step)) return platform === 'android';
    if (IOS_ONLY.has(step)) return platform === 'ios';
    return true;
  });
}

export function getNextStep(
  current: OnboardingStep,
  steps: OnboardingStep[],
): OnboardingStep | null {
  const idx = steps.indexOf(current);
  if (idx === -1 || idx >= steps.length - 1) return null;
  return steps[idx + 1] ?? null;
}

export function isLastStep(current: OnboardingStep, steps: OnboardingStep[]): boolean {
  return steps.length > 0 && steps[steps.length - 1] === current;
}

// Returns the first incomplete step; falls back to the first step of the sequence.
export function getResumeStep(
  completedSteps: OnboardingStep[],
  steps: OnboardingStep[],
): OnboardingStep {
  const completed = new Set(completedSteps);
  for (const step of steps) {
    if (!completed.has(step)) return step;
  }
  return steps[0] ?? 'welcome';
}

// ---------------------------------------------------------------------------
// SecureStore persistence helpers
// ---------------------------------------------------------------------------

export const ONBOARDING_COMPLETE_KEY = 'finwiz_onboarding_complete';
export const ONBOARDING_STEPS_KEY = 'finwiz_onboarding_completed_steps';

export async function checkOnboardingComplete(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(ONBOARDING_COMPLETE_KEY);
  return val === '1';
}

export async function markOnboardingComplete(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, '1');
}

export async function getCompletedSteps(): Promise<OnboardingStep[]> {
  const val = await SecureStore.getItemAsync(ONBOARDING_STEPS_KEY);
  if (val === null) return [];
  try {
    return JSON.parse(val) as OnboardingStep[];
  } catch {
    return [];
  }
}

export async function markStepComplete(step: OnboardingStep): Promise<void> {
  const existing = await getCompletedSteps();
  if (!existing.includes(step)) {
    await SecureStore.setItemAsync(
      ONBOARDING_STEPS_KEY,
      JSON.stringify([...existing, step]),
    );
  }
}
