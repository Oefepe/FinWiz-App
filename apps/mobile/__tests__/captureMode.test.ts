import * as SecureStore from 'expo-secure-store';
import { getCaptureMode, saveCaptureMode } from '../lib/captureMode';
import { __reset as resetSecureStore } from '../__mocks__/expo-secure-store';

beforeEach(() => {
  resetSecureStore();
});

describe('captureMode', () => {
  it('defaults to automatic when nothing is stored', async () => {
    expect(await getCaptureMode()).toBe('automatic');
  });

  it('round-trips manual_only', async () => {
    await saveCaptureMode('manual_only');
    expect(await getCaptureMode()).toBe('manual_only');
  });

  it('round-trips automatic explicitly', async () => {
    await saveCaptureMode('manual_only');
    await saveCaptureMode('automatic');
    expect(await getCaptureMode()).toBe('automatic');
  });

  it('falls back to automatic for an unrecognized stored value', async () => {
    await SecureStore.setItemAsync('finwiz_capture_mode', 'garbage');
    expect(await getCaptureMode()).toBe('automatic');
  });
});
