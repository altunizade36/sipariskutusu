import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../constants/theme';

export function FavoriteButton() {
  const router = useRouter();

  return (
    <Pressable onPress={() => router.push('/favorites')} hitSlop={10}>
      <View
        style={{ backgroundColor: '#FCE7F3', borderColor: '#FBCFE8' }}
        className="w-10 h-10 rounded-full items-center justify-center border"
      >
        <Ionicons name="heart-outline" size={20} color={colors.danger} />
      </View>
    </Pressable>
  );
}