import * as SecureStore from 'expo-secure-store';

// App language preference. Beta scope (M14-T2) is storage + a Settings
// picker only — matches existing chat-prompt locale detection, full i18n
// (translating every screen's copy) is explicitly out of scope for beta.
export const LANGUAGE_KEY = 'finwiz_language';

export type Language = 'pt-BR' | 'en-US';

export async function getLanguage(): Promise<Language> {
  const stored = await SecureStore.getItemAsync(LANGUAGE_KEY);
  return stored === 'pt-BR' ? 'pt-BR' : 'en-US';
}

export async function saveLanguage(language: Language): Promise<void> {
  await SecureStore.setItemAsync(LANGUAGE_KEY, language);
}
