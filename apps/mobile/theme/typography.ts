// Type scale — extracted from the PadLock Figma file's `Text` component set.
// Font family values match the export names from @expo-google-fonts/open-sans;
// those fonts must be loaded via useFonts() before first render (see
// app/_layout.tsx) or React Native silently falls back to the system font.
export type OpenSansFamily = 'OpenSans_400Regular' | 'OpenSans_600SemiBold' | 'OpenSans_700Bold';

export interface TextStyleToken {
  fontFamily: OpenSansFamily;
  fontSize: number;
  lineHeight: number;
}

export const typography = {
  displayTitle: { fontFamily: 'OpenSans_700Bold', fontSize: 24, lineHeight: 32.68 },
  headingBold: { fontFamily: 'OpenSans_700Bold', fontSize: 20, lineHeight: 27.24 },
  headingSemibold: { fontFamily: 'OpenSans_600SemiBold', fontSize: 20, lineHeight: 27.24 },
  bodyStrong: { fontFamily: 'OpenSans_600SemiBold', fontSize: 16, lineHeight: 21.79 },
  body: { fontFamily: 'OpenSans_400Regular', fontSize: 14, lineHeight: 19.07 },
  bodySemibold: { fontFamily: 'OpenSans_600SemiBold', fontSize: 14, lineHeight: 19.07 },
  bodyBold: { fontFamily: 'OpenSans_700Bold', fontSize: 14, lineHeight: 19.07 },
  captionSemibold: { fontFamily: 'OpenSans_600SemiBold', fontSize: 12, lineHeight: 16.34 },
  captionBold: { fontFamily: 'OpenSans_700Bold', fontSize: 12, lineHeight: 16.34 },
} as const satisfies Record<string, TextStyleToken>;

export type TypographyToken = keyof typeof typography;
export default typography;
