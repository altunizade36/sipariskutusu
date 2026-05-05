import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../constants/theme';

export function ProfileButton() {
  const router = useRouter();

  return (
    <Pressable onPress={() => router.push('/account')} hitSlop={10}>
      <View
        style={{ backgroundColor: '#EFF6FF', borderColor: colors.borderLight }}
        className="w-10 h-10 rounded-full items-center justify-center border"
      >
        <Ionicons name="person-outline" size={20} color={colors.primary} />
      </View>
    </Pressable>
  );
}