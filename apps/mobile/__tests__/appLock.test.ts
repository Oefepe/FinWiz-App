import * as SecureStore from 'expo-secure-store';
import { __reset as resetSecureStore } from '../__mocks__/expo-secure-store';

const getEnrolledLevelAsyncMock = jest.fn();
const authenticateAsyncMock = jest.fn();

jest.mock('expo-local-authentication', () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  getEnrolledLevelAsync: (...args: unknown[]) => getEnrolledLevelAsyncMock(...args),
  authenticateAsync: (...args: unknown[]) => authenticateAsyncMock(...args),
}));

import {
  getAppLockTimeout,
  saveAppLockTimeout,
  getDeviceSecurityLevel,
  hasNoDeviceLock,
  authenticateDevice,
  SecurityLevel,
  APP_LOCK_TIMEOUT_MS,
} from '../lib/appLock';

beforeEach(() => {
  resetSecureStore();
  jest.clearAllMocks();
});

describe('getAppLockTimeout / saveAppLockTimeout', () => {
  it('defaults to 30s when nothing is stored', async () => {
    expect(await getAppLockTimeout()).toBe('30s');
  });

  it('round-trips "immediately"', async () => {
    await saveAppLockTimeout('immediately');
    expect(await getAppLockTimeout()).toBe('immediately');
  });

  it('round-trips "5min"', async () => {
    await saveAppLockTimeout('5min');
    expect(await getAppLockTimeout()).toBe('5min');
  });

  it('falls back to 30s for an unrecognized stored value', async () => {
    await SecureStore.setItemAsync('finwiz_app_lock_timeout', 'garbage');
    expect(await getAppLockTimeout()).toBe('30s');
  });
});

describe('APP_LOCK_TIMEOUT_MS', () => {
  it('maps each timeout option to the correct millisecond value', () => {
    expect(APP_LOCK_TIMEOUT_MS.immediately).toBe(0);
    expect(APP_LOCK_TIMEOUT_MS['30s']).toBe(30_000);
    expect(APP_LOCK_TIMEOUT_MS['5min']).toBe(300_000);
  });
});

describe('getDeviceSecurityLevel', () => {
  it('delegates to expo-local-authentication.getEnrolledLevelAsync', async () => {
    getEnrolledLevelAsyncMock.mockResolvedValue(SecurityLevel.BIOMETRIC_STRONG);
    expect(await getDeviceSecurityLevel()).toBe(SecurityLevel.BIOMETRIC_STRONG);
  });
});

describe('hasNoDeviceLock', () => {
  it('is true for SecurityLevel.NONE', () => {
    expect(hasNoDeviceLock(SecurityLevel.NONE)).toBe(true);
  });

  it('is false for SECRET (PIN/pattern/passcode with no biometric) — a valid enrolled level', () => {
    expect(hasNoDeviceLock(SecurityLevel.SECRET)).toBe(false);
  });

  it('is false for BIOMETRIC_WEAK', () => {
    expect(hasNoDeviceLock(SecurityLevel.BIOMETRIC_WEAK)).toBe(false);
  });

  it('is false for BIOMETRIC_STRONG', () => {
    expect(hasNoDeviceLock(SecurityLevel.BIOMETRIC_STRONG)).toBe(false);
  });
});

describe('authenticateDevice', () => {
  it('returns true on a successful authentication result', async () => {
    authenticateAsyncMock.mockResolvedValue({ success: true });
    expect(await authenticateDevice()).toBe(true);
  });

  it('returns false on a failed/cancelled authentication result', async () => {
    authenticateAsyncMock.mockResolvedValue({ success: false, error: 'user_cancel' });
    expect(await authenticateDevice()).toBe(false);
  });

  it('allows device-passcode fallback (disableDeviceFallback: false) rather than biometric-only', async () => {
    authenticateAsyncMock.mockResolvedValue({ success: true });
    await authenticateDevice();
    expect(authenticateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({ disableDeviceFallback: false }),
    );
  });

  it('passes a custom prompt message through', async () => {
    authenticateAsyncMock.mockResolvedValue({ success: true });
    await authenticateDevice('Unlock to view transactions');
    expect(authenticateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({ promptMessage: 'Unlock to view transactions' }),
    );
  });
});
