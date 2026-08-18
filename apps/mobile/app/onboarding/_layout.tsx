import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="vault-setup" />
      <Stack.Screen name="financial-setup" />
      <Stack.Screen name="notification-consent" />
      <Stack.Screen name="notification-permission" />
      <Stack.Screen name="shortcuts-setup" />
      <Stack.Screen name="bank-selection" />
      <Stack.Screen name="self-transfer-hint" />
      <Stack.Screen name="app-lock-setup" />
      <Stack.Screen name="manual-entry-tutorial" />
    </Stack>
  );
}
