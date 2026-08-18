import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../theme/tokens';
import { typography } from '../theme/typography';
import { radii } from '../theme/radii';
import { ChevronLeftIcon } from './icons';

export type HeaderVariant = 'gradient' | 'plain';

export interface HeaderProps {
  title: string;
  variant?: HeaderVariant;
  onBack?: () => void;
  rightAction?: ReactNode;
}

function HeaderButton({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        width: 44,
        height: 44,
        borderRadius: radii.control,
        borderWidth: 1,
        borderColor: tokens.neutral100,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </Pressable>
  );
}

export function Header({ title, variant = 'plain', onBack, rightAction }: HeaderProps) {
  const insets = useSafeAreaInsets();

  const content = (
    <View
      style={{
        paddingTop: insets.top + 12,
        paddingBottom: 16,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ width: 44 }}>
        {onBack ? (
          <HeaderButton onPress={onBack}>
            <ChevronLeftIcon size={20} color={tokens.primary} />
          </HeaderButton>
        ) : null}
      </View>
      <Text
        style={{
          flex: 1,
          textAlign: 'center',
          color: variant === 'gradient' ? tokens.surface : tokens.textPrimary,
          fontFamily: typography.displayTitle.fontFamily,
          fontSize: typography.displayTitle.fontSize,
          lineHeight: typography.displayTitle.lineHeight,
        }}
      >
        {title}
      </Text>
      <View style={{ width: 44, alignItems: 'flex-end' }}>{rightAction}</View>
    </View>
  );

  if (variant === 'gradient') {
    return (
      <LinearGradient
        colors={[tokens.primary, tokens.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radii.card }}
      >
        {content}
      </LinearGradient>
    );
  }

  return <View style={{ backgroundColor: tokens.surface, borderRadius: radii.card }}>{content}</View>;
}

export default Header;
