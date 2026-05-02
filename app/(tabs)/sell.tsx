import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function SellScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/create-listing');
  }, [router]);

  return null;
}
