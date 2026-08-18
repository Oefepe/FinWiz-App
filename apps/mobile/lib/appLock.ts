import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

// M17 — App Lock via Device Authentication.
//
// Real, verified constraint that changed this milestone's design from the
// plan's original text: the installed expo-secure-store (13.0.2) hard-
// requires biometric enrollment for its `requireAuthentication` option on
// BOTH platforms (checked its actual native source —
// ios/SecureStoreModule.swift uses SecAccessControlCreateFlags.biometryCurrentSet
// with no `.or(.devicePasscode)`; android/.../AuthenticationHelper.kt's
// assertBiometricsSupport() throws "No biometrics are currently enrolled"
// outright). Neither falls back to device PIN/pattern/passcode. Wrapping
// the M16 DB key with that option would lock out any user who has only a
// device passcode set — directly contradicting this milestone's own goal
// ("whatever the user already has enrolled").
//
// Resolution (session decision): use `expo-local-authentication`'s
// `authenticateAsync()` as the app-entry gate instead — it supports both
// biometric AND device-passcode authentication out of the box
// (`disableDeviceFallback: false`, the default, maps to iOS's
// LAPolicyDeviceOwnerAuthentication policy, not the biometric-only one).
// The M16 DB key stays in SecureStore *without* `requireAuthentication` —
// this app-level gate controls when the app *uses* the key, not a
// hardware-enforced cryptographic gate on the key itself. Real tradeoff,
// stated plainly: this doesn't defend against someone extracting the
// Keychain/Keystore directly from a jailbroken/rooted device the way true
// crypto-gating would. See the M17 plan notes for the full reasoning and
// the alternative that was turned down.

export type AppLockTimeout = 'immediately' | '30s' | '5min';

const APP_LOCK_TIMEOUT_KEY = 'finwiz_app_lock_timeout';
const DEFAULT_TIMEOUT: AppLockTimeout = '30s';

export const APP_LOCK_TIMEOUT_MS: Record<AppLockTimeout, number> = {
  immediately: 0,
  '30s': 30_000,
  '5min': 5 * 60_000,
};

export async function getAppLockTimeout(): Promise<AppLockTimeout> {
  const stored = await SecureStore.getItemAsync(APP_LOCK_TIMEOUT_KEY);
  if (stored === 'immediately' || stored === '30s' || stored === '5min') {
    return stored;
  }
  return DEFAULT_TIMEOUT;
}

export async function saveAppLockTimeout(timeout: AppLockTimeout): Promise<void> {
  await SecureStore.setItemAsync(APP_LOCK_TIMEOUT_KEY, timeout);
}

// Re-exported so callers don't need a second import from
// 'expo-local-authentication' just for the enum.
export const SecurityLevel = LocalAuthentication.SecurityLevel;
export type SecurityLevel = LocalAuthentication.SecurityLevel;

export async function getDeviceSecurityLevel(): Promise<SecurityLevel> {
  return LocalAuthentication.getEnrolledLevelAsync();
}

// True only when the device has no lock screen configured at all — no PIN,
// pattern, passcode, or biometric. `SecurityLevel.SECRET` (PIN/pattern/
// passcode with no biometric) is a fully valid, non-blocking level.
export function hasNoDeviceLock(level: SecurityLevel): boolean {
  return level === LocalAuthentication.SecurityLevel.NONE;
}

export async function authenticateDevice(
  promptMessage = 'Unlock FinWiz',
): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    disableDeviceFallback: false, // allow device passcode, not biometric-only
  });
  return result.success;
}
