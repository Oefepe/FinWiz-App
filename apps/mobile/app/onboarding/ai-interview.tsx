import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function AiInterviewRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/onboarding/financial-setup'); }, [router]);
  return null;
}
