import tokensJs from './tokens.js';

export interface ThemeTokens {
  primary: string;
  primaryDark: string;
  contrast: string;
  success: string;
  alert: string;
  caution: string;
  neutral100: string;
  inactiveButton: string;
  textPrimary: string;
  textMutedA: string;
  textMutedB: string;
  surface: string;
  iconDark: string;
}

export const tokens: ThemeTokens = tokensJs;
export default tokens;
