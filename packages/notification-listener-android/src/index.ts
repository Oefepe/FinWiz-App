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
  startListening(packages: string[]): boolean;
  stopListening(): void;
  isListening(): boolean;
  drainPendingNotifications(): RawNotificationEvent[];
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

/**
 * Opens Android notification listener settings so the user can grant
 * permission. Android has no runtime prompt for this access — the system
 * settings screen is the only way to request it.
 */
export function openPermissionSettings(): void {
  nativeModule.openPermissionSettings();
}

/**
 * Asks the native service to start watching notifications from `packages`.
 * Persisted natively, so watching continues across process restarts until
 * stopListening() — notifications arriving while JS isn't attached are
 * queued and returned by drainPendingNotifications().
 *
 * Returns false if notification access hasn't been granted yet (the request
 * is still saved and takes effect as soon as it is).
 */
export function startListening(packages: string[]): boolean {
  return nativeModule.startListening(packages);
}

/** Stops watching and discards any queued notifications. */
export function stopListening(): void {
  nativeModule.stopListening();
}

/** True if the app has asked the native service to watch notifications. */
export function isListening(): boolean {
  return nativeModule.isListening();
}

/** Returns, and clears, notifications queued while the app wasn't running. */
export function drainPendingNotifications(): RawNotificationEvent[] {
  return nativeModule.drainPendingNotifications();
}

/**
 * Restrict which app packages the native service forwards to JS.
 * Pass an empty array to forward all packages live (nothing is queued).
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
