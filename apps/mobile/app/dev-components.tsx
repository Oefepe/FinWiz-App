import { useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Input, DropdownInput } from '../components/Input';
import { ProgressBar } from '../components/ProgressBar';
import { RadioButton } from '../components/RadioButton';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BottomNavigation, type BottomNavItem } from '../components/BottomNavigation';
import { tokens } from '../theme/tokens';
import { typography } from '../theme/typography';

// Dev-only visual QA route for every M12 themed primitive, all variants in
// one place — not linked from any nav, not meant to ship. Not a substitute
// for Storybook, just a fast way to eyeball a component change without
// hunting through the real screens that use it.
export default function DevComponentsScreen(): ReactNode {
  if (!__DEV__) {
    return null;
  }

  const [dropdownValue, setDropdownValue] = useState('monthly');
  const [radioValue, setRadioValue] = useState('weekly');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeNavKey, setActiveNavKey] = useState('index');

  const navItems: BottomNavItem[] = ['index', 'insights', 'settings', 'profile'].map((key) => ({
    key,
    renderIcon: (active) => (
      <Text style={{ color: active ? tokens.surface : tokens.iconDark, fontSize: 16 }}>
        {key[0].toUpperCase()}
      </Text>
    ),
    onPress: () => {
      setActiveNavKey(key);
    },
  }));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: tokens.surface }}>
      <Header title="Dev: Components" variant="gradient" />

      <Section title="Header (plain, with back + right action)">
        <Header
          title="Edit"
          onBack={() => undefined}
          rightAction={<Text style={{ color: tokens.primary, fontSize: 18 }}>{'✓'}</Text>}
        />
      </Section>

      <Section title="Button">
        <Row>
          <Button label="Default" onPress={() => undefined} />
          <Button label="Contrast" variant="contrast" onPress={() => undefined} />
          <Button label="Inactive" variant="inactive" onPress={() => undefined} />
        </Row>
        <Row>
          <Button label="Loading" loading onPress={() => undefined} />
        </Row>
      </Section>

      <Section title="Input">
        <Input label="Full Name" placeholder="Felipe Santos Petersen" />
        <View style={{ height: 12 }} />
        <Input label="Salary (inactive)" placeholder="R$ 0,00" state="inactive" />
        <View style={{ height: 12 }} />
        <DropdownInput
          label="Allowance Period"
          value={dropdownValue}
          onSelect={setDropdownValue}
          options={[
            { label: 'Weekly', value: 'weekly' },
            { label: 'Monthly', value: 'monthly' },
          ]}
        />
      </Section>

      <Section title="ProgressBar">
        <ProgressBar progress={0.3} status="default" label="Default" sublabel="30%" />
        <View style={{ height: 12 }} />
        <ProgressBar progress={0.85} status="caution" label="Caution" sublabel="85%" />
        <View style={{ height: 12 }} />
        <ProgressBar progress={1.1} status="alert" label="Alert" sublabel="110%" />
      </Section>

      <Section title="RadioButton">
        <RadioButton
          label="Weekly"
          selected={radioValue === 'weekly'}
          onPress={() => {
            setRadioValue('weekly');
          }}
        />
        <RadioButton
          label="Monthly"
          selected={radioValue === 'monthly'}
          onPress={() => {
            setRadioValue('monthly');
          }}
        />
        <RadioButton label="Disabled" selected={false} onPress={() => undefined} disabled />
      </Section>

      <Section title="ConfirmDialog">
        <Button
          label="Open confirm dialog"
          onPress={() => {
            setConfirmOpen(true);
          }}
        />
        <ConfirmDialog
          visible={confirmOpen}
          message="Deleting a transaction is irreversible."
          confirmLabel="Delete"
          onConfirm={() => {
            setConfirmOpen(false);
          }}
          onDismiss={() => {
            setConfirmOpen(false);
          }}
        />
      </Section>

      <Section title="BottomNavigation">
        <BottomNavigation items={navItems} activeKey={activeNavKey} />
      </Section>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
      <Text
        style={{
          color: tokens.textMutedB,
          marginBottom: 12,
          fontFamily: typography.captionBold.fontFamily,
          fontSize: typography.captionBold.fontSize,
          lineHeight: typography.captionBold.lineHeight,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row({ children }: { children: ReactNode }): ReactNode {
  return <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>{children}</View>;
}
