// iOS has no equivalent of Android's NotificationListenerService — automated
// capture happens via the Shortcuts deep link in app/ingest.tsx instead, not
// a running listener. This stub exists so app/_layout.tsx can call
// useNotificationListener() unconditionally without pulling in
// @finwiz/notification-listener-android, whose native module doesn't exist
// on this platform.
export function useNotificationListener(): void {
  // no-op on iOS
}
