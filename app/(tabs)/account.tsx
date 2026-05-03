import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { useFavorites } from '../../src/hooks/useFavorites';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useListings } from '../../src/context/ListingsContext';
import { useSubscription } from '../../src/lib/revenuecat';
import { getMyWallet, getPlanDisplayName } from '../../src/services/entitlementService';
import { useAndroidTabBackToHome } from '../../src/hooks/useAndroidTabBackToHome';
import { fetchMyAccountCore, type AccountCoreProfile } from '../../src/services/profileService';
import {
  fetchMyReports,
  fetchPendingReportsAdmin,
  reviewReportAdmin,
  type ReportRecord,
  type ReportStatus,
} from '../../src/services/reportService';
import {
  fetchUnreadNotificationCount,
  subscribeToMyNotifications,
} from '../../src/services/inAppNotificationService';
import { buildMessagesInboxRoute } from '../../src/utils/messageRouting';
import { useUserPreferences } from '../../src/hooks/useUserPreferences';
import { t } from '../../src/i18n';
import {
  getInstagramConnection,
  formatIgCount,
  type InstagramConnection,
} from '../../src/services/instagramService';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
const SUPPORT_EMAIL = 'iletisim@sipariskutusu.com';
const VACATION_KEY = '@sipariskutusu/store_vacation_mode';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SettingsItem {
  icon: IoniconName;
  label: string;
  badge?: string;
  color?: string;
  rightIcon?: IoniconName;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  info?: string;
}

interface SettingsSection {
  id: string;
  title: string;
  icon?: IoniconName;
  color?: string;
  items: SettingsItem[];
  hidden?: boolean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionRow({
  item,
  isLast,
  palette,
}: {
  item: SettingsItem;
  isLast: boolean;
  palette: ReturnType<typeof buildPalette>;
}) {
  const iconBg = (item.color ?? colors.primary) + '18';
  return (
    <Pressable
      onPress={item.onPress}
      disabled={!item.onPress && !item.toggle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: palette.border,
        backgroundColor: 'transparent',
      }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={item.icon} size={16} color={item.color ?? colors.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 11 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: item.color ?? palette.textPrimary }}>
          {item.label}
        </Text>
        {item.info ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary, marginTop: 1 }}>
            {item.info}
          </Text>
        ) : null}
      </View>
      {item.badge && !item.toggle ? (
        <View style={{ backgroundColor: (item.color ?? colors.primary) + '20', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, marginRight: 6 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: item.color ?? colors.primary }}>{item.badge}</Text>
        </View>
      ) : null}
      {item.toggle ? (
        <Switch
          value={item.toggleValue}
          onValueChange={item.onToggle}
          trackColor={{ false: '#D1D5DB', true: (item.color ?? colors.primary) + '80' }}
          thumbColor={item.toggleValue ? (item.color ?? colors.primary) : '#9CA3AF'}
        />
      ) : (
        <Ionicons name={item.rightIcon ?? 'chevron-forward'} size={15} color={palette.textMuted} />
      )}
    </Pressable>
  );
}

function SettingsSectionCard({
  section,
  palette,
}: {
  section: SettingsSection;
  palette: ReturnType<typeof buildPalette>;
}) {
  if (section.hidden) return null;
  const visibleItems = section.items.filter(Boolean);
  if (visibleItems.length === 0) return null;
  return (
    <View style={{ marginHorizontal: 14, marginTop: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7, marginLeft: 2, gap: 6 }}>
        {section.icon ? (
          <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: (section.color ?? colors.primary) + '20', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={section.icon} size={11} color={section.color ?? colors.primary} />
          </View>
        ) : null}
        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: palette.sectionLabel, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {section.title}
        </Text>
      </View>
      <View style={{ backgroundColor: palette.card, borderRadius: 16, borderWidth: 1, borderColor: palette.border, overflow: 'hidden' }}>
        {visibleItems.map((item, idx) => (
          <SectionRow key={item.label} item={item} isLast={idx === visibleItems.length - 1} palette={palette} />
        ))}
      </View>
    </View>
  );
}

// ─── Palette ──────────────────────────────────────────────────────────────────
function buildPalette(isDarkMode: boolean) {
  return {
    screenBg: isDarkMode ? '#0F172A' : '#F2F3F7',
    card: isDarkMode ? '#111827' : '#FFFFFF',
    border: isDarkMode ? '#1E293B' : '#E5E7EB',
    sectionLabel: isDarkMode ? '#4B5563' : '#9CA3AF',
    textPrimary: isDarkMode ? '#E5E7EB' : '#111827',
    textSecondary: isDarkMode ? '#94A3B8' : '#6B7280',
    textMuted: isDarkMode ? '#4B5563' : '#9CA3AF',
    avatarBg: isDarkMode ? '#1E3A8A' : '#DBEAFE',
    badgeBg: isDarkMode ? '#1E293B' : '#F3F4F6',
    buttonAlt: isDarkMode ? '#1E3A8A' : '#EFF6FF',
    buttonBorder: isDarkMode ? '#1E40AF' : '#BFDBFE',
    quickBg: isDarkMode ? '#1F2937' : '#FFFFFF',
    headerBg: colors.primary,
    surfaceBg: isDarkMode ? '#111827' : '#FFFFFF',
    surfaceAlt: isDarkMode ? '#1E293B' : '#F3F4F6',
  };
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AccountScreen() {
  const router = useRouter();
  useAndroidTabBackToHome();
  const { user, signOut, isConfigured, isDarkMode, setDarkMode } = useAuth();
  const { preferences, updatePreference } = useUserPreferences();
  const { favorites } = useFavorites();
  const { hasStore, storeMessageCount } = useListings();
  const { activePlan, creditBalance: rcCreditBalance, isRestoring, restorePurchases } = useSubscription();

  const [creditBalance, setCreditBalance] = useState(0);
  const [toast, setToast] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [accountCore, setAccountCore] = useState<AccountCoreProfile | null>(null);
  const [igConnection, setIgConnection] = useState<InstagramConnection | null>(null);
  const [myReports, setMyReports] = useState<ReportRecord[]>([]);
  const [pendingReports, setPendingReports] = useState<ReportRecord[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState('');
  const [reportActionBusyId, setReportActionBusyId] = useState<string | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [vacationMode, setVacationMode] = useState(false);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const palette = buildPalette(isDarkMode);

  // load vacation mode
  useEffect(() => {
    AsyncStorage.getItem(VACATION_KEY).then((v) => { if (v) setVacationMode(v === '1'); }).catch(() => {});
  }, []);

  // load credit wallet balance
  useEffect(() => {
    if (!user) { setCreditBalance(0); return; }
    getMyWallet().then((w) => { setCreditBalance(w?.balance ?? 0); }).catch(() => {});
  }, [user?.id]);

  // load account core
  useEffect(() => {
    let active = true;
    if (!user || !isConfigured) { setAccountCore(null); return () => { active = false; }; }
    fetchMyAccountCore()
      .then((p) => { if (active) setAccountCore(p); })
      .catch(() => { if (active) setAccountCore(null); });
    return () => { active = false; };
  }, [isConfigured, user]);

  // load ig connection
  useEffect(() => {
    if (!hasStore) return;
    getInstagramConnection().then(setIgConnection).catch(() => {});
  }, [hasStore]);

  // load reports
  useEffect(() => {
    let active = true;
    if (!user || !isConfigured) { setMyReports([]); setPendingReports([]); setReportsError(''); return () => { active = false; }; }
    setReportsLoading(true);
    setReportsError('');
    Promise.all([
      fetchMyReports(30),
      accountCore?.resolved_role === 'admin' ? fetchPendingReportsAdmin(50) : Promise.resolve([]),
    ])
      .then(([mine, pending]) => {
        if (!active) return;
        setMyReports(mine);
        setPendingReports(pending);
      })
      .catch((err) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Şikayetler yüklenemedi.';
        const lower = msg.toLowerCase();
        if (!lower.includes('session') && !lower.includes('jwt') && !lower.includes('auth')) setReportsError(msg);
      })
      .finally(() => { if (active) setReportsLoading(false); });
    return () => { active = false; };
  }, [accountCore?.resolved_role, isConfigured, user?.id]);

  // unread notifications badge
  useEffect(() => {
    let active = true;
    if (!user || !isConfigured) { setUnreadNotificationCount(0); return () => { active = false; }; }
    const refresh = () => {
      fetchUnreadNotificationCount()
        .then((c) => { if (active) setUnreadNotificationCount(c); })
        .catch(() => { if (active) setUnreadNotificationCount(0); });
    };
    refresh();
    const unsub = subscribeToMyNotifications(user.id, refresh);
    return () => { active = false; unsub(); };
  }, [isConfigured, user?.id]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  function requireAuth(msg: string) {
    if (user) return true;
    showToast(msg);
    router.push('/auth');
    return false;
  }

  const handleVacationToggle = useCallback(async (v: boolean) => {
    setVacationMode(v);
    await AsyncStorage.setItem(VACATION_KEY, v ? '1' : '0').catch(() => {});
    showToast(v ? 'Tatil modu açıldı. Mağazanız geçici olarak kapalı görünecek.' : 'Tatil modu kapatıldı.');
  }, []);

  const handlePrivateToggle = useCallback(async (v: boolean) => {
    await updatePreference('privateProfile', v);
    showToast(v ? 'Profil gizliliği açıldı.' : 'Profil herkese açık.');
  }, [updatePreference]);

  const handleThemeToggle = useCallback(async (v: boolean) => {
    await setDarkMode(v);
  }, [setDarkMode]);

  const handleClearCache = useCallback(async () => {
    Alert.alert(
      'Önbelleği Temizle',
      'Önbelleğe alınmış resimler ve geçici veriler silinecek. Devam etmek istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: async () => {
            setCacheBusy(true);
            try {
              const keys = await AsyncStorage.getAllKeys();
              const cacheKeys = keys.filter((k) => k.includes('cache') || k.includes('recently_viewed'));
              if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
              showToast('Önbellek temizlendi.');
            } catch {
              showToast('Önbellek temizlenemedi.');
            } finally {
              setCacheBusy(false);
            }
          },
        },
      ],
    );
  }, []);

  async function handleConfirmSignOut() {
    setLogoutBusy(true);
    try { await signOut(); } catch (err) { showToast(err instanceof Error ? err.message : 'Çıkış yapılamadı.'); }
    finally { setLogoutBusy(false); setShowLogoutModal(false); }
  }

  function formatReportStatus(status: ReportStatus): { label: string; color: string; bg: string } {
    if (status === 'pending') return { label: 'Bekliyor', color: '#92400E', bg: '#FEF3C7' };
    if (status === 'reviewed') return { label: 'İncelendi', color: '#1E40AF', bg: '#DBEAFE' };
    if (status === 'resolved') return { label: 'Çözüldü', color: '#065F46', bg: '#D1FAE5' };
    return { label: 'Reddedildi', color: '#991B1B', bg: '#FEE2E2' };
  }

  function formatReportTarget(targetType: ReportRecord['targetType']): string {
    if (targetType === 'listing') return 'İlan';
    if (targetType === 'user') return 'Kullanıcı';
    return 'Yorum';
  }

  async function handleAdminReportDecision(reportId: string, status: Exclude<ReportStatus, 'pending'>) {
    setReportActionBusyId(reportId);
    setReportsError('');
    try {
      await reviewReportAdmin(reportId, status, status === 'rejected' ? 'Admin tarafından uygun bulunmadı.' : 'Admin incelemesi tamamlandı.');
      const [mine, pending] = await Promise.all([fetchMyReports(30), fetchPendingReportsAdmin(50)]);
      setMyReports(mine);
      setPendingReports(pending);
      showToast('Şikayet güncellendi.');
    } catch (err) {
      setReportsError(err instanceof Error ? err.message : 'Şikayet güncellenemedi.');
    } finally {
      setReportActionBusyId(null);
    }
  }

  async function openEmail(subject: string) {
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
    const canOpen = await Linking.canOpenURL(mailto);
    if (canOpen) await Linking.openURL(mailto);
    else showToast(`İletişim: ${SUPPORT_EMAIL}`);
  }

  // ─── Derived ────────────────────────────────────────────────────────────────
  const displayName = (user?.user_metadata?.full_name as string | undefined) ?? 'Misafir Kullanıcı';
  const displayEmail = user?.email ?? (isConfigured ? 'Giriş yapılmadı' : 'Yapılandırma eksik');
  const resolvedRole = accountCore?.resolved_role ?? (hasStore ? 'seller' : 'buyer');
  const roleLabel = resolvedRole === 'seller' ? 'Satıcı / İçerik Üretici' : resolvedRole === 'admin' ? 'Yönetici' : 'Alıcı';
  const sellerContactLine = accountCore?.seller_profile
    ? [
        accountCore.seller_profile.store_name,
        accountCore.seller_profile.instagram_handle ? `@${accountCore.seller_profile.instagram_handle}` : null,
        accountCore.seller_profile.whatsapp,
      ].filter(Boolean).join(' • ')
    : null;
  const profileBioLine = accountCore?.bio?.trim() || null;
  const themeBadge = isDarkMode ? 'Koyu' : 'Açık';
  const langBadge = preferences.language === 'en' ? 'EN' : 'TR';
  const savedSearchCount = preferences.savedSearches?.length ?? 0;

  // ─── Sections ────────────────────────────────────────────────────────────────
  const sections: SettingsSection[] = [
    {
      id: 'account',
      title: '1. Hesap Ayarları',
      icon: 'person-circle-outline',
      color: '#3B82F6',
      items: [
        {
          icon: 'person-outline',
          label: 'Kişisel Bilgiler',
          info: 'Ad, kullanıcı adı, biyografi',
          color: '#3B82F6',
          onPress: () => { if (!requireAuth('Kişisel bilgiler için giriş yapman gerekiyor.')) return; router.push('/profile-edit'); },
        },
        {
          icon: 'mail-outline',
          label: 'Telefon / E-posta',
          info: user?.email ?? '—',
          color: '#6366F1',
          onPress: () => { if (!requireAuth('Bu özellik için giriş yapman gerekiyor.')) return; router.push('/profile-edit'); },
        },
        {
          icon: 'key-outline',
          label: 'Şifre Değiştir',
          color: '#8B5CF6',
          onPress: () => { if (!requireAuth('Şifre değiştirmek için giriş yapman gerekiyor.')) return; router.push('/security'); },
        },
        {
          icon: 'pause-circle-outline',
          label: 'Hesabı Dondur',
          info: 'Profilin geçici olarak gizlenir',
          color: '#F59E0B',
          onPress: () => {
            if (!requireAuth('Bu özellik için giriş yapman gerekiyor.')) return;
            setShowFreezeModal(true);
          },
        },
        {
          icon: 'trash-outline',
          label: 'Hesap Silme Talebi',
          info: 'Hesabın kalıcı olarak kapatılır',
          color: '#EF4444',
          onPress: () => {
            if (!requireAuth('Bu özellik için giriş yapman gerekiyor.')) return;
            setShowDeleteModal(true);
          },
        },
      ],
    },
    {
      id: 'shopping',
      title: '2. Teslimat & Ödeme',
      icon: 'card-outline',
      color: '#0EA5E9',
      hidden: !user,
      items: [
        {
          icon: 'location-outline',
          label: 'Adreslerim',
          info: 'Teslimat adreslerini yönet',
          color: '#0EA5E9',
          onPress: () => router.push('/addresses' as never),
        },
        {
          icon: 'card-outline',
          label: 'Ödeme Yöntemlerim',
          info: 'Kart ve cüzdan bilgileri',
          color: '#6366F1',
          onPress: () => router.push('/payment-methods' as never),
        },
      ],
    },
    {
      id: 'store',
      title: '3. Mağaza Ayarları',
      icon: 'storefront-outline',
      color: '#10B981',
      hidden: !user,
      items: hasStore
        ? [
            {
              icon: 'storefront-outline',
              label: 'Mağaza Profili Düzenle',
              info: 'İsim, açıklama, kapak fotoğrafı',
              color: '#10B981',
              onPress: () => router.push('/store-settings'),
            },
            {
              icon: 'logo-instagram',
              label: 'Instagram Bağlantısı',
              info: igConnection?.connected ? `@${igConnection.username} bağlı` : 'Bağlı değil',
              color: '#E1306C',
              onPress: () => router.push('/instagram-connect' as never),
            },
            {
              icon: 'eye-outline',
              label: 'Mağaza Görünürlüğü',
              info: 'Profilini herkese açık tut',
              color: '#3B82F6',
              toggle: true,
              toggleValue: !vacationMode,
              onToggle: (v) => handleVacationToggle(!v),
            },
            {
              icon: 'moon-outline',
              label: 'Tatil Modu / Geçici Kapalı',
              info: vacationMode ? 'Mağazanız şu an kapalı görünüyor' : 'Satışları geçici durdurur',
              color: '#F59E0B',
              toggle: true,
              toggleValue: vacationMode,
              onToggle: handleVacationToggle,
            },
          ]
        : [
            {
              icon: 'add-circle-outline',
              label: 'Satıcı Hesabı Aç',
              info: 'Mağaza kurarak satış yapmaya başla',
              color: '#10B981',
              onPress: () => router.push('/store-setup'),
            },
          ],
    },
    {
      id: 'notifications',
      title: '4. Bildirim Ayarları',
      icon: 'notifications-outline',
      color: '#6366F1',
      items: [
        {
          icon: 'settings-outline',
          label: 'Bildirim Tercihleri',
          info: 'Her bildirim türünü aç/kapat',
          color: '#6366F1',
          badge: unreadNotificationCount > 0 ? String(Math.min(unreadNotificationCount, 99)) : undefined,
          onPress: () => router.push('/notification-settings' as never),
        },
        {
          icon: 'list-outline',
          label: 'Bildirim Geçmişi',
          info: 'Tüm bildirimlerini görüntüle',
          color: '#8B5CF6',
          badge: unreadNotificationCount > 0 ? String(Math.min(unreadNotificationCount, 99)) : undefined,
          onPress: () => router.push('/notifications'),
        },
      ],
    },
    {
      id: 'privacy',
      title: '5. Gizlilik ve Güvenlik',
      icon: 'shield-checkmark-outline',
      color: '#EF4444',
      items: [
        {
          icon: 'shield-checkmark-outline',
          label: 'Güvenlik Ayarları',
          info: 'Şifre, 2FA, oturumlar, giriş geçmişi',
          color: '#EF4444',
          onPress: () => { if (!requireAuth('Güvenlik ayarları için giriş yapman gerekiyor.')) return; router.push('/security'); },
        },
        {
          icon: 'person-remove-outline',
          label: 'Engellenen Kullanıcılar',
          info: `${preferences.blockedUserIds?.length ?? 0} engellenen kullanıcı`,
          color: '#F97316',
          onPress: () => { if (!requireAuth('Bu özellik için giriş yapman gerekiyor.')) return; router.push('/blocked-users' as never); },
        },
        {
          icon: 'flag-outline',
          label: 'Şikayet Geçmişim',
          info: `${myReports.length} kayıt`,
          color: '#F59E0B',
          onPress: () => { if (!requireAuth('Bu özellik için giriş yapman gerekiyor.')) return; router.push('/my-reports'); },
        },
        {
          icon: 'eye-off-outline',
          label: 'Profil Görünürlüğü',
          info: preferences.privateProfile ? 'Sadece takipçiler görebilir' : 'Herkese açık',
          color: '#64748B',
          toggle: true,
          toggleValue: preferences.privateProfile,
          onToggle: handlePrivateToggle,
        },
        {
          icon: 'chatbubble-ellipses-outline',
          label: 'Mesaj Alma İzinleri',
          info: 'Kimlerin mesaj gönderebileceğini belirle',
          color: '#6366F1',
          onPress: () => { if (!requireAuth('Bu özellik için giriş yapman gerekiyor.')) return; router.push('/message-permissions' as never); },
        },
      ],
    },
    {
      id: 'locale',
      title: '6. Dil ve Bölge',
      icon: 'language-outline',
      color: '#0EA5E9',
      items: [
        {
          icon: 'language-outline',
          label: 'Dil / Bölge / Para Birimi',
          info: `${langBadge} • ${preferences.currency ?? 'TRY'}`,
          color: '#0EA5E9',
          badge: langBadge,
          onPress: () => router.push('/preferences'),
        },
      ],
    },
    {
      id: 'appearance',
      title: '7. Görünüm',
      icon: 'color-palette-outline',
      color: '#8B5CF6',
      items: [
        {
          icon: 'moon-outline',
          label: 'Koyu Mod',
          info: isDarkMode ? 'Aktif' : 'Kapalı',
          color: '#6366F1',
          toggle: true,
          toggleValue: isDarkMode,
          onToggle: handleThemeToggle,
        },
        {
          icon: 'sunny-outline',
          label: 'Tema Tercihleri',
          info: `${themeBadge} tema seçili`,
          color: '#F59E0B',
          badge: themeBadge,
          onPress: () => router.push('/preferences'),
        },
      ],
    },
    {
      id: 'favorites',
      title: '8. Favori ve Takip',
      icon: 'heart-outline',
      color: '#EF4444',
      items: [
        {
          icon: 'heart-outline',
          label: 'Favori Ürünlerim',
          info: `${favorites.length} ürün`,
          color: '#EF4444',
          badge: favorites.length > 0 ? String(favorites.length) : undefined,
          onPress: () => router.push('/(tabs)/favorites'),
        },
        {
          icon: 'storefront-outline',
          label: 'Takip Ettiğim Mağazalar',
          info: 'Takip listeni yönet',
          color: '#10B981',
          onPress: () => { if (!requireAuth('Bu özellik için giriş yapman gerekiyor.')) return; router.push('/follow-list' as never); },
        },
        {
          icon: 'time-outline',
          label: 'Son Baktığım Ürünler',
          info: 'Geçmiş gezintilerin',
          color: '#F59E0B',
          onPress: () => router.push('/(tabs)/explore' as never),
        },
        {
          icon: 'search-outline',
          label: 'Kaydedilen Aramalar',
          info: `${savedSearchCount} kayıtlı arama`,
          color: '#6366F1',
          badge: savedSearchCount > 0 ? String(savedSearchCount) : undefined,
          onPress: () => router.push('/search'),
        },
      ],
    },
    {
      id: 'support',
      title: '9. Destek',
      icon: 'help-circle-outline',
      color: '#06B6D4',
      items: [
        {
          icon: 'headset-outline',
          label: 'Canlı Destek',
          info: 'Temsilciyle sohbet et',
          color: '#06B6D4',
          onPress: () => router.push(buildMessagesInboxRoute()),
        },
        {
          icon: 'help-circle-outline',
          label: 'Yardım Merkezi',
          info: 'Sık sorulan sorular ve kılavuzlar',
          color: '#0EA5E9',
          onPress: () => openEmail('Sipariş Kutusu Yardım Talebi'),
        },
        {
          icon: 'mail-outline',
          label: 'İletişim E-postası',
          info: SUPPORT_EMAIL,
          color: '#6366F1',
          onPress: () => openEmail('Sipariş Kutusu Destek'),
        },
        {
          icon: 'chatbubbles-outline',
          label: 'Geri Bildirim Gönder',
          info: 'Görüş ve önerilerini paylaş',
          color: '#8B5CF6',
          onPress: () => openEmail('Geri Bildirim — Sipariş Kutusu'),
        },
      ],
    },
    {
      id: 'legal',
      title: '10. Yasal',
      icon: 'document-text-outline',
      color: '#64748B',
      items: [
        {
          icon: 'document-text-outline',
          label: 'Kullanım Şartları',
          color: '#64748B',
          onPress: () => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms-of-use' } }),
        },
        {
          icon: 'lock-closed-outline',
          label: 'Gizlilik Politikası & KVKK',
          color: '#64748B',
          onPress: () => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy-kvkk' } }),
        },
        {
          icon: 'ban-outline',
          label: 'Yasaklı Ürünler',
          color: '#64748B',
          onPress: () => router.push({ pathname: '/legal/[doc]', params: { doc: 'prohibited-products' } }),
        },
        {
          icon: 'alert-circle-outline',
          label: 'Sorumluluk Reddi',
          color: '#64748B',
          onPress: () => router.push({ pathname: '/legal/[doc]', params: { doc: 'platform-liability' } }),
        },
      ],
    },
    {
      id: 'app',
      title: '11. Uygulama',
      icon: 'apps-outline',
      color: '#94A3B8',
      items: [
        {
          icon: 'information-circle-outline',
          label: 'Sürüm Bilgisi',
          info: 'v1.0.0 (derleme 4)',
          color: '#94A3B8',
          rightIcon: 'ellipse-outline',
          onPress: () => showToast('Sipariş Kutusu v1.0.0 — En son sürüm'),
        },
        {
          icon: 'refresh-outline',
          label: cacheBusy ? 'Temizleniyor...' : 'Önbelleği Temizle',
          info: 'Geçici dosyalar ve resimler',
          color: '#3B82F6',
          onPress: handleClearCache,
        },
        {
          icon: 'bug-outline',
          label: 'Hata Bildir',
          info: 'Hata ve sorunları bildirin',
          color: '#F97316',
          onPress: () => openEmail('Hata Bildirimi — Sipariş Kutusu'),
        },
        {
          icon: 'log-out-outline',
          label: 'Çıkış Yap',
          color: '#EF4444',
          onPress: () => { if (!user) { router.push('/auth'); return; } setShowLogoutModal(true); },
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.screenBg }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80 }}>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: '#fff' }}>{t.account.title}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: '#BFDBFE', marginTop: 2 }}>
            Profil ve uygulama ayarları
          </Text>
        </View>

        {/* ── Profile Card ── */}
        <View style={{ marginHorizontal: 14, marginTop: -60, backgroundColor: palette.card, borderRadius: 20, padding: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, borderWidth: 1, borderColor: palette.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {accountCore?.avatar_url
              ? <Image source={{ uri: accountCore.avatar_url }} style={{ width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: colors.primary + '40' }} />
              : (
                <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: palette.avatarBg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.primary + '40' }}>
                  <Text style={{ fontFamily: fonts.headingBold, fontSize: 26, color: colors.primary }}>{(displayName[0] ?? 'M').toUpperCase()}</Text>
                </View>
              )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: palette.textPrimary }}>{displayName}</Text>
                {user
                  ? <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="checkmark-sharp" size={11} color="#059669" /></View>
                  : null}
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary, marginTop: 1 }}>{displayEmail}</Text>
              {profileBioLine
                ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary, marginTop: 4 }} numberOfLines={2}>{profileBioLine}</Text>
                : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <View style={{ backgroundColor: resolvedRole === 'seller' ? palette.avatarBg : palette.badgeBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: resolvedRole === 'seller' ? colors.primary : palette.textSecondary }}>{roleLabel}</Text>
                </View>
                {sellerContactLine
                  ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary }} numberOfLines={1}>{sellerContactLine}</Text>
                  : null}
              </View>
            </View>
          </View>

          {/* Profil düzenle butonu */}
          {user
            ? (
              <Pressable
                onPress={() => router.push('/profile-edit')}
                style={{ marginTop: 12, height: 38, borderRadius: 12, backgroundColor: palette.buttonAlt, borderWidth: 1, borderColor: palette.buttonBorder, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
              >
                <Ionicons name="create-outline" size={14} color={colors.primary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>Profili Düzenle</Text>
              </Pressable>
            )
            : (
              <Pressable
                onPress={() => router.push('/auth')}
                style={{ marginTop: 12, height: 38, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>Giriş Yap / Kayıt Ol</Text>
              </Pressable>
            )}

          {user && resolvedRole === 'buyer'
            ? (
              <Pressable
                onPress={() => router.push('/store-setup')}
                style={{ marginTop: 8, borderColor: palette.buttonBorder, backgroundColor: palette.buttonAlt, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>Satıcı / İçerik Üretici hesabına geç →</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary, marginTop: 3 }}>Mağaza aç, Instagram ile satış akışını başlat</Text>
              </Pressable>
            ) : null}

          {/* Stats row */}
          <View style={{ flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.border }}>
            <Pressable style={{ flex: 1, alignItems: 'center' }} onPress={() => { if (requireAuth('Mağaza için giriş yapman gerekiyor.')) router.push(hasStore ? '/store-settings' : '/store-setup'); }}>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: palette.textPrimary }}>{hasStore ? 1 : 0}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary }}>Mağaza</Text>
            </Pressable>
            <View style={{ width: 1, backgroundColor: palette.border }} />
            <Pressable style={{ flex: 1, alignItems: 'center' }} onPress={() => router.push('/(tabs)/favorites')}>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: palette.textPrimary }}>{favorites.length}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary }}>Favori</Text>
            </Pressable>
            <View style={{ width: 1, backgroundColor: palette.border }} />
            <Pressable style={{ flex: 1, alignItems: 'center' }} onPress={() => router.push(buildMessagesInboxRoute())}>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: storeMessageCount > 0 ? colors.primary : palette.textPrimary }}>{storeMessageCount}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary }}>Mesaj</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Quick Actions ── */}
        <View style={{ flexDirection: 'row', marginHorizontal: 14, marginTop: 12, gap: 8 }}>
          {([
            { icon: 'heart' as const,              label: 'Favoriler',  color: '#3B82F6', badge: null as string | null, route: '/(tabs)/favorites' },
            { icon: 'cart' as const,               label: 'Sepetim',    color: '#F59E0B', badge: null,                   route: '/(tabs)/cart' },
            { icon: 'grid' as const,               label: 'Kategoriler',color: '#8B5CF6', badge: null,                   route: '/(tabs)/categories' },
            { icon: 'chatbubble-ellipses' as const,label: 'Mesajlar',   color: '#0F766E', badge: storeMessageCount > 0 ? String(Math.min(storeMessageCount, 99)) : null, route: null },
            { icon: 'storefront' as const,         label: 'Mağazam',    color: '#1E5FC6', badge: null,                   route: null },
          ] as const).map((a) => (
            <Pressable
              key={a.label}
              onPress={() => {
                if (a.label === 'Mesajlar') { router.push(buildMessagesInboxRoute()); return; }
                if (a.label === 'Mağazam') { if (!requireAuth('Mağaza için giriş yapman gerekiyor.')) return; router.push(hasStore ? '/store-settings' : '/store-setup'); return; }
                router.push(a.route as never);
              }}
              style={{ flex: 1, backgroundColor: palette.quickBg, borderColor: palette.border, borderWidth: 1, borderRadius: 14, alignItems: 'center', paddingVertical: 11 }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: a.color + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 5 }}>
                <Ionicons name={a.icon} size={15} color={a.color} />
                {a.badge
                  ? <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 8, minWidth: 15, height: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 8, color: '#fff' }}>{a.badge}</Text>
                    </View>
                  : null}
              </View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: palette.textPrimary }}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Instagram Integration Card (sellers only) ── */}
        {hasStore && user
          ? (
            <Pressable
              onPress={() => router.push('/instagram-connect' as never)}
              style={{ marginHorizontal: 14, marginTop: 12, backgroundColor: igConnection?.connected ? (isDarkMode ? '#3D0A1A' : '#FFF0F5') : palette.card, borderRadius: 16, borderWidth: 1.5, borderColor: igConnection?.connected ? '#E1306C44' : palette.border, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#E1306C15', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="logo-instagram" size={20} color="#E1306C" />
              </View>
              <View style={{ flex: 1 }}>
                {igConnection?.connected
                  ? <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.textPrimary }}>@{igConnection.username}</Text>
                        <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#16A34A' }}>BAĞLI</Text>
                        </View>
                      </View>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary, marginTop: 2 }}>
                        {formatIgCount(igConnection.followersCount)} takipçi • İçerikleri görüntüle
                      </Text>
                    </>
                  : <>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.textPrimary }}>Instagram Bağla</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary, marginTop: 2 }}>Gönderilerini otomatik ürüne dönüştür</Text>
                    </>}
              </View>
              <Ionicons name="chevron-forward" size={16} color={palette.textMuted} />
            </Pressable>
          ) : null}

        {/* ── Abonelik & Ödemeler Bölümü ── */}
        {user ? (
          <View style={{ marginHorizontal: 14, marginTop: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7, marginLeft: 2, gap: 6 }}>
              <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="diamond-outline" size={11} color={colors.primary} />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: palette.sectionLabel, textTransform: 'uppercase', letterSpacing: 0.5 }}>Abonelik & Ödemeler</Text>
            </View>
            <View style={{ backgroundColor: palette.card, borderRadius: 14, borderWidth: 1, borderColor: palette.border }}>
              {/* Plan banner */}
              <Pressable
                onPress={() => router.push('/subscription' as never)}
                style={{ padding: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: palette.border }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Ionicons name="diamond-outline" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.textPrimary }}>Paketim</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary, marginTop: 1 }}>
                    {getPlanDisplayName(activePlan as any)} planı aktif
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {activePlan === 'free' && (
                    <View style={{ backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>Yükselt</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={14} color={palette.textMuted} />
                </View>
              </Pressable>

              {/* Credits row */}
              <Pressable
                onPress={() => router.push('/credits' as never)}
                style={{ padding: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: palette.border }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#8B5CF615', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Ionicons name="diamond" size={16} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.textPrimary }}>Kredilerim</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary, marginTop: 1 }}>
                    {creditBalance} kredi mevcut
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={palette.textMuted} />
              </Pressable>

              {/* Boosts row */}
              <Pressable
                onPress={() => router.push('/my-boosts' as never)}
                style={{ padding: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: palette.border }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F59E0B15', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Ionicons name="flash-outline" size={16} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.textPrimary }}>Boostlarım</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary, marginTop: 1 }}>Aktif boostlar ve geçmiş</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={palette.textMuted} />
              </Pressable>

              {/* Billing history row */}
              <Pressable
                onPress={() => router.push('/billing-history' as never)}
                style={{ padding: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: palette.border }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#0EA5E915', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Ionicons name="receipt-outline" size={16} color="#0EA5E9" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.textPrimary }}>İşlem Geçmişi</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary, marginTop: 1 }}>Abonelik, kredi, boost</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={palette.textMuted} />
              </Pressable>

              {/* Restore purchases row */}
              <Pressable
                onPress={async () => {
                  const result = await restorePurchases();
                  showToast(result ? 'Satın alımlar geri yüklendi.' : 'Geri yükleme tamamlandı.');
                }}
                disabled={isRestoring}
                style={{ padding: 14, flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#10B98115', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  {isRestoring ? <ActivityIndicator size="small" color="#10B981" /> : <Ionicons name="refresh-outline" size={16} color="#10B981" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.textPrimary }}>Satın Alımları Geri Yükle</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary, marginTop: 1 }}>Cihaz değişikliğinde kullan</Text>
                </View>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* ── 10 Settings Sections ── */}
        {sections.map((section) => (
          <SettingsSectionCard key={section.id} section={section} palette={palette} />
        ))}

        {/* ── Reports (kullanıcı şikayetleri) ── */}
        {user
          ? (
            <View style={{ marginHorizontal: 14, marginTop: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7, marginLeft: 2, gap: 6 }}>
                <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: '#F59E0B20', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="flag-outline" size={11} color="#F59E0B" />
                </View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: palette.sectionLabel, textTransform: 'uppercase', letterSpacing: 0.5 }}>Şikayetlerim</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textMuted, marginLeft: 'auto' }}>{myReports.length} kayıt</Text>
              </View>
              <Pressable
                onPress={() => router.push('/my-reports')}
                style={{ backgroundColor: palette.buttonAlt, borderColor: palette.buttonBorder, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>Tüm Şikayetlerimi Gör →</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary, marginTop: 3 }}>Geçmiş kayıtlar, karar notları, durum filtreleri</Text>
              </Pressable>
              <View style={{ backgroundColor: palette.card, borderRadius: 14, borderWidth: 1, borderColor: palette.border, padding: 12 }}>
                {reportsLoading
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : myReports.length > 0
                    ? myReports.slice(0, 5).map((r, i) => {
                        const s = formatReportStatus(r.status);
                        return (
                          <View key={r.id} style={{ borderBottomWidth: i < Math.min(myReports.length, 5) - 1 ? 1 : 0, borderBottomColor: palette.border, paddingVertical: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: palette.textPrimary }}>{formatReportTarget(r.targetType)} • {r.reason}</Text>
                              <View style={{ backgroundColor: s.bg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 }}>
                                <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: s.color }}>{s.label}</Text>
                              </View>
                            </View>
                            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary, marginTop: 2 }}>{new Date(r.createdAt).toLocaleString('tr-TR')}</Text>
                          </View>
                        );
                      })
                    : <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary }}>Henüz şikayet kaydın bulunmuyor.</Text>}
              </View>
            </View>
          ) : null}

        {/* ── Admin Panel ── */}
        {user && accountCore?.resolved_role === 'admin'
          ? (
            <View style={{ marginHorizontal: 14, marginTop: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7, marginLeft: 2, gap: 6 }}>
                <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: '#EF444420', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="shield-outline" size={11} color="#EF4444" />
                </View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: palette.sectionLabel, textTransform: 'uppercase', letterSpacing: 0.5 }}>Admin — Bekleyen Şikayetler</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textMuted, marginLeft: 'auto' }}>{pendingReports.length} bekleyen</Text>
              </View>
              <Pressable onPress={() => router.push('/report-moderation')} style={{ backgroundColor: palette.buttonAlt, borderColor: palette.buttonBorder, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>Gelişmiş Moderasyon Ekranı →</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary, marginTop: 3 }}>Filtre, istatistik ve toplu akış görünümü</Text>
              </Pressable>
              <View style={{ backgroundColor: palette.card, borderRadius: 14, borderWidth: 1, borderColor: palette.border, padding: 12 }}>
                {pendingReports.length > 0
                  ? pendingReports.slice(0, 6).map((r, i) => (
                      <View key={r.id} style={{ borderBottomWidth: i < Math.min(pendingReports.length, 6) - 1 ? 1 : 0, borderBottomColor: palette.border, paddingVertical: 10 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: palette.textPrimary }}>{formatReportTarget(r.targetType)} • {r.reason}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary, marginTop: 2 }}>{new Date(r.createdAt).toLocaleString('tr-TR')}</Text>
                        {r.description ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textMuted, marginTop: 2 }}>{r.description}</Text> : null}
                        <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
                          {(['reviewed', 'resolved', 'rejected'] as const).map((action) => {
                            const cfg = {
                              reviewed: { label: 'İncelendi', bg: '#EFF6FF', border: '#93C5FD', text: '#1E40AF' },
                              resolved: { label: 'Çözüldü', bg: '#ECFDF5', border: '#86EFAC', text: '#065F46' },
                              rejected: { label: 'Reddet', bg: '#FEF2F2', border: '#FCA5A5', text: '#991B1B' },
                            }[action];
                            return (
                              <Pressable
                                key={action}
                                disabled={reportActionBusyId === r.id}
                                onPress={() => handleAdminReportDecision(r.id, action)}
                                style={{ backgroundColor: cfg.bg, borderColor: cfg.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                              >
                                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: cfg.text }}>{cfg.label}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ))
                  : <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary }}>Bekleyen şikayet bulunmuyor.</Text>}
              </View>
            </View>
          ) : null}

        {reportsError
          ? <View style={{ marginHorizontal: 14, marginTop: 10, backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#991B1B' }}>{reportsError}</Text>
            </View>
          : null}

        {/* Footer */}
        <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textMuted }}>Sipariş Kutusu v1.0.0 • © 2025</Text>
        </View>
      </ScrollView>

      {/* ── Toast ── */}
      {toast
        ? <View style={{ position: 'absolute', bottom: 24, left: 16, right: 16, backgroundColor: '#1F2937', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: '#fff', textAlign: 'center' }}>{toast}</Text>
          </View>
        : null}

      {/* ── Logout Modal ── */}
      <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={() => { if (!logoutBusy) setShowLogoutModal(false); }}>
          <View style={{ backgroundColor: palette.card, borderRadius: 22, padding: 24, width: 300, alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name="log-out-outline" size={28} color="#EF4444" />
            </View>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: palette.textPrimary, textAlign: 'center' }}>Çıkış yapmak istiyor musunuz?</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: palette.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 19 }}>Hesabınızdan güvenli çıkış yapılacak.</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' }}>
              <Pressable disabled={logoutBusy} onPress={() => setShowLogoutModal(false)} style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: palette.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.textPrimary }}>Vazgeç</Text>
              </Pressable>
              <Pressable disabled={logoutBusy} onPress={handleConfirmSignOut} style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', opacity: logoutBusy ? 0.7 : 1 }}>
                {logoutBusy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Çıkış Yap</Text>}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── Hesabı Dondur Modal ── */}
      <Modal visible={showFreezeModal} transparent animationType="fade" onRequestClose={() => setShowFreezeModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowFreezeModal(false)}>
          <View style={{ backgroundColor: palette.card, borderRadius: 22, padding: 24, width: 300, alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name="pause-circle-outline" size={28} color="#F59E0B" />
            </View>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: palette.textPrimary, textAlign: 'center' }}>Hesabı Dondur</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: palette.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 19 }}>
              Hesabınız geçici olarak gizlenecek. Dilediğinizde tekrar aktif edebilirsiniz. Bu özellik yakında kullanıma açılacak.
            </Text>
            <Pressable onPress={() => setShowFreezeModal(false)} style={{ marginTop: 18, width: '100%', height: 46, borderRadius: 12, backgroundColor: palette.buttonAlt, borderWidth: 1, borderColor: palette.buttonBorder, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>Tamam</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── Hesap Sil Modal ── */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowDeleteModal(false)}>
          <View style={{ backgroundColor: palette.card, borderRadius: 22, padding: 24, width: 300, alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name="trash-outline" size={28} color="#EF4444" />
            </View>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: palette.textPrimary, textAlign: 'center' }}>Hesap Silme Talebi</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: palette.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 19 }}>
              Hesabınızın silinmesi için destek ekibimize başvurmanız gerekmektedir. Tüm verileriniz kalıcı olarak silinecektir.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, width: '100%' }}>
              <Pressable onPress={() => setShowDeleteModal(false)} style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: palette.surfaceAlt, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: palette.textPrimary }}>Vazgeç</Text>
              </Pressable>
              <Pressable
                onPress={async () => { setShowDeleteModal(false); await openEmail('Hesap Silme Talebi'); }}
                style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>Talep Gönder</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
