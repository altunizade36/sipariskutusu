import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../../src/constants/theme';

export default function ListingStep10RedirectScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/create-listing');
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7] items-center justify-center px-6" edges={['top']}>
      <View className="bg-white rounded-2xl border border-[#33333315] p-5 items-center">
        <ActivityIndicator color={colors.primary} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginTop: 12 }}>
          Hızlı ilan ekranı açılıyor
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 6, textAlign: 'center' }}>
          Yeni ilan akışı tek sayfada tamamlanır.
        </Text>
      </View>
    </SafeAreaView>
  );
}