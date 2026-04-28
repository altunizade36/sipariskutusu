import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../src/constants/theme';
import { useListings } from '../../src/context/ListingsContext';
import { useAuth } from '../../src/context/AuthContext';
import { useAndroidTabBackToHome } from '../../src/hooks/useAndroidTabBackToHome';

export default function SellScreen() {
  const router = useRouter();
  useAndroidTabBackToHome();
  const { user } = useAuth();
  const { hasStore, publishedListings, removeListing } = useListings();

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <View className="p-4 gap-4">
        <View className="bg-white rounded-2xl p-4 border border-[#33333315]">
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 24, color: colors.textPrimary }}>İlan Ver</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }} className="mt-2 leading-5">
            Fotoğraf, başlık, fiyat ve teslimat bilgilerini tek sayfada gir; ilanını yaklaşık 1 dakikada yayınla.
          </Text>

          <View className="mt-4 gap-2">
            {[
              'Fotoğraf ekle ve kapak seç',
              'Başlık, kategori, fiyat ve şehir gir',
              'Önizlemeyi kontrol edip yayınla',
            ].map((item) => (
              <Text key={item} style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>
                • {item}
              </Text>
            ))}
          </View>

          <Pressable
            onPress={() => router.push(user ? '/create-listing' : '/auth')}
            style={{ backgroundColor: user ? colors.primary : '#1D4ED8' }}
            className="h-12 rounded-xl items-center justify-center mt-5"
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>
              {user ? 'Hızlı İlan Ver (1 dk)' : 'İlan Vermek İçin Giriş Yap / Kayıt Ol'}
            </Text>
          </Pressable>

          {!user ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted }} className="mt-2">
              Ürünleri gezebilirsin; ilan yayınlama için hesap gerekir.
            </Text>
          ) : null}
        </View>

        <View className="bg-white rounded-2xl p-4 border border-[#33333315]">
          <View className="flex-row items-center justify-between">
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>Durum</Text>
            <View className="flex-row items-center gap-2">
              <Ionicons name={hasStore ? 'storefront' : 'person-circle-outline'} size={16} color={hasStore ? colors.success : colors.primary} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: hasStore ? colors.success : colors.primary }}>
                {hasStore ? 'Mağaza aktif' : 'Bireysel satıcı modu'}
              </Text>
            </View>
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} className="mt-2">
            Yayınlanan ilan sayısı: {publishedListings.length}
          </Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted }} className="mt-2">
            İlan vermek için mağaza açman gerekmez. Mağaza akışı ayrı çalışır.
          </Text>
        </View>

        <View className="bg-white rounded-2xl p-4 border border-[#33333315]">
          <View className="flex-row items-center justify-between">
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>Ürünlerim</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>
              {publishedListings.length} ilan
            </Text>
          </View>

          {publishedListings.length === 0 ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted }} className="mt-3">
              Henüz bireysel ilanın yok. İlk ilanını başlatıp burada görebilirsin.
            </Text>
          ) : (
            <View className="mt-3 gap-2">
              {publishedListings.slice(0, 5).map((item) => (
                <View key={item.id} className="rounded-xl border border-[#33333315] px-3 py-2 flex-row items-center justify-between">
                  <Pressable
                    onPress={() => router.push(`/product/${item.id}`)}
                    className="flex-1"
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>
                      ₺{item.price.toFixed(2)}
                    </Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => router.push(`/listing/edit?id=${item.id}`)}
                    className="ml-2 h-8 px-3 rounded-lg bg-[#EFF6FF] items-center justify-center"
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>Düzenle</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        'İlan Sil',
                        'Bu ilanı kaldırmak istediğine emin misin?',
                        [
                          { text: 'Vazgeç', style: 'cancel' },
                          {
                            text: 'Sil',
                            style: 'destructive',
                            onPress: () => {
                              removeListing(item.id);
                            },
                          },
                        ],
                      );
                    }}
                    className="ml-2 h-8 px-3 rounded-lg bg-[#FEE2E2] items-center justify-center"
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.danger }}>Sil</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
