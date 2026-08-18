import { Pressable, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';
import { typography } from '../theme/typography';
import { CheckIcon } from './icons';

export interface RadioButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export function RadioButton({ label, selected, onPress, disabled = false }: RadioButtonProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
          backgroundColor: selected ? tokens.primary : tokens.surface,
          borderWidth: selected ? 0 : 1.5,
          borderColor: tokens.neutral100,
        }}
      >
        {selected && <CheckIcon size={14} color={tokens.surface} />}
      </View>
      <Text
        style={{
          color: tokens.textPrimary,
          fontFamily: typography.bodyBold.fontFamily,
          fontSize: typography.bodyBold.fontSize,
          lineHeight: typography.bodyBold.lineHeight,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default RadioButton;
