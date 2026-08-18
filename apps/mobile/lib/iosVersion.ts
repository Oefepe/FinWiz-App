import { Platform } from 'react-native';

export interface IosVersion {
  major: number;
  minor: number;
}

export function getIosVersion(): IosVersion | null {
  if (Platform.OS !== 'ios') return null;
  const parts = String(Platform.Version).split('.');
  return {
    major: parseInt(parts[0] ?? '0', 10),
    minor: parseInt(parts[1] ?? '0', 10),
  };
}

// iOS < 16.4: Personal Automation shortcuts require a manual confirmation tap
// before running. Onboarding must surface a warning for affected devices.
export function requiresManualConfirmation(): boolean {
  const v = getIosVersion();
  if (v === null) return false;
  return v.major < 16 || (v.major === 16 && v.minor < 4);
}
