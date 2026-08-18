import * as SecureStore from 'expo-secure-store';
import { getLanguage, saveLanguage } from '../lib/language';
import { __reset as resetSecureStore } from '../__mocks__/expo-secure-store';

beforeEach(() => {
  resetSecureStore();
});

describe('language', () => {
  it('defaults to en-US when nothing is stored', async () => {
    expect(await getLanguage()).toBe('en-US');
  });

  it('round-trips pt-BR', async () => {
    await saveLanguage('pt-BR');
    expect(await getLanguage()).toBe('pt-BR');
  });

  it('round-trips en-US explicitly', async () => {
    await saveLanguage('pt-BR');
    await saveLanguage('en-US');
    expect(await getLanguage()).toBe('en-US');
  });

  it('falls back to en-US for an unrecognized stored value', async () => {
    await SecureStore.setItemAsync('finwiz_language', 'garbage');
    expect(await getLanguage()).toBe('en-US');
  });
});
