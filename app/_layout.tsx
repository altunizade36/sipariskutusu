import 'react-native-gesture-handler';
import { Stack, usePathname, useGlobalSearchParams } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Roboto_400Regular, Roboto_500Medium, Roboto_700Bold } from '@expo-google-fonts/roboto';
import { Cairo_600SemiBold, Cairo_700Bold } from '@expo-google-fonts/cairo';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { LogBox, Platform } from 'react-native';

// Font yükleme timeout hatalarını tüm ortamlarda gizle
LogBox.ignoreLogs(['timeout exceeded', 'fontfaceobserver', '6000ms']);
import * as Sentry from '@sentry/react-native';
import { PostHogProvider } from 'posthog-react-native';
import { ListingsProvider } from '../src/context/ListingsContext';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ListingWizardProvider } from '../src/context/ListingWizardContext';
import { initSentry, initPostHog, getPostHogClient } from '../src/services/monitoring';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { useNetworkStatus } from '../src/hooks/useNetworkStatus';
import { OfflineBanner } from '../src/components/OfflineBanner';
import '../global.css';

initSentry();
initPostHog();

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function ThemedStatusBar() {
  const { isDarkMode } = useAuth();
  return <StatusBar style={isDarkMode ? 'light' : 'dark'} />;
}

function RootLayout() {
  usePushNotifications();
  const { isOnline } = useNetworkStatus();
  const [fontLoadTimedOut, setFontLoadTimedOut] = useState(false);
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const previousPathname = useRef<string | undefined>(undefined);

  // Webde fontfaceobserver timeout hatasını önlemek için font yüklemeyi atla
  const [fontsLoaded, fontError] = useFonts(
    Platform.OS === 'web'
      ? {}
      : {
          Roboto_400Regular,
          Roboto_500Medium,
          Roboto_700Bold,
          Cairo_600SemiBold,
          Cairo_700Bold,
        }
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setFontLoadTimedOut(true);
    }, 1500);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const EU = (global as any).ErrorUtils as
      | { getGlobalHandler: () => ((e: Error, fatal?: boolean) => void) | null; setGlobalHandler: (h: (e: Error, fatal?: boolean) => void) => void }
      | undefined;
    if (!EU) return;
    const prev = EU.getGlobalHandler();
    if (!prev) return;
    EU.setGlobalHandler((error: Error, isFatal?: boolean) => {
      const msg = error?.message ?? '';
      if (
        msg.includes('timeout exceeded') ||
        msg.includes('fontfaceobserver') ||
        msg.includes('6000')
      ) {
        return;
      }
      prev(error, isFatal);
    });
    return () => {
      EU.setGlobalHandler(prev);
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError || fontLoadTimedOut) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontError, fontLoadTimedOut, fontsLoaded]);

  // Manual screen tracking for expo-router
  useEffect(() => {
    if (previousPathname.current !== pathname) {
      getPostHogClient()?.screen(pathname, {
        previous_screen: previousPathname.current ?? null,
        ...params,
      });
      previousPathname.current = pathname;
    }
  }, [pathname, params]);

  if (!fontsLoaded && !fontError && !fontLoadTimedOut) return null;

  const posthogClient = getPostHogClient();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PostHogProvider
          client={posthogClient ?? undefined}
          autocapture={{
            captureScreens: false,
            captureTouches: true,
            propsToCapture: ['testID'],
          }}
        >
        <AuthProvider>
          <ListingsProvider>
            <ListingWizardProvider>
              <ThemedStatusBar />
              {!isOnline && <OfflineBanner />}
              <Stack initialRouteName="splash" screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="splash" options={{ animation: 'fade' }} />
                <Stack.Screen name="onboarding" options={{ animation: 'fade_from_bottom' }} />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="listing" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="auth" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="reset-password" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="product/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="order/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="category/[slug]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="search" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="share-story" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="store-setup" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="store-settings" options={{ presentation: 'card', animation: 'slide_from_right' }} />
                <Stack.Screen name="story-viewer" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
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
        </PostHogProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
