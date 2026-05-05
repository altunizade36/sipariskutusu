import { Image, Pressable, Text, View } from 'react-native';
import { colors, fonts } from '../../constants/theme';

type MessageBubbleProps = {
  mine: boolean;
  text: string;
  imageUri?: string;
  timeLabel: string;
  statusLabel?: string | null;
  onLongPress?: () => void;
};

export function MessageBubble({ mine, text, imageUri, timeLabel, statusLabel, onLongPress }: MessageBubbleProps) {
  return (
    <View style={{ marginBottom: 12, alignItems: mine ? 'flex-end' : 'flex-start' }}>
      {imageUri ? (
        <Pressable onLongPress={onLongPress}>
          <Image source={{ uri: imageUri }} style={{ width: 200, height: 200, borderRadius: 14 }} />
        </Pressable>
      ) : (
        <Pressable onLongPress={onLongPress}>
          <View
            style={{
              maxWidth: '82%',
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderWidth: 1,
              backgroundColor: mine ? colors.primary : '#FFFFFF',
              borderColor: mine ? colors.primary : colors.borderLight,
            }}
          >
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: mine ? '#fff' : colors.textPrimary }}>{text}</Text>
          </View>
        </Pressable>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textMuted }}>{timeLabel}</Text>
        {statusLabel ? <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted }}>{statusLabel}</Text> : null}
      </View>
    </View>
  );
}
