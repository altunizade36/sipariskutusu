import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Image,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import {
  getInstagramConnection,
  connectInstagramOAuth,
  disconnectInstagram,
  syncInstagramContent,
  getSyncState,
  isTokenExpired,
  formatIgCount,
  formatSyncTime,
  syncStatusColor,
  syncStatusLabel,
  type InstagramConnection,
  type SyncState,
} from '../src/services/instagramService';

export default function InstagramConnectScreen() {
  const router = useRouter();
  const { isDarkMode } = useAuth();
  const [connection, setConnection] = useState<InstagramConnection | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle', lastSyncAt: null, error: null });
  const [loading, setLoading] = useState(true);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const pal = {
    bg: isDarkMode ? '#0F172A' : '#F8FAFC',
    card: isDarkMode ? '#111827' : '#FFFFFF',
    border: isDarkMode ? '#334155' : '#E5E7EB',
    textPrimary: isDarkMode ? '#E5E7EB' : '#1E293B',
    textSecondary: isDarkMode ? '#94A3B8' : '#64748B',
    statBg: isDarkMode ? '#1E293B' : '#F8FAFC',
    benefitBg: isDarkMode ? '#1E293B' : '#FFFFFF',
    warnBg: isDarkMode ? '#451A03' : '#FFFBEB',
    warnBorder: isDarkMode ? '#92400E' : '#FDE68A',
    warnText: isDarkMode ? '#FCD34D' : '#92400E',
    errorBg: isDarkMode ? '#450A0A' : '#FFF5F5',
    errorBorder: isDarkMode ? '#991B1B' : '#FECACA',
    errorText: isDarkMode ? '#FCA5A5' : '#991B1B',
    disconnectBg: isDarkMode ? '#1F1315' : '#FFF5F5',
    disconnectBorder: isDarkMode ? '#7F1D1D' : '#FECACA',
    headerBg: isDarkMode ? '#111827' : '#FFFFFF',
    headerBorder: isDarkMode ? '#1E293B' : '#33333315',
  };

  const load = useCallback(async () => {
    const [conn, st] = await Promise.all([getInstagramConnection(), getSyncState()]);
    setConnection(conn);
    setSyncState(st);
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleOAuthConnect() {
    setOauthLoading(true);
    try {
      const conn = await connectInstagramOAuth();
      setConnection(conn);
      setSyncState({ status: 'success', lastSyncAt: conn.connectedAt, error: null });
      Alert.alert(
        'Bağlandı! 🎉',
        `@${conn.username} hesabı başarıyla bağlandı. ${formatIgCount(conn.followersCount)} takipçi.`
      );
    } catch {
      Alert.alert('Hata', 'Instagram bağlantısı kurulamadı. Lütfen tekrar dene.');
    } finally {
      setOauthLoading(false);
    }
  }

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncInstagramContent();
      const st = await getSyncState();
      setSyncState(st);
    } catch {
      const st = await getSyncState();
      setSyncState(st);
      Alert.alert('Hata', 'Senkronizasyon başarısız oldu. Lütfen tekrar dene.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    Alert.alert(
      'Bağlantıyı Kes',
      'Instagram hesabını uygulamadan ayırmak istediğine emin misin? Önceden ürüne çevrilmiş ilanlar silinmez.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Bağlantıyı Kes',
          style: 'destructive',
          onPress: async () => {
            await disconnectInstagram();
            setConnection({
              connected: false, accountId: null, username: null, displayName: null,
              profilePicUrl: null, followersCount: 0, mediaCount: 0, accountType: null,
              connectedAt: null, tokenExpiresAt: null,
            });
            setSyncState({ status: 'idle', lastSyncAt: null, error: null });
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: pal.bg, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <ActivityIndicator color="#E1306C" size="large" />
      </SafeAreaView>
    );
  }

  const tokenExpired = connection?.connected && isTokenExpired(connection);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: pal.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: pal.headerBg, borderBottomWidth: 1, borderBottomColor: pal.headerBorder }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12, width: 38, height: 38, borderRadius: 19, backgroundColor: pal.statBg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={22} color={pal.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: pal.textPrimary }}>Instagram Entegrasyonu</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary }}>Business veya Creator hesabını bağla</Text>
        </View>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E1306C15', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="logo-instagram" size={20} color="#E1306C" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E1306C" />}
      >
        {connection?.connected ? (
          <>
            {/* Token Expired Warning */}
            {tokenExpired && (
              <View style={{ backgroundColor: pal.warnBg, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: pal.warnBorder }}>
                <Ionicons name="warning-outline" size={20} color={pal.warnText} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: pal.warnText }}>Instagram bağlantısını yenilemen gerekiyor.</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.warnText, marginTop: 4 }}>
                    Erişim süresi doldu. Yeniden bağlanmak için aşağıdaki butona bas.
                  </Text>
                </View>
              </View>
            )}

            {/* Sync Error */}
            {(syncState.status === 'error' || syncState.status === 'api_limit' || syncState.status === 'offline') && (
              <View style={{ backgroundColor: pal.errorBg, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: pal.errorBorder }}>
                <Ionicons
                  name={syncState.status === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline'}
                  size={20}
                  color={pal.errorText}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: pal.errorText }}>
                    {syncState.status === 'api_limit'
                      ? 'Instagram senkronizasyonu geçici olarak durdu.'
                      : syncState.status === 'offline'
                      ? 'Bağlantı yok, son kayıtlı içerikler gösteriliyor.'
                      : 'Senkronizasyon hatası oluştu.'}
                  </Text>
                  {syncState.error && (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.errorText, marginTop: 3 }}>{syncState.error}</Text>
                  )}
                </View>
              </View>
            )}

            {/* Connected Account Card */}
            <View style={{ backgroundColor: pal.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: pal.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ position: 'relative' }}>
                  <Image
                    source={{ uri: connection.profilePicUrl ?? 'https://via.placeholder.com/60' }}
                    style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2.5, borderColor: '#E1306C' }}
                  />
                  <View style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: pal.card }}>
                    <Ionicons name="checkmark" size={11} color="#fff" />
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: pal.textPrimary }}>@{connection.username}</Text>
                    <View style={{ backgroundColor: '#E1306C15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#E1306C' }}>{connection.accountType}</Text>
                    </View>
                  </View>
                  {connection.displayName && (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: pal.textSecondary, marginTop: 2 }}>{connection.displayName}</Text>
                  )}
                  {connection.connectedAt && (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textSecondary, marginTop: 4 }}>
                      Bağlandı: {new Date(connection.connectedAt).toLocaleDateString('tr-TR')}
                    </Text>
                  )}
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Takipçi', value: formatIgCount(connection.followersCount) },
                  { label: 'Medya', value: String(connection.mediaCount) },
                  { label: 'Hesap', value: connection.accountType ?? 'BUSINESS' },
                ].map((stat) => (
                  <View key={stat.label} style={{ flex: 1, backgroundColor: pal.statBg, borderRadius: 12, padding: 10, alignItems: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: pal.textPrimary }}>{stat.value}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textSecondary, marginTop: 2 }}>{stat.label}</Text>
                  </View>
                ))}
              </View>

              {/* Sync Status Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: pal.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {syncing ? (
                    <ActivityIndicator size="small" color="#3B82F6" />
                  ) : (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: syncStatusColor(syncState.status) }} />
                  )}
                  <View>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: syncStatusColor(syncState.status) }}>
                      {syncing ? 'Senkronize ediliyor...' : syncStatusLabel(syncState.status)}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textSecondary }}>
                      Son sync: {formatSyncTime(syncState.lastSyncAt)}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={handleSync}
                  disabled={syncing}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#EFF6FF', borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 5, opacity: syncing ? 0.6 : 1 }}
                >
                  <Ionicons name="refresh-outline" size={14} color={colors.primary} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>Şimdi Sync</Text>
                </Pressable>
              </View>
            </View>

            {/* Action Buttons */}
            <Pressable
              onPress={() => router.push('/instagram-content' as never)}
              style={{ backgroundColor: colors.primary, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            >
              <Ionicons name="grid-outline" size={20} color="#fff" />
              <View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>İçerikleri Yönet</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                  {connection.mediaCount} gönderi • Ürüne çevir, gizle, hikayeye aktar
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" style={{ marginLeft: 'auto' }} />
            </Pressable>

            {tokenExpired && (
              <Pressable
                onPress={handleOAuthConnect}
                disabled={oauthLoading}
                style={{ backgroundColor: '#E1306C', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {oauthLoading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="refresh-outline" size={18} color="#fff" />}
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>Bağlantıyı Yenile</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleDisconnect}
              style={{ backgroundColor: pal.disconnectBg, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: pal.disconnectBorder }}
            >
              <Ionicons name="unlink-outline" size={18} color={colors.danger} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.danger }}>Bağlantıyı Kes</Text>
            </Pressable>

            <View style={{ backgroundColor: pal.warnBg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: pal.warnBorder }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: pal.warnText, textAlign: 'center', lineHeight: 18 }}>
                🔒 Erişim tokenın güvenli şekilde Supabase tarafında saklanır. İçeriklerine sadece sen erişebilirsin.
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* Hero */}
            <View style={{ backgroundColor: pal.card, borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: pal.border }}>
              <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#E1306C15', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <Ionicons name="logo-instagram" size={44} color="#E1306C" />
              </View>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: pal.textPrimary, textAlign: 'center' }}>
                Instagram'ı Bağla
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: pal.textSecondary, textAlign: 'center', marginTop: 10, lineHeight: 22 }}>
                Business veya Creator hesabını bağlayarak gönderilerini otomatik ürüne dönüştür. İçeriklerini tek yerden yönet.
              </Text>
            </View>

            {/* Benefits */}
            {[
              { icon: 'images-outline', title: 'Gönderi & Reels İthal Et', desc: 'Mevcut içeriklerini mağazana aktar', color: '#6366F1' },
              { icon: 'sparkles-outline', title: 'Otomatik Ürün Taslağı', desc: 'Caption\'dan fiyat, kategori, beden otomatik çıkar', color: '#F59E0B' },
              { icon: 'rocket-outline', title: 'Hızlı Onay ve Yayınlama', desc: 'Tek tıkla ürünleri yayınla, satışa başla', color: '#10B981' },
              { icon: 'sync-outline', title: 'Otomatik Senkronizasyon', desc: 'Yeni gönderiler otomatik içe aktarılır (15 dk)', color: '#3B82F6' },
              { icon: 'stats-chart-outline', title: 'İstatistikler', desc: 'Beğeni, görüntülenme ve etkileşim takibi', color: '#8B5CF6' },
            ].map((item) => (
              <View
                key={item.title}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: pal.benefitBg, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: pal.border, gap: 14 }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: item.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={item.icon as any} size={22} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: pal.textPrimary }}>{item.title}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary, marginTop: 2 }}>{item.desc}</Text>
                </View>
              </View>
            ))}

            {/* OAuth Connect Button */}
            <Pressable
              onPress={handleOAuthConnect}
              disabled={oauthLoading}
              style={{ backgroundColor: '#E1306C', borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: oauthLoading ? 0.8 : 1 }}
            >
              {oauthLoading ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <View>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>Instagram ile Bağlanıyor...</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Yetkilendirme bekleniyor</Text>
                  </View>
                </>
              ) : (
                <>
                  <Ionicons name="logo-instagram" size={24} color="#fff" />
                  <View>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>Instagram ile Oturum Aç</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Business veya Creator hesabı</Text>
                  </View>
                </>
              )}
            </Pressable>

            {/* Warning */}
            <View style={{ backgroundColor: pal.warnBg, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: pal.warnBorder }}>
              <Ionicons name="information-circle-outline" size={18} color={pal.warnText} style={{ marginTop: 1 }} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.warnText, flex: 1, lineHeight: 18 }}>
                Sadece Business veya Creator hesaplar desteklenir. Kişisel hesaplar bağlanamaz. Erişim tokenın güvenli şekilde saklanır.
              </Text>
            </View>
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
