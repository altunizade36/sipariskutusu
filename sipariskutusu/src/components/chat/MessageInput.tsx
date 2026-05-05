import { Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../constants/theme';

type MessageInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onOpenAttachments: () => void;
  disabled?: boolean;
};

export function MessageInput({ value, onChangeText, onSend, onOpenAttachments, disabled }: MessageInputProps) {
  const trimmed = value.trim();

  return (
    <View style={{ backgroundColor: '#fff', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#33333315' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <Pressable onPress={onOpenAttachments} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F7F7F7', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
          <Ionicons name="add" size={22} color={colors.textSecondary} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Mesaj yaz..."
          placeholderTextColor={colors.textMuted}
          multiline
          editable={!disabled}
          style={{
            flex: 1,
            backgroundColor: '#F7F7F7',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#33333315',
            paddingHorizontal: 14,
            paddingVertical: 10,
            maxHeight: 96,
            fontFamily: fonts.regular,
            fontSize: 13,
            color: colors.textPrimary,
          }}
        />
        {trimmed ? (
          <Pressable
            onPress={onSend}
            disabled={disabled}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 8,
              backgroundColor: disabled ? '#AFC7ED' : colors.primary,
            }}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
