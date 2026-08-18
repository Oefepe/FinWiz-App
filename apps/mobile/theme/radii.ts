// Corner radii — extracted from the PadLock Figma file's component sets.
export const radii = {
  pill: 34, // primary/contrast/inactive buttons — fully rounded
  card: 5, // Header, ProgressBar, Input outer frame, BottomNavigation container
  control: 8, // HeaderButton, Input field itself
  navPillOuter: 27, // BottomNavigation active-icon pill (outer)
  navPillInner: 26, // BottomNavigation active-icon pill (inner)
} as const;

export type RadiusToken = keyof typeof radii;
export default radii;
