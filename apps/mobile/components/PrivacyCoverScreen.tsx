import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tokens } from '../theme/tokens';
import { typography } from '../theme/typography';

// M18-T7 — rendered by AppLockGate the instant AppState leaves 'active'
// (covers both 'inactive' and 'background'), so the OS's app-switcher
// snapshot captures this branded cover instead of whatever financial
// screen was on-screen a moment before. Deliberately data-free: no
// transaction figures, balances, or user name — just the same gradient
// treatment as Header's `gradient` variant, so a snapshot never leaks
// anything sensitive even before a real device confirms the timing (see
// the "Needs real-device verification" note where this is wired in).
export function PrivacyCoverScreen() {
  return (
    <LinearGradient
      colors={[tokens.primary, tokens.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <View>
        <Text
          style={{
            color: tokens.surface,
            textAlign: 'center',
            fontFamily: typography.displayTitle.fontFamily,
            fontSize: typography.displayTitle.fontSize,
            lineHeight: typography.displayTitle.lineHeight,
          }}
        >
          FinWiz
        </Text>
      </View>
    </LinearGradient>
  );
}

export default PrivacyCoverScreen;
