import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../constants/theme';

type NewMessageButtonProps = {
  onPress: () => void;
};

export function NewMessageButton({ onPress }: NewMessageButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        position: 'absolute',
        right: 16,
        bottom: 20,
        backgroundColor: colors.primary,
        borderRadius: 999,
        height: 48,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        elevation: 3,
      }}
    >
      <Ionicons name="create-outline" size={18} color="#fff" />
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Yeni Mesaj</Text>
    </Pressable>
  );
}
