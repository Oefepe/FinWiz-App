import { View, Text } from 'react-native';
import { tokens } from '../theme/tokens';
import { typography } from '../theme/typography';
import { radii } from '../theme/radii';

export type ProgressBarStatus = 'default' | 'caution' | 'alert';

export interface ProgressBarProps {
  /** 0–1. Values above 1 clamp visually to full but keep `status` in control of color. */
  progress: number;
  status?: ProgressBarStatus;
  label?: string;
  sublabel?: string;
}

const STATUS_COLOR: Record<ProgressBarStatus, string> = {
  default: tokens.primary,
  caution: tokens.caution,
  alert: tokens.alert,
};

export function ProgressBar({ progress, status = 'default', label, sublabel }: ProgressBarProps) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const widthPct = `${(clamped * 100).toFixed(1)}%` as `${number}%`;

  return (
    <View>
      {(label !== undefined || sublabel !== undefined) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          {label !== undefined && (
            <Text
              style={{
                color: tokens.textMutedB,
                fontFamily: typography.captionSemibold.fontFamily,
                fontSize: typography.captionSemibold.fontSize,
                lineHeight: typography.captionSemibold.lineHeight,
              }}
            >
              {label}
            </Text>
          )}
          {sublabel !== undefined && (
            <Text
              style={{
                color: tokens.textMutedA,
                fontFamily: typography.body.fontFamily,
                fontSize: typography.body.fontSize,
                lineHeight: typography.body.lineHeight,
              }}
            >
              {sublabel}
            </Text>
          )}
        </View>
      )}
      <View
        style={{
          height: 8,
          backgroundColor: tokens.neutral100,
          borderRadius: radii.card,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: widthPct,
            backgroundColor: STATUS_COLOR[status],
            borderRadius: radii.card,
          }}
        />
      </View>
    </View>
  );
}

export default ProgressBar;
