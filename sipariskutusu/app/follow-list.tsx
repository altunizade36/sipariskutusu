import { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import { discoverSellers } from '../src/data/storeData';
import { useAuth } from '../src/context/AuthContext';
import { useListings } from '../src/context/ListingsContext';

type Tab = 'followers' | 'following';

export default function FollowListScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { user } = useAuth();
  const { hasStore, followedSellers, toggleSellerFollow } = useListings();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>(tab === 'followers' ? 'followers' : 'following');

  useEffect(() => {
    setActiveTab(tab === 'followers' ? 'followers' : 'following');
  }, [tab]);

  const followersData = useMemo(
    () =>
      discoverSellers
        .filter((_, index) => index % 2 === 0)
        .map((seller) => ({
          ...seller,
          followsMe: true,
          isFollowing: Boolean(followedSellers[seller.id]),
        })),
    [followedSellers],
  );

  const followingData = useMemo(
    () =>
      discoverSellers.map((seller) => ({
        ...seller,
        followsMe: false,
        isFollowing: Boolean(followedSellers[seller.id]),
      })),
    [followedSellers],
  );

  const source = activeTab === 'followers' ? followersData : followingData;
  const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');
  const visible = source.filter((item) => {
    if (!normalizedQuery) {
      return true;
    }

    return (
      item.name.toLocaleLowerCase('tr-TR').includes(normalizedQuery)
      || item.username.toLocaleLowerCase('tr-TR').includes(normalizedQuery)
      || item.city.toLocaleLowerCase('tr-TR').includes(normalizedQuery)
    );
  });

  if (!hasStore) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        <View className="px-4 py-3 border-b border-[#33333315] flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-full bg-[#F7F7F7] items-center justify-center">
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </Pressable>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: colors.textPrimary }}>Takip Listesi</Text>
          <View style={{ width: 40 }} />
        </View>

        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="lock-closed-outline" size={42} color={colors.textMuted} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginTop: 10 }}>Bu liste sadece mağaza sahibine açık</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 6, textAlign: 'center' }}>
            {user
              ? 'Takipçi ve takip listelerini görüntülemek için önce mağaza kurulumunu tamamlamalısın.'
              : 'Takipçi ve takip listelerini görüntülemek için önce giriş yapmalısın.'}
          </Text>

          <View className="w-full mt-6 gap-2">
            <Pressable
              onPress={() => router.replace(user ? '/store-setup' : '/auth')}
              style={{ backgroundColor: colors.primary }}
              className="h-12 rounded-xl items-center justify-center"
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>
                {user ? 'Mağaza Kurulumuna Git' : 'Giriş Yap'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
              className="h-12 rounded-xl border items-center justify-center"
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>
                Geri Dön
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="px-4 py-3 border-b border-[#33333315] flex-row items-center justify-between">
        <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-full bg-[#F7F7F7] items-center justify-center">
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: colors.textPrimary }}>Bağlantılar</Text>
        <View style={{ width: 40 }} />
      </View>

      <View className="px-4 pt-3">
        <View className="flex-row rounded-xl border border-[#33333315] overflow-hidden">
          {(['followers', 'following'] as Tab[]).map((item) => {
            const selected = activeTab === item;
            return (
              <Pressable
                key={item}
                onPress={() => setActiveTab(item)}
                style={{ backgroundColor: selected ? '#EFF6FF' : '#fff', flex: 1 }}
                className="h-10 items-center justify-center"
              >
                <Text style={{ fontFamily: selected ? fonts.bold : fonts.medium, fontSize: 12, color: selected ? colors.primary : colors.textPrimary }}>
                  {item === 'followers' ? 'Takipçiler' : 'Takip Edilenler'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-3 flex-row items-center rounded-xl border border-[#33333315] px-3 h-11 bg-[#F7F7F7]">
          <Ionicons name="search" size={17} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            showSoftInputOnFocus
            autoCorrect
            placeholder="Ara"
            placeholderTextColor={colors.textMuted}
            style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary }}
            className="ml-2 flex-1"
          />
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => {
          return (
            <Pressable
              onPress={() => {
                const encodedName = encodeURIComponent(item.name);
                router.push(`/(tabs)/store?name=${encodedName}&storeKey=${encodeURIComponent(item.id)}&sellerId=${encodeURIComponent(item.id)}` as never);
              }}
              className="flex-row items-center border border-[#33333315] rounded-2xl px-3 py-3 bg-white active:opacity-80"
            >
              <View style={{ width: 42, height: 42, borderRadius: 21, overflow: 'hidden', borderWidth: 1.5, borderColor: item.isFollowing ? colors.primary : colors.borderLight }}>
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={{ width: 42, height: 42 }} resizeMode="cover" />
                ) : (
                  <View className="w-full h-full bg-[#EFF6FF] items-center justify-center">
                    <Ionicons name="storefront-outline" size={18} color={colors.primary} />
                  </View>
                )}
              </View>

              <View className="flex-1 ml-3">
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }} numberOfLines={1}>{item.name}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>
                  {item.username} • {item.city}
                </Text>
              </View>

              <Pressable
                onPress={(e) => { e.stopPropagation(); toggleSellerFollow(item.id); }}
                style={{ backgroundColor: item.isFollowing ? '#F1F5F9' : colors.primary, borderWidth: 1, borderColor: item.isFollowing ? colors.borderLight : colors.primary }}
                className="h-8 px-3 rounded-full items-center justify-center"
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: item.isFollowing ? colors.textPrimary : '#fff' }}>
                  {item.isFollowing ? 'Takiptesin' : 'Takip Et'}
                </Text>
              </Pressable>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View className="items-center justify-center mt-16">
            <Ionicons name="people-outline" size={36} color={colors.textMuted} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 8 }}>Sonuç bulunamadı</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
