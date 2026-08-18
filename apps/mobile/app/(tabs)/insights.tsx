import { useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useAllowance } from '../../hooks/useAllowance';
import { useChartBuckets, useLifetimeSavings, usePeriodComparison, useInstallmentStats } from '../../hooks/useInsights';
import { usageColor, savedColor, type ChartGranularity, type PeriodBucket } from '../../lib/insightsData';
import { formatAmount } from '../../lib/transactionUtils';
import { Header } from '../../components/Header';
import { BarChart, type BarChartDatum } from '../../components/BarChart';
import { ChartSlides } from '../../components/ChartSlides';
import { FilterSheet } from '../../components/FilterSheet';
import { FunnelIcon } from '../../components/icons';
import { tokens } from '../../theme/tokens';
import { typography } from '../../theme/typography';
import { radii } from '../../theme/radii';

function ChartCard({
  title,
  buckets,
  color,
}: {
  title: string;
  buckets: PeriodBucket[];
  color: (b: PeriodBucket) => BarChartDatum['color'];
}) {
  const data: BarChartDatum[] = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    value: color === usageColor ? b.spent : b.remainingForPeriod,
    color: color(b),
  }));

  return (
    <View
      style={{
        backgroundColor: tokens.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: tokens.neutral100,
        padding: 16,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          alignSelf: 'flex-start',
          color: tokens.textPrimary,
          marginBottom: 16,
          fontFamily: typography.bodyStrong.fontFamily,
          fontSize: typography.bodyStrong.fontSize,
          lineHeight: typography.bodyStrong.lineHeight,
        }}
      >
        {title}
      </Text>
      {data.length > 0 ? (
        <BarChart data={data} />
      ) : (
        <Text style={{ color: tokens.textMutedB, paddingVertical: 40 }}>No data yet</Text>
      )}
    </View>
  );
}

function ComparisonRow({ label, pct }: { label: string; pct: number | null | undefined }) {
  const positive = pct !== null && pct !== undefined && pct >= 0;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
      <Text
        style={{
          color: tokens.textPrimary,
          fontFamily: typography.body.fontFamily,
          fontSize: typography.body.fontSize,
          lineHeight: typography.body.lineHeight,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: pct === null || pct === undefined ? tokens.textMutedB : positive ? tokens.success : tokens.alert,
          fontFamily: typography.bodyBold.fontFamily,
          fontSize: typography.bodyBold.fontSize,
          lineHeight: typography.bodyBold.lineHeight,
        }}
      >
        {pct === null || pct === undefined ? 'No previous period' : `${positive ? '+' : ''}${pct.toFixed(1)}%`}
      </Text>
    </View>
  );
}

export default function InsightsScreen() {
  const { data: allowance } = useAllowance();
  const [granularity, setGranularity] = useState<ChartGranularity>('monthly');
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: buckets } = useChartBuckets(granularity);
  const { data: lifetimeSavings } = useLifetimeSavings();
  const { data: comparison } = usePeriodComparison(allowance);
  const installments = useInstallmentStats();

  if (!allowance) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.surface }}>
        <Header title="Insights" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: tokens.textMutedB, textAlign: 'center' }}>
            Complete onboarding to see insights.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <Header
        title="Insights"
        rightAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter"
            onPress={() => { setFilterOpen(true); }}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <FunnelIcon size={20} color={tokens.primary} />
          </Pressable>
        }
      />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 16 }}>
        {/* M15-T2/T3/T4 — two swipeable charts */}
        <ChartSlides
          slides={[
            <ChartCard key="usage" title="Allowance Usage" buckets={buckets ?? []} color={usageColor} />,
            <ChartCard key="saved" title="Money Saved" buckets={buckets ?? []} color={savedColor} />,
          ]}
        />

        {/* M15-T5 — Total Savings, visible without opening the filter */}
        <View
          style={{
            backgroundColor: tokens.surface,
            borderRadius: radii.card,
            borderWidth: 1,
            borderColor: tokens.neutral100,
            padding: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: tokens.textPrimary,
              fontFamily: typography.bodyStrong.fontFamily,
              fontSize: typography.bodyStrong.fontSize,
              lineHeight: typography.bodyStrong.lineHeight,
            }}
          >
            Total Savings
          </Text>
          <Text
            style={{
              color: tokens.primary,
              fontFamily: typography.headingBold.fontFamily,
              fontSize: typography.headingBold.fontSize,
              lineHeight: typography.headingBold.lineHeight,
            }}
          >
            {formatAmount(lifetimeSavings ?? 0)}
          </Text>
        </View>

        {/* M15-T7 — period-over-period comparisons, scoped to the user's allowance period */}
        <View
          style={{
            backgroundColor: tokens.surface,
            borderRadius: radii.card,
            borderWidth: 1,
            borderColor: tokens.neutral100,
            padding: 16,
          }}
        >
          <Text
            style={{
              color: tokens.textMutedB,
              marginBottom: 4,
              fontFamily: typography.captionBold.fontFamily,
              fontSize: typography.captionBold.fontSize,
              lineHeight: typography.captionBold.lineHeight,
              textTransform: 'uppercase',
            }}
          >
            vs. Previous Period
          </Text>
          <ComparisonRow label="Savings" pct={comparison?.savingsChangePct} />
          <ComparisonRow label="Spend velocity" pct={comparison?.spendVelocityChangePct} />
          <ComparisonRow label="Projected savings" pct={comparison?.projectedSavingsChangePct} />
        </View>

        {/* M15-T10 — installment bullets */}
        <View
          style={{
            backgroundColor: tokens.surface,
            borderRadius: radii.card,
            borderWidth: 1,
            borderColor: tokens.neutral100,
            padding: 16,
          }}
        >
          <Text
            style={{
              color: tokens.textPrimary,
              fontFamily: typography.body.fontFamily,
              fontSize: typography.body.fontSize,
              lineHeight: typography.body.lineHeight,
            }}
          >
            {installments.hasInstallments
              ? 'You have installments this month'
              : "You don't have installments this month"}
          </Text>
          {installments.hasInstallments && (
            <Text
              style={{
                color: tokens.textPrimary,
                marginTop: 4,
                fontFamily: typography.bodyBold.fontFamily,
                fontSize: typography.bodyBold.fontSize,
                lineHeight: typography.bodyBold.lineHeight,
              }}
            >
              {formatAmount(-installments.totalInstallmentAmount)}
            </Text>
          )}
        </View>
      </ScrollView>

      <FilterSheet
        visible={filterOpen}
        value={granularity}
        onSelect={setGranularity}
        onDismiss={() => { setFilterOpen(false); }}
      />
    </View>
  );
}
