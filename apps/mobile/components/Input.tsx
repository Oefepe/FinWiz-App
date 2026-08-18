import { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { tokens } from '../theme/tokens';
import { typography } from '../theme/typography';
import { radii } from '../theme/radii';
import { ChevronDownIcon, ChevronUpIcon } from './icons';

export type InputState = 'default' | 'inactive';

const fieldTextStyle = {
  fontFamily: typography.bodyBold.fontFamily,
  fontSize: typography.bodyBold.fontSize,
  lineHeight: typography.bodyBold.lineHeight,
};

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        color: tokens.textPrimary,
        marginBottom: 6,
        fontFamily: typography.bodyBold.fontFamily,
        fontSize: typography.bodyBold.fontSize,
        lineHeight: typography.bodyBold.lineHeight,
      }}
    >
      {children}
    </Text>
  );
}

const fieldContainerStyle = {
  borderWidth: 1,
  borderColor: tokens.neutral100,
  borderRadius: radii.control,
  paddingVertical: 12,
  paddingHorizontal: 14,
  backgroundColor: tokens.surface,
};

export interface InputProps extends Omit<TextInputProps, 'style' | 'editable'> {
  label?: string;
  state?: InputState;
}

export function Input({ label, state = 'default', ...textInputProps }: InputProps) {
  const isInactive = state === 'inactive';

  return (
    <View>
      {label !== undefined && <FieldLabel>{label}</FieldLabel>}
      <TextInput
        editable={!isInactive}
        placeholderTextColor={tokens.textMutedB}
        style={[
          fieldContainerStyle,
          fieldTextStyle,
          { color: isInactive ? tokens.textMutedB : tokens.textPrimary },
        ]}
        {...textInputProps}
      />
    </View>
  );
}

export interface DropdownOption {
  label: string;
  value: string;
}

export interface DropdownInputProps {
  label?: string;
  state?: InputState;
  value: string;
  options: DropdownOption[];
  onSelect: (value: string) => void;
  placeholder?: string;
}

// Minimal, dependency-free dropdown: tap opens an inline option list below the field.
export function DropdownInput({
  label,
  state = 'default',
  value,
  options,
  onSelect,
  placeholder = 'Select…',
}: DropdownInputProps) {
  const [open, setOpen] = useState(false);
  const isInactive = state === 'inactive';
  const selected = options.find((option) => option.value === value);

  return (
    <View>
      {label !== undefined && <FieldLabel>{label}</FieldLabel>}
      <Pressable
        disabled={isInactive}
        accessibilityRole="button"
        onPress={() => {
          setOpen((prev) => !prev);
        }}
        style={[
          fieldContainerStyle,
          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        ]}
      >
        <Text style={[fieldTextStyle, { color: selected ? tokens.textPrimary : tokens.textMutedB }]}>
          {selected ? selected.label : placeholder}
        </Text>
        {open ? (
          <ChevronUpIcon size={16} color={tokens.textMutedB} />
        ) : (
          <ChevronDownIcon size={16} color={tokens.textMutedB} />
        )}
      </Pressable>
      {open && !isInactive && (
        <View
          style={{
            borderWidth: 1,
            borderColor: tokens.neutral100,
            borderRadius: radii.control,
            marginTop: 4,
            backgroundColor: tokens.surface,
          }}
        >
          {options.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                onSelect(option.value);
                setOpen(false);
              }}
              style={{ paddingVertical: 10, paddingHorizontal: 14 }}
            >
              <Text
                style={{
                  color: tokens.textPrimary,
                  fontFamily: typography.body.fontFamily,
                  fontSize: typography.body.fontSize,
                  lineHeight: typography.body.lineHeight,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default Input;
