import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../constants/theme';

type FeatureRetiredScreenProps = {
  title: string;
  description: string;
};

export default function FeatureRetiredScreen({ title, description }: FeatureRetiredScreenProps) {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      <View className="flex-1 px-5 items-center justify-center">
        <View className="w-16 h-16 rounded-full bg-[#DBEAFE] items-center justify-center">
          <Ionicons name="chatbubble-ellipses-outline" size={30} color={colors.primary} />
        </View>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: colors.textPrimary, marginTop: 16 }}>
          {title}
        </Text>
        <Text
          style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 }}
        >
          {description}
        </Text>

        <View className="w-full mt-6 gap-2">
          <Pressable
            onPress={() => router.replace('/messages')}
            style={{ backgroundColor: colors.primary }}
            className="h-12 rounded-xl items-center justify-center"
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>
              Mesajlara Git
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/')}
            style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
            className="h-12 rounded-xl border items-center justify-center"
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>
              Anasayfaya Dön
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
