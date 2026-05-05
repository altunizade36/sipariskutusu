import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../constants/theme';

type EmptyChatStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyChatState({ title, description, actionLabel, onAction }: EmptyChatStateProps) {
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#33333315',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 16,
        paddingVertical: 32,
        alignItems: 'center',
        marginTop: 8,
      }}
    >
      <Ionicons name="chatbubble-ellipses-outline" size={26} color={colors.textMuted} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, marginTop: 10 }}>{title}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 6, textAlign: 'center' }}>
        {description}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={{ marginTop: 16, height: 40, borderRadius: 12, backgroundColor: colors.primary, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
