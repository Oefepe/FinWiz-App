import { Modal, Pressable, Text } from 'react-native';
import { RadioButton } from './RadioButton';
import { tokens } from '../theme/tokens';
import { typography } from '../theme/typography';
import { radii } from '../theme/radii';
import type { ChartGranularity } from '../lib/insightsData';

const OPTIONS: { value: ChartGranularity; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'lifetime', label: 'Lifetime' },
];

export interface FilterSheetProps {
  visible: boolean;
  value: ChartGranularity;
  onSelect: (value: ChartGranularity) => void;
  onDismiss: () => void;
}

// M15-T6 — Filter bottom sheet (Weekly/Monthly/Quarterly/Yearly/Lifetime).
// Re-aggregates the two charts and the Total Savings row (see useInsights.ts)
// — the three period-comparison and two installment bullets stay scoped to
// the user's actual allowance period regardless of this filter; see the M15
// plan note for why those two scopes are kept independent.
export function FilterSheet({ visible, value, onSelect, onDismiss }: FilterSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        onPress={onDismiss}
      >
        <Pressable
          onPress={(e) => { e.stopPropagation(); }}
          style={{
            backgroundColor: tokens.surface,
            borderTopLeftRadius: radii.card * 3,
            borderTopRightRadius: radii.card * 3,
            padding: 24,
            paddingBottom: 40,
          }}
        >
          <Text
            style={{
              color: tokens.textPrimary,
              marginBottom: 8,
              fontFamily: typography.headingBold.fontFamily,
              fontSize: typography.headingBold.fontSize,
              lineHeight: typography.headingBold.lineHeight,
            }}
          >
            Filter
          </Text>
          {OPTIONS.map((opt) => (
            <RadioButton
              key={opt.value}
              label={opt.label}
              selected={value === opt.value}
              onPress={() => {
                onSelect(opt.value);
                onDismiss();
              }}
            />
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default FilterSheet;
