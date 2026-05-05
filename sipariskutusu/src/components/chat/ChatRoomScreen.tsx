import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

type ChatRoomScreenProps = {
  children: ReactNode;
};

export function ChatRoomScreen({ children }: ChatRoomScreenProps) {
  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}>
      <View className="flex-1">{children}</View>
    </KeyboardAvoidingView>
  );
}
