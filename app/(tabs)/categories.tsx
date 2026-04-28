import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { colors, fonts } from '../../src/constants/theme';
import { useListings } from '../../src/context/ListingsContext';
import { MARKETPLACE_CATEGORIES } from '../../src/constants/marketplaceCategories';
import { FavoriteButton } from '../../src/components/FavoriteButton';
import { ProfileButton } from '../../src/components/ProfileButton';
import { useAndroidTabBackToHome } from '../../src/hooks/useAndroidTabBackToHome';
import { ProductCard } from '../../src/components/ProductCard';

const subcategoriesMap: Record<string, string[]> = {
  women: ['Elbise', 'Bluz', 'Kot Pantolon', 'Etek', 'Dış Giyim', 'Triko', 'Spor Giyim', 'İç Giyim'],
  men: ['Tişört', 'Gömlek', 'Kot Pantolon', 'Pantolon', 'Dış Giyim', 'Takım Elbise', 'Spor Giyim', 'İç Giyim'],
  'mother-child': ['Kız Bebek', 'Erkek Bebek', 'Kız Çocuk', 'Erkek Çocuk', 'Oyuncak', 'Bebek Maması', 'Bebek Bezi', 'Puset'],
  home: ['Yatak Odası', 'Oturma Odası', 'Mutfak', 'Banyo', 'Dekor', 'Aydınlatma', 'Depolama', 'Bahçe'],
  supermarket: ['Gıda', 'İçecek', 'Atıştırmalık', 'Temizlik', 'Kişisel Bakım', 'Pet Mama', 'Bebek Bakım', 'Taze'],
  cosmetics: ['Makyaj', 'Cilt Bakımı', 'Saç Bakımı', 'Parfüm', 'Vücut Bakımı', 'Oje', 'Aksesuar', 'Erkek'],
  'shoes-bags': ['Spor Ayakkabı', 'Topuklu', 'Babet', 'Bot', 'El Çantası', 'Sırt Çantası', 'Cüzdan', 'Valiz'],
  electronics: ['Telefon', 'Laptop', 'Tablet', 'Ses', 'TV', 'Oyun', 'Kamera', 'Akıllı Ev'],
  watches: ['Akıllı Saat', 'Erkek Saat', 'Kadın Saat', 'Takı', 'Güneş Gözlüğü', 'Kemer', 'Şapka', 'Eşarp'],
  sports: ['Fitness', 'Koşu', 'Outdoor', 'Bisiklet', 'Yüzme', 'Takım Sporu', 'Kış Sporu', 'Yoga'],
};

export default function CategoriesScreen() {
  const router = useRouter();
  useAndroidTabBackToHome();
  const { allProducts } = useListings();
  const [selected, setSelected] = useState(MARKETPLACE_CATEGORIES[0].id);
  const categoryCounts = useMemo(
    () =>
      allProducts.reduce<Record<string, number>>((acc, item) => {
        acc[item.category] = (acc[item.category] ?? 0) + 1;
        return acc;
      }, {}),
    [allProducts],
  );
  const selectedProducts = useMemo(
    () => allProducts.filter((item) => item.category === selected).slice(0, 8),
    [allProducts, selected],
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="px-4 py-3 border-b border-[#33333315]">
        <View className="flex-row items-center justify-between">
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: colors.textPrimary }}>
            Kategoriler
          </Text>
          <View className="flex-row items-center gap-3">
            <FavoriteButton />
            <ProfileButton />
          </View>
        </View>
        <Pressable
          onPress={() => router.push('/search')}
          className="flex-row items-center bg-[#F7F7F7] rounded-xl px-3 h-11 mt-3 border border-[#33333315]"
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <Text
            style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted }}
            className="ml-2 flex-1"
          >
            Kategorilerde ara
          </Text>
        </Pressable>
      </View>

      <View className="flex-1 flex-row">
        {/* Left sidebar */}
        <ScrollView className="bg-[#F7F7F7]" style={{ width: 104 }} showsVerticalScrollIndicator={false}>
          {MARKETPLACE_CATEGORIES.map((c) => {
            const active = selected === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => setSelected(c.id)}
                style={{
                  backgroundColor: active ? '#fff' : 'transparent',
                  borderLeftColor: active ? colors.primary : 'transparent',
                  borderLeftWidth: 3,
                }}
                className="px-2 py-4 items-center"
              >
                <Text style={{ fontSize: 22 }}>{c.icon}</Text>
                <Text
                  numberOfLines={2}
                  style={{
                    fontFamily: active ? fonts.bold : fonts.regular,
                    fontSize: 10,
                    lineHeight: 13,
                    color: active ? colors.primary : colors.textPrimary,
                    textAlign: 'center',
                    marginTop: 4,
                    minHeight: 26,
                  }}
                >
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Right panel */}
        <ScrollView className="flex-1 px-3 py-4" showsVerticalScrollIndicator={false}>
          <View
            style={{ backgroundColor: colors.primary, minHeight: 116 }}
            className="rounded-2xl px-4 py-3 overflow-hidden mb-4"
          >
            <View className="pr-14">
              <Text
                numberOfLines={2}
                style={{ fontFamily: fonts.headingBold, fontSize: 16, lineHeight: 20, color: '#fff' }}
              >
                {MARKETPLACE_CATEGORIES.find((c) => c.id === selected)?.name}
              </Text>
              <Text
                numberOfLines={2}
                style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: '#ffffffdd', marginTop: 4 }}
              >
                {(categoryCounts[selected] ?? 0)} ürün{`\n`}arasından keşfet
              </Text>
              <View className="bg-white rounded-full px-3 py-1 self-start mt-2">
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>
                  Al
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 40, position: 'absolute', right: 10, top: 10 }}>
              {MARKETPLACE_CATEGORIES.find((c) => c.id === selected)?.icon}
            </Text>
          </View>

          <Text
            style={{ fontFamily: fonts.headingBold, fontSize: 14, color: colors.textPrimary }}
            className="mb-3 px-1"
          >
            Alt Kategoriler
          </Text>

          <View className="flex-row flex-wrap -mx-1">
            {(subcategoriesMap[selected] ?? []).map((sub) => (
              <View key={sub} style={{ width: '50%' }} className="px-1 mb-2">
                <Pressable
                  onPress={() => setSelected(selected)}
                  className="bg-[#F7F7F7] rounded-xl p-3 items-center active:opacity-80"
                >
                  <View
                    style={{ backgroundColor: '#fff' }}
                    className="w-12 h-12 rounded-lg items-center justify-center mb-2"
                  >
                    <Text style={{ fontSize: 22 }}>
                      {MARKETPLACE_CATEGORIES.find((c) => c.id === selected)?.icon}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={2}
                    style={{ fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: colors.textPrimary, textAlign: 'center', minHeight: 28 }}
                  >
                    {sub}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>

          <Text
            style={{ fontFamily: fonts.headingBold, fontSize: 14, color: colors.textPrimary }}
            className="mt-2 mb-3 px-1"
          >
            Seçili Kategoride Ürünler
          </Text>

          {selectedProducts.length > 0 ? (
            <View className="-mx-1">
              {selectedProducts.map((product) => (
                <View key={product.id} style={{ width: '100%' }} className="px-1 mb-2">
                  <View className="bg-white rounded-xl overflow-hidden border border-[#33333315]">
                    <ProductCard product={product} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="bg-[#F8FAFC] border border-dashed border-[#CBD5E1] rounded-xl px-3 py-4 items-center">
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary, marginTop: 6 }}>
                Bu kategori için ürün bulunamadı.
              </Text>
            </View>
          )}

          <View className="h-4" />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
