import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';
import { tokens } from '../theme/tokens';
import { typography } from '../theme/typography';
import { radii } from '../theme/radii';

export type ButtonVariant = 'default' | 'contrast' | 'inactive';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
}

const VARIANT_BACKGROUND: Record<ButtonVariant, string> = {
  default: tokens.primary,
  contrast: tokens.contrast,
  inactive: tokens.inactiveButton,
};

export function Button({
  label,
  variant = 'default',
  loading = false,
  disabled,
  ...pressableProps
}: ButtonProps) {
  const isDisabled = (disabled ?? false) || variant === 'inactive' || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => ({
        backgroundColor: VARIANT_BACKGROUND[variant],
        borderRadius: radii.pill,
        paddingVertical: 14,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
      {...pressableProps}
    >
      {loading ? (
        <ActivityIndicator color={tokens.surface} />
      ) : (
        <Text
          style={{
            color: tokens.surface,
            fontFamily: typography.bodySemibold.fontFamily,
            fontSize: typography.bodySemibold.fontSize,
            lineHeight: typography.bodySemibold.lineHeight,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export default Button;
