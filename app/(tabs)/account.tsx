import { View, Text, ScrollView, Pressable } from 'react-native';
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

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const sections: { title: string; items: { icon: IoniconName; label: string; badge?: string; color?: string }[] }[] = [
  {
    title: 'Hesabım',
    items: [
      { icon: 'person-outline', label: 'Kişisel Bilgiler' },
      { icon: 'storefront-outline', label: 'Mağaza Profili' },
      { icon: 'shield-checkmark-outline', label: 'Güvenlik' },
    ],
  },
  {
    title: 'Destek',
    items: [
      { icon: 'chatbubbles-outline', label: 'Canlı Destek' },
      { icon: 'help-circle-outline', label: 'Yardım Merkezi' },
      { icon: 'document-text-outline', label: 'Şartlar & Gizlilik' },
      { icon: 'language-outline', label: 'Dil & Bölge', badge: 'TR' },
    ],
  },
  {
    title: 'Uygulama',
    items: [
      { icon: 'notifications-outline', label: 'Bildirimler' },
      { icon: 'moon-outline', label: 'Görünüm' },
      { icon: 'log-out-outline', label: 'Çıkış Yap', color: colors.danger },
    ],
  },
];

export default function AccountScreen() {
  const router = useRouter();
  useAndroidTabBackToHome();
  const { user, signOut, isConfigured } = useAuth();
  const { favorites } = useFavorites();
  const { hasStore, storeMessageCount } = useListings();
  const [toast, setToast] = useState('');
  const [accountCore, setAccountCore] = useState<AccountCoreProfile | null>(null);
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
        setReportsError(error instanceof Error ? error.message : 'Şikayetler yüklenemedi.');
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
    if (label === 'Mesajlar')  { router.push(buildMessagesInboxRoute()); return; }
    if (label === 'Mağazam') {
      if (!requireAuthForAction('Mağaza paneline girmek için giriş yapman gerekiyor.')) return;
      router.push(hasStore ? '/store-settings' : '/store-setup');
      return;
    }
    if (label === 'Yardım') { router.push(buildMessagesInboxRoute()); return; }
    router.push('/search');
  }

  async function handleSectionItem(label: string) {
    if (label === 'Canlı Destek')      { router.push(buildMessagesInboxRoute()); return; }
    if (label === 'Yardım Merkezi')    { router.push(buildMessagesInboxRoute()); return; }
    if (label === 'Kişisel Bilgiler') {
      if (!requireAuthForAction('Kişisel bilgiler için giriş yapman gerekiyor.')) return;
      router.push('/profile-edit');
      return;
    }
    if (label === 'Mağaza Profili') {
      if (!requireAuthForAction('Mağaza profili için giriş yapman gerekiyor.')) return;
      router.push(hasStore ? '/store-settings' : '/store-setup');
      return;
    }
    if (label === 'Güvenlik') {
      if (!requireAuthForAction('Güvenlik ayarları için giriş yapman gerekiyor.')) return;
      router.push('/security');
      return;
    }
    if (label === 'Şartlar & Gizlilik'){ router.push({ pathname: '/legal/[doc]', params: { doc: 'terms-of-use' } }); return; }
    if (label === 'Dil & Bölge')       { showToast('Dil: Türkçe | Bölge: Türkiye'); return; }
    if (label === 'Bildirimler')       { router.push('/notifications'); return; }
    if (label === 'Görünüm')           { showToast('Tema modu: Sistem (otomatik).'); return; }
    if (label === 'Çıkış Yap') {
      if (!user) {
        router.push('/auth');
        return;
      }

      try {
        await signOut();
        showToast('Çıkış yapıldı.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Çıkış işlemi tamamlanamadı.';
        showToast(message);
      }
      return;
    }
    showToast(`${label} yakında aktif olacak.`);
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
  const sectionList = sections.map((section) => {
    if (section.title !== 'Uygulama') {
      return section;
    }

    return {
      ...section,
      items: section.items.map((item) => {
        if (item.label !== 'Bildirimler') {
          return item;
        }

        return {
          ...item,
          badge: unreadNotificationCount > 0 ? String(Math.min(unreadNotificationCount, 99)) : undefined,
        };
      }),
    };
  });

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: colors.primary }} className="px-4 pt-4 pb-20">
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: '#fff' }}>
            Hesabım
          </Text>
        </View>

        <View className="mx-4 -mt-14 bg-white rounded-2xl p-4 shadow-sm border border-[#33333315]">
          <View className="flex-row items-center">
            <View
              style={{ backgroundColor: '#DBEAFE' }}
              className="w-16 h-16 rounded-full items-center justify-center"
            >
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 24, color: colors.primary }}>
                {(displayName[0] ?? 'M').toUpperCase()}
              </Text>
            </View>
            <View className="flex-1 ml-3">
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary }}>
                {displayName}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>
                {displayEmail}
              </Text>
              <View style={{ alignSelf: 'flex-start', backgroundColor: resolvedRole === 'seller' ? '#DBEAFE' : '#F3F4F6' }} className="mt-2 rounded-full px-2.5 py-1">
                <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: resolvedRole === 'seller' ? colors.primary : colors.textSecondary }}>
                  {roleLabel}
                </Text>
              </View>
              {sellerContactLine ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 6 }}>
                  {sellerContactLine}
                </Text>
              ) : null}
            </View>
            {user && (
              <View style={{ backgroundColor: '#D1FAE5' }} className="w-6 h-6 rounded-full items-center justify-center">
                <Ionicons name="checkmark-sharp" size={14} color="#059669" />
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
              style={{ height: 38, backgroundColor: '#EFF6FF' }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>Giriş Yap / Kayıt Ol</Text>
            </Pressable>
          ) : null}

          {user && resolvedRole === 'buyer' ? (
            <Pressable
              onPress={() => router.push('/store-setup')}
              className="mt-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-3 active:opacity-80"
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>
                Satıcı / İçerik Üretici hesabına geç
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                Mağaza aç, Instagram ve WhatsApp ile satış akışını başlat.
              </Text>
            </Pressable>
          ) : null}

          <View className="flex-row mt-4 pt-4 border-t border-[#33333315]">
            <Pressable
              className="flex-1 items-center active:opacity-70"
              onPress={() => {
                if (!requireAuthForAction('Mağaza ayarları için giriş yapman gerekiyor.')) return;
                router.push(hasStore ? '/store-settings' : '/store-setup');
              }}
            >
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary }}>{hasStore ? 1 : 0}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary }}>Mağaza</Text>
            </Pressable>
            <View style={{ width: 1, backgroundColor: colors.borderLight }} />
            <Pressable className="flex-1 items-center active:opacity-70" onPress={() => router.push('/(tabs)/favorites')}>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary }}>{favorites.length}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary }}>Favori</Text>
            </Pressable>
            <View style={{ width: 1, backgroundColor: colors.borderLight }} />
            <Pressable className="flex-1 items-center active:opacity-70" onPress={() => router.push(buildMessagesInboxRoute())}>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.primary }}>{storeMessageCount}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary }}>Mesaj</Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-row mx-4 mt-3 gap-2">
          {[
            { icon: 'heart' as const, label: 'Favoriler', color: '#3B82F6' },
            { icon: 'chatbubble-ellipses' as const, label: 'Mesajlar', color: '#0F766E' },
            { icon: 'storefront' as const, label: 'Mağazam', color: '#1E5FC6' },
            { icon: 'help-circle' as const, label: 'Yardım', color: '#60A5FA' },
          ].map((a) => (
            <Pressable
              key={a.label}
              onPress={() => handleQuickAction(a.label)}
              className="flex-1 bg-white rounded-xl items-center py-3 border border-[#33333315] active:opacity-80"
            >
              <View
                style={{ backgroundColor: a.color + '22' }}
                className="w-9 h-9 rounded-full items-center justify-center mb-1.5"
              >
                <Ionicons name={a.icon} size={16} color={a.color} />
              </View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textPrimary }}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {sectionList.map((section) => (
          <View key={section.title} className="mx-4 mt-4">
            <Text
              style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary }}
              className="mb-2 ml-1 uppercase"
            >
              {section.title}
            </Text>
            <View className="bg-white rounded-2xl border border-[#33333315] overflow-hidden">
              {section.items.map((item, idx) => (
                <Pressable
                  key={item.label}
                  onPress={() => handleSectionItem(item.label)}
                  style={{
                    borderBottomWidth: idx < section.items.length - 1 ? 1 : 0,
                    borderBottomColor: colors.borderLight,
                  }}
                  className="flex-row items-center px-4 py-3.5 active:bg-[#F7F7F7]"
                >
                  <View
                    style={{ backgroundColor: '#F7F7F7' }}
                    className="w-8 h-8 rounded-lg items-center justify-center"
                  >
                    <Ionicons
                      name={item.icon}
                      size={16}
                      color={item.color ?? colors.textPrimary}
                    />
                  </View>
                  <Text
                    style={{
                      fontFamily: fonts.medium,
                      fontSize: 13,
                      color: item.color ?? colors.textPrimary,
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
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {user ? (
          <View className="mx-4 mt-4">
            <View className="flex-row items-center justify-between mb-2 ml-1">
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary }} className="uppercase">
                Şikayetlerim
              </Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted }}>
                {myReports.length} kayıt
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/my-reports')}
              className="mb-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5"
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>
                Tüm Şikayetlerimi Gör
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>
                Geçmiş kayıtlar, karar notları ve durum filtreleri
              </Text>
            </Pressable>
            <View className="bg-white rounded-2xl border border-[#33333315] p-3">
              {reportsLoading ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>
                  Şikayetler yükleniyor...
                </Text>
              ) : myReports.length > 0 ? (
                myReports.slice(0, 6).map((report, index) => {
                  const statusMeta = formatReportStatus(report.status);
                  return (
                    <View
                      key={report.id}
                      style={{ borderBottomWidth: index < Math.min(myReports.length, 6) - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}
                      className="py-2.5"
                    >
                      <View className="flex-row items-center justify-between">
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>
                          {formatReportTarget(report.targetType)} • {report.reason}
                        </Text>
                        <View style={{ backgroundColor: statusMeta.bg }} className="px-2 py-0.5 rounded-full">
                          <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: statusMeta.color }}>
                            {statusMeta.label}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>
                        {new Date(report.createdAt).toLocaleString('tr-TR')}
                      </Text>
                      {report.description ? (
                        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
                          {report.description}
                        </Text>
                      ) : null}
                    </View>
                  );
                })
              ) : (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>
                  Henüz şikayet kaydın bulunmuyor.
                </Text>
              )}
            </View>
          </View>
        ) : null}

        {user && accountCore?.resolved_role === 'admin' ? (
          <View className="mx-4 mt-4">
            <View className="flex-row items-center justify-between mb-2 ml-1">
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary }} className="uppercase">
                Bekleyen Şikayetler (Admin)
              </Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted }}>
                {pendingReports.length} bekleyen
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/report-moderation')}
              className="mb-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5"
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>
                Gelişmiş Moderasyon Ekranını Aç
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>
                Filtre, istatistik ve toplu akış görünümü
              </Text>
            </Pressable>
            <View className="bg-white rounded-2xl border border-[#33333315] p-3">
              {pendingReports.length > 0 ? (
                pendingReports.slice(0, 8).map((report, index) => (
                  <View
                    key={report.id}
                    style={{ borderBottomWidth: index < Math.min(pendingReports.length, 8) - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}
                    className="py-2.5"
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>
                      {formatReportTarget(report.targetType)} • {report.reason}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                      {new Date(report.createdAt).toLocaleString('tr-TR')}
                    </Text>
                    {report.description ? (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
                        {report.description}
                      </Text>
                    ) : null}
                    <View className="flex-row mt-3" style={{ gap: 8 }}>
                      <Pressable
                        disabled={reportActionBusyId === report.id}
                        onPress={() => handleAdminReportDecision(report.id, 'reviewed')}
                        className="rounded-lg border border-[#93C5FD] bg-[#EFF6FF] px-3 py-1.5"
                      >
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#1E40AF' }}>İncelendi</Text>
                      </Pressable>
                      <Pressable
                        disabled={reportActionBusyId === report.id}
                        onPress={() => handleAdminReportDecision(report.id, 'resolved')}
                        className="rounded-lg border border-[#86EFAC] bg-[#ECFDF5] px-3 py-1.5"
                      >
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#065F46' }}>Çözüldü</Text>
                      </Pressable>
                      <Pressable
                        disabled={reportActionBusyId === report.id}
                        onPress={() => handleAdminReportDecision(report.id, 'rejected')}
                        className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-1.5"
                      >
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#991B1B' }}>Reddet</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>
                  Bekleyen şikayet bulunmuyor.
                </Text>
              )}
            </View>
          </View>
        ) : null}

        {reportsError ? (
          <View className="mx-4 mt-3 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5">
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#991B1B' }}>
              {reportsError}
            </Text>
          </View>
        ) : null}

        <View className="items-center mt-6 mb-4">
          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted }}>
            Sürüm 1.0.0
          </Text>
        </View>
      </ScrollView>

      {toast ? (
        <View
          style={{ backgroundColor: '#111827' }}
          className="absolute bottom-6 left-4 right-4 rounded-xl px-4 py-3"
        >
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#fff', textAlign: 'center' }}>
            {toast}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
