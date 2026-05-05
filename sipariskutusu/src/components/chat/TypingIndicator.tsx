import { Text, View } from 'react-native';
import { colors, fonts } from '../../constants/theme';

type TypingIndicatorProps = {
  visible: boolean;
  label?: string;
};

export function TypingIndicator({ visible, label = 'Yazıyor...' }: TypingIndicatorProps) {
  if (!visible) return null;

  return (
    <View style={{ marginBottom: 12, alignItems: 'flex-start' }}>
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: colors.borderLight,
          borderWidth: 1,
          borderRadius: 16,
          paddingHorizontal: 12,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted }} />
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted }} />
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted }} />
        </View>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{label}</Text>
      </View>
    </View>
  );
}
