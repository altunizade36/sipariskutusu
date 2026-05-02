import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Alert, TextInput, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import {
  getInstagramConnection,
  connectInstagram,
  disconnectInstagram,
  formatIgCount,
  type InstagramConnection,
} from '../src/services/instagramService';

export default function InstagramConnectScreen() {
  const router = useRouter();
  const [connection, setConnection] = useState<InstagramConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [username, setUsername] = useState('');
  const [accountType, setAccountType] = useState<'BUSINESS' | 'CREATOR'>('BUSINESS');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    getInstagramConnection().then((c) => {
      setConnection(c);
      setLoading(false);
    });
  }, []);

  async function handleConnect() {
    const clean = username.trim().replace('@', '');
    if (!clean || clean.length < 2) {
      Alert.alert('Hata', 'Geçerli bir Instagram kullanıcı adı girin.');
      return;
    }
    setConnecting(true);
    try {
      const conn = await connectInstagram(clean, accountType);
      setConnection(conn);
      setShowForm(false);
      Alert.alert('Bağlandı! 🎉', `@${conn.username} hesabı başarıyla bağlandı.`);
    } catch {
      Alert.alert('Hata', 'Bağlantı kurulamadı, lütfen tekrar dene.');
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    Alert.alert(
      'Bağlantıyı Kes',
      'Instagram hesabını uygulamadan ayırmak istediğine emin misin?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Bağlantıyı Kes',
          style: 'destructive',
          onPress: async () => {
            await disconnectInstagram();
            setConnection({ connected: false, accountId: null, username: null, displayName: null, profilePicUrl: null, followersCount: 0, mediaCount: 0, accountType: null, connectedAt: null });
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#33333315' }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: colors.textPrimary }}>Instagram Entegrasyonu</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>Business veya Creator hesabını bağla</Text>
        </View>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#E1306C15', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="logo-instagram" size={18} color="#E1306C" />
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">

          {connection?.connected ? (
            <>
              {/* Connected Card */}
              <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#33333315' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <Image
                    source={{ uri: connection.profilePicUrl ?? 'https://via.placeholder.com/60' }}
                    style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#E1306C' }}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>@{connection.username}</Text>
                      <View style={{ backgroundColor: '#E1306C15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#E1306C' }}>{connection.accountType}</Text>
                      </View>
                    </View>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{connection.displayName}</Text>
                  </View>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark" size={16} color="#16A34A" />
                  </View>
                </View>

                {/* Stats */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {[
                    { label: 'Takipçi', value: formatIgCount(connection.followersCount) },
                    { label: 'Medya', value: String(connection.mediaCount) },
                    { label: 'Durum', value: '✓ Bağlı' },
                  ].map((stat) => (
                    <View key={stat.label} style={{ flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10, alignItems: 'center' }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{stat.value}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{stat.label}</Text>
                    </View>
                  ))}
                </View>

                {connection.connectedAt && (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 12, textAlign: 'center' }}>
                    Bağlandı: {new Date(connection.connectedAt).toLocaleDateString('tr-TR')}
                  </Text>
                )}
              </View>

              {/* Action Buttons */}
              <Pressable
                onPress={() => router.push('/instagram-content' as never)}
                style={{ backgroundColor: colors.primary, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Ionicons name="grid-outline" size={20} color="#fff" />
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>İçerikleri Görüntüle</Text>
              </Pressable>

              <Pressable
                onPress={handleDisconnect}
                style={{ backgroundColor: '#FFF5F5', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#FECACA' }}
              >
                <Ionicons name="unlink-outline" size={18} color={colors.danger} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.danger }}>Bağlantıyı Kes</Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* Hero */}
              <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#33333315' }}>
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#E1306C15', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Ionicons name="logo-instagram" size={40} color="#E1306C" />
                </View>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 20, color: colors.textPrimary, textAlign: 'center' }}>
                  Instagram'ı Bağla
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 21 }}>
                  Business veya Creator hesabını bağlayarak gönderilerini otomatik ürüne dönüştür.
                </Text>
              </View>

              {/* Benefits */}
              {[
                { icon: 'images-outline', title: 'Gönderi & Reels İthal Et', desc: 'İçeriklerini mağazana aktar' },
                { icon: 'flash-outline', title: 'Otomatik Ürün Taslağı', desc: 'Caption\'dan fiyat, kategori, beden otomatik çıkar' },
                { icon: 'rocket-outline', title: 'Hızlı Onay', desc: 'Tek tıkla ürünleri yayınla' },
                { icon: 'stats-chart-outline', title: 'İstatistikler', desc: 'Beğeni, görüntülenme ve etkileşim takibi' },
              ].map((item) => (
                <View key={item.title} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#33333315', gap: 14 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={item.icon as any} size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{item.title}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{item.desc}</Text>
                  </View>
                </View>
              ))}

              {/* Connect Form */}
              {showForm ? (
                <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#33333315', gap: 14 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>Hesap Bilgileri</Text>

                  <View>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Instagram Kullanıcı Adı</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8, backgroundColor: '#F8FAFC' }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary }}>@</Text>
                      <TextInput
                        value={username}
                        onChangeText={setUsername}
                        placeholder="kullaniciadi"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary }}
                      />
                    </View>
                  </View>

                  <View>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>Hesap Türü</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {(['BUSINESS', 'CREATOR'] as const).map((type) => (
                        <Pressable
                          key={type}
                          onPress={() => setAccountType(type)}
                          style={{ flex: 1, borderRadius: 12, padding: 12, borderWidth: 2, alignItems: 'center', borderColor: accountType === type ? colors.primary : '#E2E8F0', backgroundColor: accountType === type ? '#EFF6FF' : '#F8FAFC' }}
                        >
                          <Ionicons
                            name={type === 'BUSINESS' ? 'business-outline' : 'person-circle-outline'}
                            size={22}
                            color={accountType === type ? colors.primary : colors.textSecondary}
                          />
                          <Text style={{ fontFamily: accountType === type ? fonts.bold : fonts.medium, fontSize: 12, color: accountType === type ? colors.primary : colors.textSecondary, marginTop: 4 }}>
                            {type === 'BUSINESS' ? 'Business' : 'Creator'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <Pressable
                    onPress={handleConnect}
                    disabled={connecting}
                    style={{ backgroundColor: '#E1306C', borderRadius: 14, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                  >
                    {connecting ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="logo-instagram" size={18} color="#fff" />}
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{connecting ? 'Bağlanıyor...' : 'Instagram ile Bağlan'}</Text>
                  </Pressable>

                  <Pressable onPress={() => setShowForm(false)} style={{ alignItems: 'center', padding: 8 }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>İptal</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setShowForm(true)}
                  style={{ backgroundColor: '#E1306C', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                >
                  <Ionicons name="logo-instagram" size={22} color="#fff" />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>Instagram Hesabı Bağla</Text>
                </Pressable>
              )}

              <View style={{ backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: '#FDE68A' }}>
                <Ionicons name="information-circle-outline" size={18} color="#D97706" style={{ marginTop: 1 }} />
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: '#92400E', flex: 1, lineHeight: 18 }}>
                  Sadece Business veya Creator hesaplar desteklenir. Kişisel hesaplar bağlanamaz.
                </Text>
              </View>
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
