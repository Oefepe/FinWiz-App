import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function configureNotificationChannels(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('allowance-alert', {
      name: 'Allowance Alert',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('budget-exhausted', {
      name: 'Budget Exhausted',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
    });
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function triggerAllowanceAlert(
  remainingAllowance: number,
  allowancePerPeriod: number,
): Promise<void> {
  const pct = Math.round((remainingAllowance / allowancePerPeriod) * 100);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚠ Allowance Alert',
      body: `Only ${pct}% remaining (R$${remainingAllowance.toFixed(2)})`,
    },
    trigger: null,
  });
}

export async function triggerBudgetExhausted(overspend: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🚨 Budget Exhausted',
      body: `You are R$${Math.abs(overspend).toFixed(2)} over your allowance`,
    },
    trigger: null,
  });
}
