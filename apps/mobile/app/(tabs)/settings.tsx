import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, Alert, AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useQueryClient } from '@tanstack/react-query';
import { Header } from '../../components/Header';
import { RadioButton } from '../../components/RadioButton';
import { Input, DropdownInput } from '../../components/Input';
import { Button } from '../../components/Button';
import { getAllowanceConfig, saveAllowanceConfig, getSelectedBanks, saveSelectedBanks } from '../../lib/database';
import { requestNotificationPermission } from '../../lib/notifications';
import { isNotificationAccessGranted, requestNotificationAccess } from '../../lib/notificationAccess';
import { getCaptureMode, saveCaptureMode, type CaptureMode } from '../../lib/captureMode';
import { getLanguage, saveLanguage, type Language } from '../../lib/language';
import { getAppLockTimeout, saveAppLockTimeout, type AppLockTimeout } from '../../lib/appLock';
import { SUPPORTED_BANKS } from '../../lib/banks';
import { tokens } from '../../theme/tokens';
import { typography } from '../../theme/typography';

const NOTIF_MODE_KEY = 'finwiz_notification_mode';
const OBSIDIAN_API_KEY = 'finwiz_obsidian_api_key';
const OBSIDIAN_URL_KEY = 'finwiz_obsidian_url';

type NotifMode = 'bank_only' | 'wallet_only' | 'both';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mx-4 mt-5 bg-white rounded-2xl shadow-sm overflow-hidden">
      <View className="px-5 pt-4 pb-2 border-b border-gray-50">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</Text>
      </View>
      <View className="px-5 py-3">{children}</View>
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: tokens.textMutedB,
        marginBottom: 2,
        fontFamily: typography.body.fontFamily,
        fontSize: typography.body.fontSize,
        lineHeight: typography.body.lineHeight,
      }}
    >
      {children}
    </Text>
  );
}

export default function SettingsScreen() {
  const qc = useQueryClient();
  const [alertPct, setAlertPct] = useState('20');
  const [language, setLanguage] = useState<Language>('en-US');
  const [notifMode, setNotifMode] = useState<NotifMode>('bank_only');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('automatic');
  const [selectedBanks, setSelectedBanks] = useState<Set<string>>(new Set());
  const [vaultConfigured, setVaultConfigured] = useState(false);
  const [vaultUrl, setVaultUrl] = useState('');
  const [appLockTimeout, setAppLockTimeout] = useState<AppLockTimeout>('30s');
  const [saving, setSaving] = useState(false);
  const [listenerAccess, setListenerAccess] = useState(isNotificationAccessGranted);

  // Android: the user grants listener access in system settings, so re-check
  // whenever they come back to the app.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setListenerAccess(isNotificationAccessGranted());
    });
    return () => { sub.remove(); };
  }, []);

  useEffect(() => {
    void (async () => {
      const config = await getAllowanceConfig();
      setAlertPct((config.alertThreshold * 100).toFixed(0));

      setLanguage(await getLanguage());
      setCaptureMode(await getCaptureMode());
      setAppLockTimeout(await getAppLockTimeout());

      const storedMode = await SecureStore.getItemAsync(NOTIF_MODE_KEY);
      if (storedMode === 'wallet_only' || storedMode === 'both') {
        setNotifMode(storedMode);
      }

      setSelectedBanks(new Set(await getSelectedBanks()));

      const apiKey = await SecureStore.getItemAsync(OBSIDIAN_API_KEY);
      setVaultConfigured(apiKey !== null);
      setVaultUrl((await SecureStore.getItemAsync(OBSIDIAN_URL_KEY)) ?? 'https://localhost:27124');
    })();
  }, []);

  function toggleBank(pkg: string) {
    setSelectedBanks((prev) => {
      const next = new Set(prev);
      if (next.has(pkg)) {
        next.delete(pkg);
      } else {
        next.add(pkg);
      }
      return next;
    });
  }

  async function handleSave() {
    const alertVal = parseFloat(alertPct) / 100;
    if (isNaN(alertVal) || alertVal < 0 || alertVal > 1) {
      Alert.alert('Invalid input', 'Alert threshold must be a number between 0 and 100.');
      return;
    }

    setSaving(true);
    try {
      // Alert threshold is the only allowance-related field Settings owns
      // (M14: Profile owns salary/fixed-expenses/target-save/period) — carry
      // the rest of the config forward unchanged rather than duplicating it.
      const currentConfig = await getAllowanceConfig();
      await saveAllowanceConfig({ ...currentConfig, alertThreshold: alertVal });
      await saveLanguage(language);
      await SecureStore.setItemAsync(NOTIF_MODE_KEY, notifMode);
      await saveCaptureMode(captureMode);
      await saveAppLockTimeout(appLockTimeout);
      if (Platform.OS === 'android') {
        await saveSelectedBanks(Array.from(selectedBanks));
      }
      await qc.invalidateQueries({ queryKey: ['allowance'] });
      // Lets useNotificationListener react immediately instead of waiting
      // for the next app relaunch.
      await qc.invalidateQueries({ queryKey: ['captureMode'] });
      Alert.alert('Saved', 'Settings updated successfully.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestNotifPermission() {
    const granted = await requestNotificationPermission();
    Alert.alert(
      granted ? 'Permission granted' : 'Permission denied',
      granted
        ? 'You will receive allowance alerts.'
        : 'Enable notifications in system settings to receive alerts.',
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surface }}>
      <Header title="Settings" />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}>
        {/* Language */}
        <Section title="Language">
          <DropdownInput
            value={language}
            options={[
              { label: 'English (US)', value: 'en-US' },
              { label: 'Português (BR)', value: 'pt-BR' },
            ]}
            onSelect={(value) => { setLanguage(value as Language); }}
          />
        </Section>

        {/* Transaction Capture — automated vs. manual-only */}
        <Section title="Transaction Capture">
          <RadioButton
            label="Automatic (recommended)"
            selected={captureMode === 'automatic'}
            onPress={() => { setCaptureMode('automatic'); }}
          />
          <SectionLabel>
            {Platform.OS === 'android'
              ? 'Bank/wallet notifications are captured in the background'
              : 'Shortcuts automations capture transactions as they arrive'}
          </SectionLabel>
          <RadioButton
            label="Manual only"
            selected={captureMode === 'manual_only'}
            onPress={() => { setCaptureMode('manual_only'); }}
          />
          <SectionLabel>Pause automated capture — add every transaction with the + button</SectionLabel>
        </Section>

        {/* Notification Watcher — Android only per M10's Apple Wallet limitation */}
        {Platform.OS === 'android' && (
          <Section title="Notification Watcher">
            <RadioButton label="Bank apps only" selected={notifMode === 'bank_only'} onPress={() => { setNotifMode('bank_only'); }} />
            <RadioButton label="Wallet only" selected={notifMode === 'wallet_only'} onPress={() => { setNotifMode('wallet_only'); }} />
            <RadioButton label="Both (recommended)" selected={notifMode === 'both'} onPress={() => { setNotifMode('both'); }} />
          </Section>
        )}
        {Platform.OS === 'ios' && (
          <Section title="Notification Watcher">
            <RadioButton label="Bank apps only" selected onPress={() => undefined} disabled />
            <SectionLabel>
              Wallet capture is unavailable on iOS — transactions are intercepted at the system level
            </SectionLabel>
          </Section>
        )}

        {/* Banks — Android only, mirrors the onboarding bank-selection step */}
        {Platform.OS === 'android' && (
          <Section title="Banks">
            {SUPPORTED_BANKS.map(({ pkg, label }) => (
              <TouchableOpacity
                key={pkg}
                onPress={() => { toggleBank(pkg); }}
                className="flex-row items-center py-2.5 border-b border-gray-50 last:border-0"
                activeOpacity={0.7}
              >
                <View
                  className={`w-5 h-5 rounded border-2 items-center justify-center mr-3 ${
                    selectedBanks.has(pkg) ? 'border-primary bg-primary' : 'border-gray-300'
                  }`}
                >
                  {selectedBanks.has(pkg) && <Text className="text-white text-xs font-bold">✓</Text>}
                </View>
                <Text className="text-sm font-medium text-gray-800">{label}</Text>
              </TouchableOpacity>
            ))}
          </Section>
        )}

        {/* App Lock — M17. No password to manage here (see appLock.ts) — just
            how long the app stays unlocked in the background before the
            next foreground re-triggers the device auth challenge. */}
        <Section title="App Lock">
          <RadioButton
            label="Lock immediately"
            selected={appLockTimeout === 'immediately'}
            onPress={() => { setAppLockTimeout('immediately'); }}
          />
          <RadioButton
            label="After 30 seconds"
            selected={appLockTimeout === '30s'}
            onPress={() => { setAppLockTimeout('30s'); }}
          />
          <RadioButton
            label="After 5 minutes"
            selected={appLockTimeout === '5min'}
            onPress={() => { setAppLockTimeout('5min'); }}
          />
        </Section>

        {/* Alerts — the one allowance_state field Settings owns (see M14 note above handleSave) */}
        <Section title="Alerts">
          <Input
            label="Alert threshold (%)"
            value={alertPct}
            onChangeText={setAlertPct}
            keyboardType="number-pad"
            placeholder="20"
          />
          <SectionLabel>Notify me when this % of my allowance remains</SectionLabel>
        </Section>

        {/* Vault connection */}
        <Section title="Vault Connection">
          <View className="flex-row items-center justify-between py-1">
            <Text className="text-sm font-medium text-gray-800">Obsidian Local REST API</Text>
            <Text className={`text-xs font-medium ${vaultConfigured ? 'text-green-600' : 'text-amber-600'}`}>
              {vaultConfigured ? vaultUrl : 'Not configured'}
            </Text>
          </View>
          {vaultConfigured && (
            <SectionLabel>
              Your transactions stay encrypted in FinWiz's own database regardless — vault notes
              (goals, self-transfer summaries) are plain Markdown, protected only by the vault
              itself.
            </SectionLabel>
          )}
        </Section>

        {/* Notifications permission */}
        <Section title="Permissions">
          {Platform.OS === 'android' && (
            <>
              <View className="flex-row items-center justify-between py-1">
                <Text className="text-sm font-medium text-gray-800">Bank notification access</Text>
                <Text className={`text-xs font-medium ${listenerAccess ? 'text-green-600' : 'text-amber-600'}`}>
                  {listenerAccess ? 'Granted' : 'Not granted'}
                </Text>
              </View>
              <SectionLabel>
                Lets FinWiz watch your bank and wallet notifications to record transactions automatically
              </SectionLabel>
              {!listenerAccess && (
                <TouchableOpacity onPress={requestNotificationAccess} className="py-2">
                  <Text className="text-sm font-medium text-primary">Grant notification access</Text>
                </TouchableOpacity>
              )}
            </>
          )}
          <TouchableOpacity onPress={() => { void handleRequestNotifPermission(); }} className="py-2">
            <Text className="text-sm font-medium text-primary">Request notification permission</Text>
          </TouchableOpacity>
        </Section>

        {/* Save button */}
        <View className="mx-4 mt-6">
          <Button label="Save Settings" loading={saving} onPress={() => { void handleSave(); }} />
        </View>
      </ScrollView>
    </View>
  );
}
