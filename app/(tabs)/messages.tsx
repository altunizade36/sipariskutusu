import { useEffect } from 'react';
import { useRouter } from 'expo-router';

// Tab icon entry point — redirects to the full live messages screen (app/messages.tsx)
export default function MessagesTabRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/messages');
  }, [router]);
  return null;
}
