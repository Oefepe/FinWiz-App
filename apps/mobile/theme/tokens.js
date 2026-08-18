// Canonical color palette — extracted from the PadLock Figma file (Assets page
// component sets: Button, Header, Text, ProgressBar, Input, BottomNavigation).
// Plain CommonJS so tailwind.config.js (run directly by Node, no TS build step)
// can require() it without extra tooling. `tokens.ts` re-exports this with
// types for RN code. This file is the single source of truth for these
// values — never hardcode a hex literal elsewhere.
//
// #000000 (seen on some Insights body text in Figma) and #262626 (seen
// everywhere else) were reconciled into the single `textPrimary` token below —
// use `textPrimary` for all primary body/heading text.
module.exports = {
  primary: '#9747FF',
  primaryDark: '#5B2B99',
  contrast: '#4361EE',
  success: '#34C759',
  alert: '#FF383C',
  caution: '#FBB93E',
  neutral100: '#E5E5E5',
  inactiveButton: '#8C8C8C',
  textPrimary: '#262626',
  textMutedA: '#A9A9A9',
  textMutedB: '#7B7B7B',
  surface: '#FFFFFF',
  iconDark: '#1F2228',
};
