import { Platform, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useUnreadMessageCount } from '../../src/hooks/useUnreadMessageCount';
import { useUnreadNotificationCount } from '../../src/hooks/useUnreadNotificationCount';
import BoxMascot from '../../src/components/BoxMascot';
import { t } from '../../src/i18n';
import { isSmallDevice, clamp, screenHeight } from '../../src/utils/responsive';

export default function TabLayout() {
  const { isLoading, isDarkMode } = useAuth();
  const unreadCount = useUnreadMessageCount();
  const unreadNotifCount = useUnreadNotificationCount();

  const tabBarHeight = Platform.select({
    web: 94,
    default: clamp(Math.round(screenHeight * 0.115), isSmallDevice ? 78 : 88, 108),
  }) as number;

  const tabBarPaddingBottom = Platform.select({
    web: 22,
    default: isSmallDevice ? 18 : 26,
  }) as number;

  if (isLoading) {
    return (
      <View style={styles.fullscreenCenter}>
        <BoxMascot variant="loading" size={110} animated />
        <Text style={styles.loadingText}>Oturum kontrol ediliyor...</Text>
      </View>
    );
  }

  return (
    <Tabs
      backBehavior="initialRoute"
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: isDarkMode ? '#94A3B8' : colors.textMuted,
        tabBarStyle: {
          backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF',
          borderTopColor: isDarkMode ? '#1E293B' : '#E8EEF8',
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 10,
          paddingHorizontal: 10,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          overflow: 'visible',
          shadowColor: '#0F172A',
          shadowOpacity: isDarkMode ? 0.24 : 0.08,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: -4 },
          elevation: 18,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 9,
          marginTop: 2,
          paddingBottom: 2,
        },
        tabBarItemStyle: {
          paddingTop: 4,
          paddingHorizontal: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.home,
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          href: null,
          title: 'Kategoriler',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          href: null,
          title: 'Favoriler',
          tabBarIcon: ({ color, size }) => <Ionicons name="heart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t.tabs.explore,
          tabBarIcon: ({ color, size }) => <Ionicons name="compass" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: t.tabs.sell,
          tabBarItemStyle: {
            paddingTop: 0,
          },
          tabBarLabelStyle: {
            fontFamily: fonts.bold,
            fontSize: 10,
            marginTop: 8,
          },
          tabBarIcon: ({ focused }) => (
            <View style={[styles.sellFab, focused && styles.sellFabFocused]}>
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t.tabs.messages,
          tabBarBadge: unreadCount > 0 ? unreadCount : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t.tabs.profile,
          tabBarBadge: unreadNotifCount > 0 ? unreadNotifCount : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          href: null,
          title: 'Sepet',
          tabBarIcon: ({ color, size }) => <Ionicons name="bag-handle-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          href: null,
          title: t.tabs.store,
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          href: null,
          title: 'Siparişler',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fullscreenCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F7',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 10,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
    textAlign: 'center',
  },
  sellFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: -22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  sellFabFocused: {
    transform: [{ scale: 1.04 }],
  },
});
