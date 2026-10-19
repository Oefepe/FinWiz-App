import { Platform } from 'react-native';

// Android notification-listener access (reading other apps' notifications).
// Separate from lib/notifications.ts, which is FinWiz posting its own alerts.
// The native module is required lazily so this file is safe to import on iOS.

type ListenerModule = typeof import('@finwiz/notification-listener-android');

function nativeModule(): ListenerModule | null {
  if (Platform.OS !== 'android') return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@finwiz/notification-listener-android') as ListenerModule;
}

export function isNotificationAccessGranted(): boolean {
  return nativeModule()?.isPermissionGranted() ?? false;
}

// Android has no runtime dialog for this access — the system settings page
// is the only way to request it. Callers should re-check on return to the
// foreground.
export function requestNotificationAccess(): void {
  nativeModule()?.openPermissionSettings();
}
