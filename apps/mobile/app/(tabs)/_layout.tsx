import { useState, type ComponentType } from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useQueryClient } from '@tanstack/react-query';
import { FAB } from '../../components/FAB';
import { ManualEntryModal } from '../../components/ManualEntryModal';
import { BottomNavigation, type BottomNavItem } from '../../components/BottomNavigation';
import { HomeIcon, ChartLineUpIcon, SettingsIcon, ProfileIcon, type IconProps } from '../../components/icons';
import { insertTransaction } from '../../lib/database';
import type { SaveableTransaction } from '../../lib/manualEntry';
import { tokens } from '../../theme/tokens';

// Route name -> icon, matching Figma's 4-item BottomNavigation (Home,
// Insights, Settings, Profile).
const TAB_ICONS: Partial<Record<string, ComponentType<IconProps>>> = {
  index: HomeIcon,
  insights: ChartLineUpIcon,
  settings: SettingsIcon,
  profile: ProfileIcon,
};

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const items: BottomNavItem[] = state.routes.map((route, index) => {
    const isFocused = state.index === index;
    const RouteIcon = TAB_ICONS[route.name];
    return {
      key: route.name,
      renderIcon: (active) =>
        RouteIcon ? <RouteIcon size={22} color={active ? tokens.surface : tokens.iconDark} /> : null,
      onPress: () => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!isFocused && !event.defaultPrevented) {
          navigation.navigate(route.name);
        }
      },
    };
  });

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
      <BottomNavigation items={items} activeKey={state.routes[state.index]?.name ?? ''} />
    </View>
  );
}

export default function TabLayout() {
  const [showEntry, setShowEntry] = useState(false);
  const qc = useQueryClient();

  async function handleSave(tx: SaveableTransaction): Promise<void> {
    await insertTransaction(tx);
    await qc.invalidateQueries({ queryKey: ['transactions'] });
    await qc.invalidateQueries({ queryKey: ['allowance'] });
  }

  return (
    <View className="flex-1">
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerStyle: { backgroundColor: tokens.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
        {/* Insights (M15), Settings and Profile (M14) own their header via
            the M12 Header primitive (matches their Figma frames exactly,
            including Insights' Filter action and Profile's checkmark save
            action) — hide the native tab header so they don't stack two. */}
        <Tabs.Screen name="insights" options={{ title: 'Insights', headerShown: false }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings', headerShown: false }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', headerShown: false }} />
      </Tabs>

      {/* FAB overlays all tab screens */}
      <FAB onPress={() => { setShowEntry(true); }} />

      <ManualEntryModal
        visible={showEntry}
        onClose={() => { setShowEntry(false); }}
        onSave={handleSave}
      />
    </View>
  );
}
