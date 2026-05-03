import { View, Text, ScrollView, Pressable, Linking, Image, Modal, ActivityIndicator } from 'react-native';
import { useFavorites } from '../../src/hooks/useFavorites';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { colors, fonts } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { useListings } from '../../src/context/ListingsContext';
import { useAndroidTabBackToHome } from '../../src/hooks/useAndroidTabBackToHome';
import { fetchMyAccountCore, type AccountCoreProfile } from '../../src/services/profileService';
import { fetchMyReports, fetchPendingReportsAdmin, reviewReportAdmin, type ReportRecord, type ReportStatus } from '../../src/services/reportService';
import { fetchUnreadNotificationCount, subscribeToMyNotifications } from '../../src/services/inAppNotificationService';
import { buildMessagesInboxRoute } from '../../src/utils/messageRouting';
import { useUserPreferences } from '../../src/hooks/useUserPreferences';
import { t } from '../../src/i18n';
import { getInstagramConnection, formatIgCount, type InstagramConnection } from '../../src/services/instagramService';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const SUPPORT_EMAIL = 'iletisim@sipariskutusu.com';

type SectionItem = { icon: IoniconName; label: string; badge?: string; color?: string };
type Section = { title: string; items: SectionItem[] };

function buildSections(): Section[] {
  return [
    {
      title: t.account.myAccount,
      items: [
        { icon: 'person-outline', label: t.account.personalInfo },
        { icon: 'storefront-outline', label: t.account.storeProfile },
        { icon: 'location-outline', label: t.account.addresses },
        { icon: 'card-outline', label: t.account.paymentMethods },
        { icon: 'bag-handle-outline', label: t.account.conversationHistory },
        { icon: 'shield-checkmark-outline', label: t.account.security },
      ],
    },
    {
      title: t.account.support,
      items: [
        { icon: 'chatbubbles-outline', label: t.account.liveSupport },
        { icon: 'help-circle-outline', label: t.account.helpCenter },
        { icon: 'mail-outline', label: t.account.contactEmail },
        { icon: 'document-text-outline', label: t.account.termsPrivacy },
        { icon: 'language-outline', label: t.account.languageRegion, badge: 'TR' },
      ],
    },
    {
      title: t.account.app,
      items: [
        { icon: 'notifications-outline', label: t.account.notifications },
        { icon: 'moon-outline', label: t.account.appearance },
        { icon: 'log-out-outline', label: t.account.signOut, color: colors.danger },
      ],
    },
  ];
}

export default function AccountScreen() {
  const router = useRouter();
  useAndroidTabBackToHome();
  const { user, signOut, isConfigured, isDarkMode } = useAuth();
  const { preferences } = useUserPreferences();
  const { favorites } = useFavorites();
  const { hasStore, storeMessageCount } = useListings();
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

  useEffect(() => {
    let active = true;

    if (!user || !isConfigured) {
      setAccountCore(null);
      return () => {
        active = false;
      };
    }

    fetchMyAccountCore()
      .then((profile) => {
        if (active) {
          setAccountCore(profile);
        }
      })
      .catch(() => {
        if (active) {
          setAccountCore(null);
        }
      });

    return () => {
      active = false;
    };
  }, [isConfigured, user]);

  useEffect(() => {
    if (!hasStore) return;
    getInstagramConnection().then(setIgConnection).catch(() => {});
  }, [hasStore]);

  useEffect(() => {
    let active = true;

    if (!user || !isConfigured) {
      setMyReports([]);
      setPendingReports([]);
      setReportsError('');
      return () => {
        active = false;
      };
    }

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
      .catch((error) => {
        if (!active) return;
        const msg = error instanceof Error ? error.message : 'Şikayetler yüklenemedi.';
        const lower = msg.toLowerCase();
        if (!lower.includes('session') && !lower.includes('jwt') && !lower.includes('auth')) {
          setReportsError(msg);
        }
      })
      .finally(() => {
        if (!active) return;
        setReportsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accountCore?.resolved_role, isConfigured, user?.id]);

  useEffect(() => {
    let active = true;

    if (!user || !isConfigured) {
      setUnreadNotificationCount(0);
      return () => {
        active = false;
      };
    }

    const refreshUnread = () => {
      fetchUnreadNotificationCount()
        .then((count) => {
          if (active) {
            setUnreadNotificationCount(count);
          }
        })
        .catch(() => {
          if (active) {
            setUnreadNotificationCount(0);
          }
        });
    };

    refreshUnread();
    const unsubscribe = subscribeToMyNotifications(user.id, refreshUnread);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [isConfigured, user?.id]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
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
    } catch (error) {
      setReportsError(error instanceof Error ? error.message : 'Şikayet güncellenemedi.');
    } finally {
      setReportActionBusyId(null);
    }
  }

  async function handleConfirmSignOut() {
    setLogoutBusy(true);
    try {
      await signOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Çıkış işlemi tamamlanamadı.';
      showToast(message);
    } finally {
      setLogoutBusy(false);
      setShowLogoutModal(false);
    }
  }

  function requireAuthForAction(message: string) {
    if (user) {
      return true;
    }

    showToast(message);
    router.push('/auth');
    return false;
  }

  function handleQuickAction(label: string) {
    if (label === 'Favoriler') { router.push('/(tabs)/favorites'); return; }
    if (label === 'Sepetim') { router.push('/(tabs)/cart'); return; }
    if (label === 'Kategoriler') { router.push('/(tabs)/categories'); return; }
    if (label === 'Mesajlar')  { router.push(buildMessagesInboxRoute()); return; }
    if (label === 'Mağazam') {
      if (!requireAuthForAction('Mağaza paneline girmek için giriş yapman gerekiyor.')) return;
      router.push(hasStore ? '/store-settings' : '/store-setup');
      return;
    }
    if (label === 'Yardım') { router.push({ pathname: '/legal/[doc]', params: { doc: 'terms-of-use' } }); return; }
    router.push('/search');
  }

  async function handleSectionItem(label: string) {
    if (label === t.account.liveSupport)          { router.push(buildMessagesInboxRoute()); return; }
    if (label === t.account.helpCenter)           { router.push(buildMessagesInboxRoute()); return; }
    if (label === t.account.contactEmail) {
      const mailto = `mailto:${SUPPORT_EMAIL}?subject=Siparis%20Kutusu%20Destek`;
      const canOpen = await Linking.canOpenURL(mailto);
      if (canOpen) {
        await Linking.openURL(mailto);
      } else {
        showToast(`Iletisim: ${SUPPORT_EMAIL}`);
      }
      return;
    }
    if (label === t.account.personalInfo) {
      if (!requireAuthForAction('Kişisel bilgiler için giriş yapman gerekiyor.')) return;
      router.push('/profile-edit');
      return;
    }
    if (label === t.account.storeProfile) {
      if (!requireAuthForAction('Mağaza profili için giriş yapman gerekiyor.')) return;
      router.push(hasStore ? '/store-settings' : '/store-setup');
      return;
    }
    if (label === t.account.addresses) {
      if (!requireAuthForAction('Adresler için giriş yapman gerekiyor.')) return;
      router.push('/addresses');
      return;
    }
    if (label === t.account.paymentMethods) {
      if (!requireAuthForAction('Ödeme yöntemleri için giriş yapman gerekiyor.')) return;
      router.push('/payment-methods');
      return;
    }
    if (label === t.account.conversationHistory) {
      if (!requireAuthForAction('Görüşme geçmişi için giriş yapman gerekiyor.')) return;
      router.push('/(tabs)/orders');
      return;
    }
    if (label === t.account.security) {
      if (!requireAuthForAction('Güvenlik ayarları için giriş yapman gerekiyor.')) return;
      router.push('/security');
      return;
    }
    if (label === t.account.termsPrivacy) { router.push({ pathname: '/legal/[doc]', params: { doc: 'terms-of-use' } }); return; }
    if (label === t.account.languageRegion) { router.push('/preferences'); return; }
    if (label === t.account.notifications)  { router.push('/notifications'); return; }
    if (label === t.account.appearance)     { router.push('/preferences'); return; }
    if (label === t.account.signOut) {
      if (!user) {
        router.push('/auth');
        return;
      }
      setShowLogoutModal(true);
      return;
    }
    router.push(buildMessagesInboxRoute());
  }

  const displayName = (user?.user_metadata?.full_name as string | undefined) ?? 'Misafir Kullanıcı';
  const displayEmail = user?.email ?? (isConfigured ? 'Giriş yapılmadı' : 'Supabase .env yapılandırması eksik');
  const resolvedRole = accountCore?.resolved_role ?? (hasStore ? 'seller' : 'buyer');
  const roleLabel = resolvedRole === 'seller' ? 'Satıcı / İçerik Üretici' : resolvedRole === 'admin' ? 'Yönetici' : 'Alıcı';
  const sellerContactLine = accountCore?.seller_profile
    ? [
        accountCore.seller_profile.store_name,
        accountCore.seller_profile.instagram_handle ? `@${accountCore.seller_profile.instagram_handle}` : null,
        accountCore.seller_profile.whatsapp,
        accountCore.seller_profile.website,
      ].filter(Boolean).join(' • ')
    : null;
  const profileBioLine = accountCore?.bio?.trim() || null;
  const languageBadge = `${preferences.language === 'en' ? 'EN' : 'TR'}/${preferences.currency === 'EUR' ? 'EU' : preferences.currency === 'USD' ? 'US' : 'TR'}`;
  const themeBadge = preferences.theme === 'dark' ? 'Koyu' : preferences.theme === 'light' ? 'Acik' : 'Oto';

  const palette = {
    screenBg: isDarkMode ? '#0F172A' : '#F7F7F7',
    surfaceBg: isDarkMode ? '#111827' : '#FFFFFF',
    surfaceAlt: isDarkMode ? '#1E293B' : '#F7F7F7',
    border: isDarkMode ? '#334155' : '#33333315',
    borderAlt: isDarkMode ? '#1E293B' : '#D1D5DB',
    avatarBg: isDarkMode ? '#1E3A8A' : '#DBEAFE',
    badgeBg: isDarkMode ? '#1E293B' : '#F3F4F6',
    buttonAlt: isDarkMode ? '#1E3A8A' : '#EFF6FF',
    buttonBorder: isDarkMode ? '#1E40AF' : '#BFDBFE',
    quickActionBg: isDarkMode ? '#1F2937' : '#FFFFFF',
    textPrimary: isDarkMode ? '#E5E7EB' : colors.textPrimary,
    textSecondary: isDarkMode ? '#94A3B8' : colors.textSecondary,
    textMuted: isDarkMode ? '#64748B' : colors.textMuted,
  };

  const sectionList = buildSections().map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (item.label === t.account.notifications) {
        return {
          ...item,
          badge: unreadNotificationCount > 0 ? String(Math.min(unreadNotificationCount, 99)) : undefined,
        };
      }

      if (item.label === t.account.languageRegion) {
        return {
          ...item,
          badge: languageBadge,
        };
      }

      if (item.label === t.account.appearance) {
        return {
          ...item,
          badge: themeBadge,
        };
      }

      return item;
    }),
  }));

  return (
    <SafeAreaView style={{ backgroundColor: palette.screenBg }} className="flex-1" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: colors.primary }} className="px-4 pt-4 pb-20">
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: '#fff' }}>
            {t.account.title}
          </Text>
        </View>

        <View style={{ backgroundColor: palette.surfaceBg, borderColor: palette.border }} className="mx-4 -mt-14 rounded-2xl p-4 shadow-sm border">
          <View className="flex-row items-center">
            {accountCore?.avatar_url ? (
              <Image
                source={{ uri: accountCore.avatar_url }}
                style={{ width: 64, height: 64, borderRadius: 32 }}
              />
            ) : (
              <View
                style={{ backgroundColor: palette.avatarBg }}
                className="w-16 h-16 rounded-full items-center justify-center"
              >
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 24, color: colors.primary }}>
                  {(displayName[0] ?? 'M').toUpperCase()}
                </Text>
              </View>
            )}
            <View className="flex-1 ml-3">
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: palette.textPrimary }}>
                {displayName}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary }}>
                {displayEmail}
              </Text>
              {profileBioLine ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary, marginTop: 4 }} numberOfLines={2}>
                  {profileBioLine}
                </Text>
              ) : null}
              <View style={{ alignSelf: 'flex-start', backgroundColor: resolvedRole === 'seller' ? palette.avatarBg : palette.badgeBg }} className="mt-2 rounded-full px-2.5 py-1">
                <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: resolvedRole === 'seller' ? colors.primary : palette.textSecondary }}>
                  {roleLabel}
                </Text>
              </View>
              {sellerContactLine ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary, marginTop: 6 }}>
                  {sellerContactLine}
                </Text>
              ) : null}
            </View>
            {user && (
              <View style={{ backgroundColor: isDarkMode ? '#064E3B' : '#D1FAE5' }} className="w-6 h-6 rounded-full items-center justify-center">
                <Ionicons name="checkmark-sharp" size={14} color={isDarkMode ? '#86EFAC' : '#059669'} />
              </View>
            )}
            {!user && (
              <Pressable onPress={() => router.push('/auth')} className="active:opacity-70">
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {!user ? (
            <Pressable
              onPress={() => router.push('/auth')}
              className="mt-3 rounded-xl items-center justify-center"
              style={{ height: 38, backgroundColor: palette.buttonAlt }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>Giriş Yap / Kayıt Ol</Text>
            </Pressable>
          ) : null}

          {user && resolvedRole === 'buyer' ? (
            <Pressable
              onPress={() => router.push('/store-setup')}
              style={{ borderColor: palette.buttonBorder, backgroundColor: palette.buttonAlt }}
              className="mt-3 rounded-xl border px-3 py-3 active:opacity-80"
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>
                Satıcı / İçerik Üretici hesabına geç
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                Mağaza aç, Instagram ve WhatsApp ile satış akışını başlat.
              </Text>
            </Pressable>
          ) : null}

          <View style={{ borderTopColor: palette.border }} className="flex-row mt-4 pt-4 border-t">
            <Pressable
              className="flex-1 items-center active:opacity-70"
              onPress={() => {
                if (!requireAuthForAction('Mağaza ayarları için giriş yapman gerekiyor.')) return;
                router.push(hasStore ? '/store-settings' : '/store-setup');
              }}
            >
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: palette.textPrimary }}>{hasStore ? 1 : 0}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary }}>Mağaza</Text>
            </Pressable>
            <View style={{ width: 1, backgroundColor: palette.border }} />
            <Pressable className="flex-1 items-center active:opacity-70" onPress={() => router.push('/(tabs)/favorites')}>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: palette.textPrimary }}>{favorites.length}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary }}>Favori</Text>
            </Pressable>
            <View style={{ width: 1, backgroundColor: palette.border }} />
            <Pressable className="flex-1 items-center active:opacity-70" onPress={() => router.push(buildMessagesInboxRoute())}>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.primary }}>{storeMessageCount}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary }}>Mesaj</Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-row mx-4 mt-3 gap-2">
          {[
            { icon: 'heart' as const, label: 'Favoriler', color: '#3B82F6', badge: null as string | null },
            { icon: 'cart' as const, label: 'Sepetim', color: '#F59E0B', badge: null as string | null },
            { icon: 'grid' as const, label: 'Kategoriler', color: '#8B5CF6', badge: null as string | null },
            { icon: 'chatbubble-ellipses' as const, label: 'Mesajlar', color: '#0F766E', badge: storeMessageCount > 0 ? String(Math.min(storeMessageCount, 99)) : null },
            { icon: 'storefront' as const, label: 'Mağazam', color: '#1E5FC6', badge: null as string | null },
            { icon: 'help-circle' as const, label: 'Yardım', color: '#60A5FA', badge: null as string | null },
          ].map((a) => (
            <Pressable
              key={a.label}
              onPress={() => handleQuickAction(a.label)}
              style={{ backgroundColor: palette.quickActionBg, borderColor: palette.border }}
              className="flex-1 rounded-xl items-center py-3 border active:opacity-80"
            >
              <View
                style={{ backgroundColor: a.color + '22' }}
                className="w-9 h-9 rounded-full items-center justify-center mb-1.5"
              >
                <Ionicons name={a.icon} size={16} color={a.color} />
                {a.badge ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      backgroundColor: '#EF4444',
                      borderRadius: 8,
                      minWidth: 16,
                      height: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 3,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#fff' }}>{a.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: palette.textPrimary }}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Instagram Integration Card — only for sellers */}
        {hasStore && user ? (
          <Pressable
            onPress={() => router.push('/instagram-connect' as never)}
            style={{
              marginHorizontal: 16, marginTop: 12,
              backgroundColor: igConnection?.connected ? '#FFF0F5' : palette.surfaceBg,
              borderRadius: 18, borderWidth: 1.5,
              borderColor: igConnection?.connected ? '#E1306C44' : palette.border,
              padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E1306C15', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="logo-instagram" size={22} color="#E1306C" />
            </View>
            <View style={{ flex: 1 }}>
              {igConnection?.connected ? (
                <>
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
              ) : (
                <>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.textPrimary }}>Instagram Bağla</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary, marginTop: 2 }}>
                    Gönderilerini otomatik ürüne dönüştür
                  </Text>
                </>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
          </Pressable>
        ) : null}

        {sectionList.map((section) => (
          <View key={section.title} className="mx-4 mt-4">
            <Text
              style={{ fontFamily: fonts.bold, fontSize: 12, color: palette.textSecondary }}
              className="mb-2 ml-1 uppercase"
            >
              {section.title}
            </Text>
            <View style={{ backgroundColor: palette.surfaceBg, borderColor: palette.border }} className="rounded-2xl border overflow-hidden">
              {section.items.map((item, idx) => (
                <Pressable
                  key={item.label}
                  onPress={() => handleSectionItem(item.label)}
                  style={{
                    borderBottomWidth: idx < section.items.length - 1 ? 1 : 0,
                    borderBottomColor: palette.border,
                    backgroundColor: 'transparent',
                  }}
                  className="flex-row items-center px-4 py-3.5 active:opacity-70"
                >
                  <View
                    style={{ backgroundColor: palette.surfaceAlt }}
                    className="w-8 h-8 rounded-lg items-center justify-center"
                  >
                    <Ionicons
                      name={item.icon}
                      size={16}
                      color={item.color ?? palette.textPrimary}
                    />
                  </View>
                  <Text
                    style={{
                      fontFamily: fonts.medium,
                      fontSize: 13,
                      color: item.color ?? palette.textPrimary,
                    }}
                    className="flex-1 ml-3"
                  >
                    {item.label}
                  </Text>
                  {item.badge ? (
                    <View
                      style={{ backgroundColor: (item.color ?? colors.primary) + '22' }}
                      className="px-2 py-0.5 rounded-full mr-2"
                    >
                      <Text
                        style={{
                          fontFamily: fonts.bold,
                          fontSize: 10,
                          color: item.color ?? colors.primary,
                        }}
                      >
                        {item.badge}
                      </Text>
                    </View>
                  ) : null}
                  <Ionicons name="chevron-forward" size={16} color={palette.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {user ? (
          <View className="mx-4 mt-4">
            <View className="flex-row items-center justify-between mb-2 ml-1">
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: palette.textSecondary }} className="uppercase">
                Şikayetlerim
              </Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: palette.textMuted }}>
                {myReports.length} kayıt
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/my-reports')}
              style={{ borderColor: palette.buttonBorder, backgroundColor: palette.buttonAlt }}
              className="mb-3 rounded-xl border px-3 py-2.5"
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>
                Tüm Şikayetlerimi Gör
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary, marginTop: 3 }}>
                Geçmiş kayıtlar, karar notları ve durum filtreleri
              </Text>
            </Pressable>
            <View style={{ backgroundColor: palette.surfaceBg, borderColor: palette.border }} className="rounded-2xl border p-3">
              {reportsLoading ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary }}>
                  Şikayetler yükleniyor...
                </Text>
              ) : myReports.length > 0 ? (
                myReports.slice(0, 6).map((report, index) => {
                  const statusMeta = formatReportStatus(report.status);
                  return (
                    <View
                      key={report.id}
                      style={{ borderBottomWidth: index < Math.min(myReports.length, 6) - 1 ? 1 : 0, borderBottomColor: palette.border }}
                      className="py-2.5"
                    >
                      <View className="flex-row items-center justify-between">
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: palette.textPrimary }}>
                          {formatReportTarget(report.targetType)} • {report.reason}
                        </Text>
                        <View style={{ backgroundColor: statusMeta.bg }} className="px-2 py-0.5 rounded-full">
                          <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: statusMeta.color }}>
                            {statusMeta.label}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary, marginTop: 3 }}>
                        {new Date(report.createdAt).toLocaleString('tr-TR')}
                      </Text>
                      {report.description ? (
                        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textMuted, marginTop: 3 }}>
                          {report.description}
                        </Text>
                      ) : null}
                    </View>
                  );
                })
              ) : (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary }}>
                  Henüz şikayet kaydın bulunmuyor.
                </Text>
              )}
            </View>
          </View>
        ) : null}

        {user && accountCore?.resolved_role === 'admin' ? (
          <View className="mx-4 mt-4">
            <View className="flex-row items-center justify-between mb-2 ml-1">
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: palette.textSecondary }} className="uppercase">
                Bekleyen Şikayetler (Admin)
              </Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: palette.textMuted }}>
                {pendingReports.length} bekleyen
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/report-moderation')}
              style={{ borderColor: palette.buttonBorder, backgroundColor: palette.buttonAlt }}
              className="mb-3 rounded-xl border px-3 py-2.5"
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>
                Gelişmiş Moderasyon Ekranını Aç
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>
                Filtre, istatistik ve toplu akış görünümü
              </Text>
            </Pressable>
            <View style={{ backgroundColor: palette.surfaceBg, borderColor: palette.border }} className="rounded-2xl border p-3">
              {pendingReports.length > 0 ? (
                pendingReports.slice(0, 8).map((report, index) => (
                  <View
                    key={report.id}
                    style={{ borderBottomWidth: index < Math.min(pendingReports.length, 8) - 1 ? 1 : 0, borderBottomColor: palette.border }}
                    className="py-2.5"
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: palette.textPrimary }}>
                      {formatReportTarget(report.targetType)} • {report.reason}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary, marginTop: 2 }}>
                      {new Date(report.createdAt).toLocaleString('tr-TR')}
                    </Text>
                    {report.description ? (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textMuted, marginTop: 3 }}>
                        {report.description}
                      </Text>
                    ) : null}
                    <View className="flex-row mt-3" style={{ gap: 8 }}>
                      <Pressable
                        disabled={reportActionBusyId === report.id}
                        onPress={() => handleAdminReportDecision(report.id, 'reviewed')}
                        style={{ borderColor: isDarkMode ? '#1E40AF' : '#93C5FD', backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                      >
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: isDarkMode ? '#93C5FD' : '#1E40AF' }}>İncelendi</Text>
                      </Pressable>
                      <Pressable
                        disabled={reportActionBusyId === report.id}
                        onPress={() => handleAdminReportDecision(report.id, 'resolved')}
                        style={{ borderColor: isDarkMode ? '#065F46' : '#86EFAC', backgroundColor: isDarkMode ? '#064E3B' : '#ECFDF5', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                      >
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: isDarkMode ? '#86EFAC' : '#065F46' }}>Çözüldü</Text>
                      </Pressable>
                      <Pressable
                        disabled={reportActionBusyId === report.id}
                        onPress={() => handleAdminReportDecision(report.id, 'rejected')}
                        style={{ borderColor: isDarkMode ? '#7F1D1D' : '#FCA5A5', backgroundColor: isDarkMode ? '#7F1D1D' : '#FEF2F2', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                      >
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: isDarkMode ? '#FECACA' : '#991B1B' }}>Reddet</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: palette.textSecondary }}>
                  Bekleyen şikayet bulunmuyor.
                </Text>
              )}
            </View>
          </View>
        ) : null}

        {reportsError ? (
          <View style={{ borderColor: isDarkMode ? '#7F1D1D' : '#FCA5A5', backgroundColor: isDarkMode ? '#7F1D1D' : '#FEF2F2' }} className="mx-4 mt-3 rounded-xl border px-3 py-2.5">
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: isDarkMode ? '#FECACA' : '#991B1B' }}>
              {reportsError}
            </Text>
          </View>
        ) : null}

        <View className="items-center mt-6 mb-4">
          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textMuted }}>
            Sürüm 1.0.0
          </Text>
        </View>
      </ScrollView>

      {toast ? (
        <View
          style={{ backgroundColor: '#1F2937' }}
          className="absolute bottom-6 left-4 right-4 rounded-xl px-4 py-3"
        >
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#fff', textAlign: 'center' }}>
            {toast}
          </Text>
        </View>
      ) : null}

      <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => { if (!logoutBusy) setShowLogoutModal(false); }}
        >
          <Pressable
            style={{
              backgroundColor: palette.surfaceBg,
              borderRadius: 20,
              padding: 24,
              width: 300,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
            }}
            onPress={() => {}}
          >
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name="log-out-outline" size={28} color="#EF4444" />
            </View>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: palette.textPrimary, textAlign: 'center' }}>
              Çıkış yapmak istiyor musunuz?
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: palette.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 19 }}>
              Hesabınızdan güvenli bir şekilde çıkış yapılacak.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 22, width: '100%' }}>
              <Pressable
                onPress={() => setShowLogoutModal(false)}
                disabled={logoutBusy}
                style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: palette.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: palette.textPrimary }}>Vazgeç</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmSignOut}
                disabled={logoutBusy}
                style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', opacity: logoutBusy ? 0.7 : 1 }}
              >
                {logoutBusy ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Çıkış Yap</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
