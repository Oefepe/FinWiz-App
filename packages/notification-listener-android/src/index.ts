import { requireNativeModule, EventEmitter, NativeModule } from 'expo-modules-core';

export interface RawNotificationEvent {
  appPackage: string;
  title: string;
  body: string;
  timestamp: number; // Unix ms
}

export type NotificationSubscription = { remove: () => void };

interface FinWizNotificationListenerModule extends InstanceType<typeof NativeModule> {
  isPermissionGranted(): boolean;
  openPermissionSettings(): void;
  setAllowedPackages(packages: string[]): void;
}

const nativeModule = requireNativeModule<FinWizNotificationListenerModule>(
  'FinWizNotificationListener',
);
const emitter = new EventEmitter(nativeModule);

/** Returns true if the notification listener permission is granted. */
export function isPermissionGranted(): boolean {
  return nativeModule.isPermissionGranted();
}

/** Opens Android notification listener settings so the user can grant permission. */
export function openPermissionSettings(): void {
  nativeModule.openPermissionSettings();
}

/**
 * Restrict which app packages the native service forwards to JS.
 * Pass an empty array to forward all packages (default).
 */
export function setAllowedPackages(packages: string[]): void {
  nativeModule.setAllowedPackages(packages);
}

/** Subscribe to incoming notifications forwarded by the native service. */
export function addNotificationListener(
  listener: (event: RawNotificationEvent) => void,
): NotificationSubscription {
  return emitter.addListener<RawNotificationEvent>('onNotification', listener);
}
