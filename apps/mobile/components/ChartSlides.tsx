import { useState, type ReactNode } from 'react';
import { ScrollView, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { tokens } from '../theme/tokens';

export interface ChartSlidesProps {
  slides: ReactNode[];
  /** Horizontal margin already applied outside this component, so slide
   * width can match it exactly and each slide's own content lines up with
   * the rest of the screen's cards. */
  horizontalMargin?: number;
}

// M15-T4 — swipeable slide container with a two-dot page indicator, matching
// Figma (active dot primary, inactive neutral100). Hand-rolled paging
// ScrollView rather than a carousel library — two slides is the entire use
// case (M15's Allowance Usage / Money Saved charts), not worth a dependency.
export function ChartSlides({ slides, horizontalMargin = 16 }: ChartSlidesProps) {
  const { width } = useWindowDimensions();
  const slideWidth = width - horizontalMargin * 2;
  const [active, setActive] = useState(0);

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>): void {
    const index = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    setActive(Math.max(0, Math.min(slides.length - 1, index)));
  }

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        snapToInterval={slideWidth}
        decelerationRate="fast"
      >
        {slides.map((slide, i) => (
          <View key={i} style={{ width: slideWidth }}>
            {slide}
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 12, gap: 8 }}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === active ? tokens.primary : tokens.neutral100,
            }}
          />
        ))}
      </View>
    </View>
  );
}

export default ChartSlides;
