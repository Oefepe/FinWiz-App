import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { tokens } from '../theme/tokens';
import { radii } from '../theme/radii';

export interface BottomNavItem {
  key: string;
  /** Render the icon given whether this item is currently active. */
  renderIcon: (active: boolean) => ReactNode;
  onPress: () => void;
}

export interface BottomNavigationProps {
  items: BottomNavItem[];
  activeKey: string;
}

// Matches the Figma `BottomNavigation` component set: a rounded floating bar
// (neutral100 background) where the active item gets a filled primary pill
// behind its icon; inactive items just show the plain icon.
export function BottomNavigation({ items, activeKey }: BottomNavigationProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: tokens.neutral100,
        borderRadius: radii.navPillOuter,
        paddingVertical: 6,
        paddingHorizontal: 10,
      }}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              width: 48,
              height: 48,
              borderRadius: radii.navPillInner,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? tokens.primary : 'transparent',
            }}
          >
            {item.renderIcon(active)}
          </Pressable>
        );
      })}
    </View>
  );
}

export default BottomNavigation;
