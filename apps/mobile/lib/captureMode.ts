import * as SecureStore from 'expo-secure-store';

// Whether automated notification capture (Android listener / iOS Shortcuts
// deep-link ingest) is allowed to persist transactions. Manual Entry (the
// FAB) always stays available regardless of this setting — FinWiz.md
// requires manual entry as a permanent fallback on all platforms.
export const CAPTURE_MODE_KEY = 'finwiz_capture_mode';

export type CaptureMode = 'automatic' | 'manual_only';

export async function getCaptureMode(): Promise<CaptureMode> {
  const stored = await SecureStore.getItemAsync(CAPTURE_MODE_KEY);
  return stored === 'manual_only' ? 'manual_only' : 'automatic';
}

export async function saveCaptureMode(mode: CaptureMode): Promise<void> {
  await SecureStore.setItemAsync(CAPTURE_MODE_KEY, mode);
}
