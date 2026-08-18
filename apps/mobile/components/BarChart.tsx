import { Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { tokens } from '../theme/tokens';
import { typography } from '../theme/typography';

export type BarChartColor = 'success' | 'alert' | 'primary' | 'primaryDark';

export interface BarChartDatum {
  key: string;
  label: string;
  value: number; // may be negative (Money Saved chart)
  color: BarChartColor;
}

export interface BarChartProps {
  data: BarChartDatum[];
  height?: number;
  barWidth?: number;
  gap?: number;
}

// Generic divergent bar chart (values can be positive or negative) built on
// react-native-svg — already a dependency (used by the icon set), so this
// needed no new library per M15-T1's decision to avoid WebView/canvas-based
// charting libraries. The baseline floats: an all-positive dataset (M15-T2's
// Allowance Usage chart) puts it at the bottom and every bar grows upward;
// a mixed dataset (M15-T3's Money Saved chart, which can go negative when a
// period overspent) puts it wherever the positive/negative magnitudes
// balance, same as any standard divergent bar chart.
export function BarChart({ data, height = 140, barWidth = 28, gap = 14 }: BarChartProps) {
  const maxPositive = Math.max(0, ...data.map((d) => d.value));
  const maxNegative = Math.max(0, ...data.map((d) => -d.value));
  const totalRange = maxPositive + maxNegative || 1;
  const baselineY = (maxNegative / totalRange) * height;
  const columnWidth = barWidth + gap;
  const chartWidth = data.length * columnWidth - (data.length > 0 ? gap : 0);

  return (
    <View>
      <Svg width={chartWidth} height={height}>
        {data.map((d, i) => {
          const barHeight = Math.max(2, (Math.abs(d.value) / totalRange) * height);
          const y = d.value >= 0 ? baselineY - barHeight : baselineY;
          return (
            <Rect
              key={d.key}
              x={i * columnWidth}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={4}
              fill={tokens[d.color]}
            />
          );
        })}
      </Svg>
      <View style={{ flexDirection: 'row', width: chartWidth, marginTop: 6 }}>
        {data.map((d) => (
          <Text
            key={d.key}
            numberOfLines={1}
            style={{
              width: columnWidth,
              textAlign: 'center',
              color: tokens.textMutedB,
              fontFamily: typography.captionSemibold.fontFamily,
              fontSize: typography.captionSemibold.fontSize,
              lineHeight: typography.captionSemibold.lineHeight,
            }}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default BarChart;
