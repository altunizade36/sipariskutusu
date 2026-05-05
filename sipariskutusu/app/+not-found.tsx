import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../src/constants/theme';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
      <View style={{ backgroundColor: '#FEE2E2' }} className="w-20 h-20 rounded-full items-center justify-center">
        <Ionicons name="alert-circle" size={40} color={colors.primary} />
      </View>
      <Text
        style={{ fontFamily: fonts.headingBold, fontSize: 20, color: colors.textPrimary, marginTop: 16 }}
      >
        Page Not Found
      </Text>
      <Text
        style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6 }}
      >
        The page you're looking for doesn't exist.
      </Text>
      <Pressable
        onPress={() => router.replace('/')}
        style={{ backgroundColor: colors.primary }}
        className="mt-6 h-12 px-6 rounded-xl items-center justify-center"
      >
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Back to Home</Text>
      </Pressable>
    </SafeAreaView>
  );
}
