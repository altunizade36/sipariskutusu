import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Roboto_400Regular, Roboto_500Medium, Roboto_700Bold } from '@expo-google-fonts/roboto';
import { Cairo_600SemiBold, Cairo_700Bold } from '@expo-google-fonts/cairo';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { ListingsProvider } from '../src/context/ListingsContext';
import { AuthProvider } from '../src/context/AuthContext';
import { ListingWizardProvider } from '../src/context/ListingWizardContext';
import { initSentry, initPostHog } from '../src/services/monitoring';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import '../global.css';

initSentry();
initPostHog();

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootLayout() {
  usePushNotifications();
  const [fontLoadTimedOut, setFontLoadTimedOut] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setFontLoadTimedOut(true);
    }, 2500);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError || fontLoadTimedOut) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontError, fontLoadTimedOut, fontsLoaded]);

  if (!fontsLoaded && !fontError && !fontLoadTimedOut) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 47, bottom: 34, left: 0, right: 0 },
          frame: { x: 0, y: 0, width: 393, height: 852 },
        }}
      >
        <AuthProvider>
          <ListingsProvider>
            <ListingWizardProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="listing" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="auth" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="reset-password" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="product/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="category/[slug]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="search" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="share-story" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="store-setup" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="store-settings" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="story-viewer" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="messages" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="follow-list" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="notifications" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="report-moderation" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="my-reports" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="cart" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="legal/[doc]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="profile-edit" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="security" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="addresses" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="payment-methods" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="size-table" options={{ presentation: 'modal' }} />
              </Stack>
            </ListingWizardProvider>
          </ListingsProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
