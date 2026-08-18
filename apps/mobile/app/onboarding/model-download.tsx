import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function ModelDownloadRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/onboarding/financial-setup'); }, [router]);
  return null;
}
