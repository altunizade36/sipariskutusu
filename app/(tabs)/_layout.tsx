import { Platform, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useUnreadMessageCount } from '../../src/hooks/useUnreadMessageCount';
import BoxMascot from '../../src/components/BoxMascot';
import { t } from '../../src/i18n';
import { isSmallDevice, clamp, screenHeight } from '../../src/utils/responsive';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  name,
  nameFilled,
  focused,
  color,
  size,
}: {
  name: IoniconsName;
  nameFilled: IoniconsName;
  focused: boolean;
  color: string;
  size: number;
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={focused ? nameFilled : name} size={size} color={color} />
      {focused ? (
        <View
          style={{
            position: 'absolute',
            bottom: -6,
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.primary,
          }}
        />
      ) : null}
    </View>
  );
}

function SellFabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.sellFab, focused && styles.sellFabFocused]}>
      <LinearGradient
        colors={['#3B82F6', '#1E5FC6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: 28 }]}
      />
      <Ionicons name="add" size={26} color="#FFFFFF" />
    </View>
  );
}

export default function TabLayout() {
  const { isLoading, isDarkMode } = useAuth();
  const unreadCount = useUnreadMessageCount();

  const tabBarHeight = Platform.select({
    web: 94,
    default: clamp(Math.round(screenHeight * 0.115), isSmallDevice ? 78 : 88, 108),
  }) as number;

  const tabBarPaddingBottom = Platform.select({
    web: 22,
    default: isSmallDevice ? 18 : 26,
  }) as number;

  const barBg = isDarkMode ? '#0F172A' : '#FFFFFF';
  const barBorder = isDarkMode ? '#1E293B' : '#E8EEF8';

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
        tabBarInactiveTintColor: isDarkMode ? '#64748B' : '#A0ABBF',
        tabBarStyle: {
          backgroundColor: barBg,
          borderTopColor: barBorder,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 10,
          paddingHorizontal: 4,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          shadowColor: isDarkMode ? '#000' : '#0F172A',
          shadowOpacity: isDarkMode ? 0.4 : 0.10,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: -6 },
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 10,
          marginTop: 4,
          letterSpacing: 0.1,
        },
        tabBarItemStyle: {
          paddingTop: 4,
          paddingHorizontal: 0,
        },
      }}
    >
      {/* ── Anasayfa ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.home,
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name="home-outline" nameFilled="home" focused={focused} color={color} size={size} />
          ),
        }}
      />

      {/* ── Gizli: Kategoriler ── */}
      <Tabs.Screen
        name="categories"
        options={{
          href: null,
          title: 'Kategoriler',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />

      {/* ── Gizli: Favoriler ── */}
      <Tabs.Screen
        name="favorites"
        options={{
          href: null,
          title: 'Favoriler',
          tabBarIcon: ({ color, size }) => <Ionicons name="heart" size={size} color={color} />,
        }}
      />

      {/* ── Keşfet ── */}
      <Tabs.Screen
        name="explore"
        options={{
          title: t.tabs.explore,
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name="compass-outline" nameFilled="compass" focused={focused} color={color} size={size} />
          ),
        }}
      />

      {/* ── İlan Ver (FAB) ── */}
      <Tabs.Screen
        name="sell"
        options={{
          title: t.tabs.sell,
          tabBarItemStyle: { paddingTop: 0 },
          tabBarLabelStyle: {
            fontFamily: fonts.bold,
            fontSize: 10,
            marginTop: 8,
            color: colors.primary,
            letterSpacing: 0.1,
          },
          tabBarIcon: ({ focused }) => <SellFabIcon focused={focused} />,
        }}
      />

      {/* ── Mesajlar ── */}
      <Tabs.Screen
        name="messages"
        options={{
          title: t.tabs.messages,
          tabBarBadge: unreadCount > 0 ? unreadCount : null,
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name="chatbubble-ellipses-outline" nameFilled="chatbubble-ellipses" focused={focused} color={color} size={size} />
          ),
        }}
      />

      {/* ── Mağaza ── */}
      <Tabs.Screen
        name="store"
        options={{
          title: t.tabs.store,
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name="storefront-outline" nameFilled="storefront" focused={focused} color={color} size={size} />
          ),
        }}
      />


      {/* ── Gizli: Sepet ── */}
      <Tabs.Screen
        name="cart"
        options={{
          href: null,
          title: 'Sepet',
          tabBarIcon: ({ color, size }) => <Ionicons name="bag-handle-outline" size={size} color={color} />,
        }}
      />

      {/* ── Gizli: Siparişler ── */}
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
    width: 56,
    height: 56,
    borderRadius: 28,
    marginTop: -24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 14,
    overflow: 'hidden',
  },
  sellFabFocused: {
    transform: [{ scale: 1.06 }],
    shadowOpacity: 0.6,
  },
});
