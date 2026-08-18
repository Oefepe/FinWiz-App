import {
  getStepsForPlatform,
  getNextStep,
  isLastStep,
  getResumeStep,
  checkOnboardingComplete,
  markOnboardingComplete,
  getCompletedSteps,
  markStepComplete,
  type OnboardingStep,
} from '../lib/onboarding';
import { __reset as resetSecureStore } from '../__mocks__/expo-secure-store';

// ---------------------------------------------------------------------------
// T12 — Onboarding state machine
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetSecureStore();
});

// ---------------------------------------------------------------------------
// getStepsForPlatform
// ---------------------------------------------------------------------------

describe('getStepsForPlatform', () => {
  it('ios: includes shortcuts-setup, excludes notification-permission and bank-selection', () => {
    const steps = getStepsForPlatform('ios');
    expect(steps).toContain('shortcuts-setup');
    expect(steps).not.toContain('notification-permission');
    expect(steps).not.toContain('bank-selection');
  });

  it('android: includes notification-consent, notification-permission and bank-selection, excludes shortcuts-setup', () => {
    const steps = getStepsForPlatform('android');
    expect(steps).toContain('notification-consent');
    expect(steps).toContain('notification-permission');
    expect(steps).toContain('bank-selection');
    expect(steps).not.toContain('shortcuts-setup');
  });

  it('other: excludes all platform-specific steps', () => {
    const steps = getStepsForPlatform('other');
    expect(steps).not.toContain('notification-consent');
    expect(steps).not.toContain('notification-permission');
    expect(steps).not.toContain('bank-selection');
    expect(steps).not.toContain('shortcuts-setup');
  });

  it('all platforms: includes common steps', () => {
    const common: OnboardingStep[] = [
      'welcome',
      'vault-setup',
      'financial-setup',
      'self-transfer-hint',
      'app-lock-setup',
      'manual-entry-tutorial',
    ];
    for (const platform of ['ios', 'android', 'other'] as const) {
      const steps = getStepsForPlatform(platform);
      for (const step of common) {
        expect(steps).toContain(step);
      }
    }
  });

  it('manual-entry-tutorial is always last', () => {
    for (const platform of ['ios', 'android', 'other'] as const) {
      const steps = getStepsForPlatform(platform);
      expect(steps[steps.length - 1]).toBe('manual-entry-tutorial');
    }
  });

  it('app-lock-setup (M17) is always the step right before manual-entry-tutorial', () => {
    for (const platform of ['ios', 'android', 'other'] as const) {
      const steps = getStepsForPlatform(platform);
      expect(steps[steps.length - 2]).toBe('app-lock-setup');
    }
  });
});

// ---------------------------------------------------------------------------
// getNextStep
// ---------------------------------------------------------------------------

describe('getNextStep', () => {
  const STEPS = getStepsForPlatform('other');

  it('returns the step after welcome', () => {
    expect(getNextStep('welcome', STEPS)).toBe('vault-setup');
  });

  it('returns null for the last step', () => {
    expect(getNextStep('manual-entry-tutorial', STEPS)).toBeNull();
  });

  it('returns null for a step not in the list', () => {
    // 'shortcuts-setup' is not in 'other' platform steps
    expect(getNextStep('shortcuts-setup', STEPS)).toBeNull();
  });

  it('returns vault-setup after welcome in android steps', () => {
    const android = getStepsForPlatform('android');
    expect(getNextStep('welcome', android)).toBe('vault-setup');
  });

  it('notification-permission → bank-selection on android', () => {
    const android = getStepsForPlatform('android');
    expect(getNextStep('notification-permission', android)).toBe('bank-selection');
  });

  it('notification-consent (M19-T2) is the step right before notification-permission on android', () => {
    const android = getStepsForPlatform('android');
    expect(getNextStep('notification-consent', android)).toBe('notification-permission');
  });

  it('notification-consent is unreachable (returns null) on non-android platforms', () => {
    for (const platform of ['ios', 'other'] as const) {
      expect(getNextStep('notification-consent', getStepsForPlatform(platform))).toBeNull();
    }
  });

  it('self-transfer-hint → app-lock-setup → manual-entry-tutorial (M17 slot)', () => {
    expect(getNextStep('self-transfer-hint', STEPS)).toBe('app-lock-setup');
    expect(getNextStep('app-lock-setup', STEPS)).toBe('manual-entry-tutorial');
  });
});

// ---------------------------------------------------------------------------
// isLastStep
// ---------------------------------------------------------------------------

describe('isLastStep', () => {
  const STEPS = getStepsForPlatform('other');

  it('returns true for manual-entry-tutorial', () => {
    expect(isLastStep('manual-entry-tutorial', STEPS)).toBe(true);
  });

  it('returns false for welcome', () => {
    expect(isLastStep('welcome', STEPS)).toBe(false);
  });

  it('returns false for a middle step', () => {
    expect(isLastStep('vault-setup', STEPS)).toBe(false);
  });

  it('returns false for an empty steps array', () => {
    expect(isLastStep('welcome', [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getResumeStep
// ---------------------------------------------------------------------------

describe('getResumeStep', () => {
  const STEPS = getStepsForPlatform('android');

  it('returns welcome when nothing is completed', () => {
    expect(getResumeStep([], STEPS)).toBe('welcome');
  });

  it('returns the first incomplete step when partially complete', () => {
    const completed: OnboardingStep[] = ['welcome', 'vault-setup'];
    expect(getResumeStep(completed, STEPS)).toBe('financial-setup');
  });

  it('returns the first step when all steps are completed (wrap-around safeguard)', () => {
    // All steps completed — should return the first step as a safe default.
    expect(getResumeStep(STEPS, STEPS)).toBe(STEPS[0]);
  });

  it('respects platform-specific steps in the completion check', () => {
    const iosSteps = getStepsForPlatform('ios');
    const partialIos: OnboardingStep[] = ['welcome', 'vault-setup', 'financial-setup'];
    expect(getResumeStep(partialIos, iosSteps)).toBe('shortcuts-setup');
  });
});

// ---------------------------------------------------------------------------
// SecureStore helpers
// ---------------------------------------------------------------------------

describe('checkOnboardingComplete / markOnboardingComplete', () => {
  it('returns false initially', async () => {
    await expect(checkOnboardingComplete()).resolves.toBe(false);
  });

  it('returns true after markOnboardingComplete', async () => {
    await markOnboardingComplete();
    await expect(checkOnboardingComplete()).resolves.toBe(true);
  });

  it('returns false again after store reset', async () => {
    await markOnboardingComplete();
    resetSecureStore();
    await expect(checkOnboardingComplete()).resolves.toBe(false);
  });
});

describe('getCompletedSteps / markStepComplete', () => {
  it('returns empty array initially', async () => {
    await expect(getCompletedSteps()).resolves.toEqual([]);
  });

  it('stores a completed step', async () => {
    await markStepComplete('welcome');
    await expect(getCompletedSteps()).resolves.toContain('welcome');
  });

  it('does not duplicate a step marked twice', async () => {
    await markStepComplete('welcome');
    await markStepComplete('welcome');
    const steps = await getCompletedSteps();
    expect(steps.filter((s) => s === 'welcome')).toHaveLength(1);
  });

  it('accumulates multiple distinct steps in order', async () => {
    await markStepComplete('welcome');
    await markStepComplete('vault-setup');
    await markStepComplete('financial-setup');
    const steps = await getCompletedSteps();
    expect(steps).toEqual(['welcome', 'vault-setup', 'financial-setup']);
  });
});

// ---------------------------------------------------------------------------
// Resume mid-onboarding integration
// ---------------------------------------------------------------------------

describe('mid-onboarding resume', () => {
  it('resumes at the correct step after completing welcome through financial-setup', async () => {
    const completedSoFar: OnboardingStep[] = [
      'welcome',
      'vault-setup',
      'financial-setup',
    ];
    for (const step of completedSoFar) {
      await markStepComplete(step);
    }

    const stored = await getCompletedSteps();
    const androidSteps = getStepsForPlatform('android');
    expect(getResumeStep(stored, androidSteps)).toBe('notification-consent');
  });

  it('resumes at notification-permission after also completing notification-consent (M19-T2)', async () => {
    const completedSoFar: OnboardingStep[] = [
      'welcome',
      'vault-setup',
      'financial-setup',
      'notification-consent',
    ];
    for (const step of completedSoFar) {
      await markStepComplete(step);
    }

    const stored = await getCompletedSteps();
    const androidSteps = getStepsForPlatform('android');
    expect(getResumeStep(stored, androidSteps)).toBe('notification-permission');
  });
});
