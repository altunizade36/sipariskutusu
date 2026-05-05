import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  attachment?: {
    type: 'image' | 'file';
    url: string;
    name: string;
  };
}

interface ChatRoomProps {
  participantName: string;
  participantAvatar: string;
  isOnline: boolean;
  productName: string;
  productImage: string;
  messages: Message[];
  currentUserId: string;
  isDarkMode: boolean;
  isLoading: boolean;
  onSendMessage: (content: string) => Promise<void>;
  onBack: () => void;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerDark: {
    borderBottomColor: '#2A2A2A',
  },
  backButton: {
    fontSize: 28,
    marginRight: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarDark: {
    backgroundColor: '#2A2A2A',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  onlineIndicatorDark: {
    borderColor: '#0A0A0A',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  headerTitleDark: {
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
  headerSubtitleDark: {
    color: '#666666',
  },
  productBadge: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '500',
  },
  productBadgeDark: {
    backgroundColor: '#1E3A5F',
    color: '#93C5FD',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  messageBubble: {
    marginVertical: 6,
    maxWidth: '85%',
  },
  messageBubbleOwn: {
    alignSelf: 'flex-end',
  },
  messageBubbleOther: {
    alignSelf: 'flex-start',
  },
  messageBubbleContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  messageBubbleContentOwn: {
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  messageBubbleContentOther: {
    backgroundColor: '#E5E7EB',
    borderBottomLeftRadius: 4,
  },
  messageBubbleContentOtherDark: {
    backgroundColor: '#2A2A2A',
  },
  messageText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  messageTextOther: {
    color: '#000000',
  },
  messageTextOtherDark: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 11,
    color: '#999999',
    marginTop: 4,
    textAlign: 'right',
  },
  messageTimeOther: {
    textAlign: 'left',
  },
  messageTimeOtherDark: {
    color: '#666666',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  inputContainerDark: {
    borderTopColor: '#2A2A2A',
    backgroundColor: '#0A0A0A',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000000',
    marginRight: 8,
    maxHeight: 100,
  },
  inputDark: {
    borderColor: '#2A2A2A',
    backgroundColor: '#1A1A1A',
    color: '#FFFFFF',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonIcon: {
    fontSize: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999999',
  },
  emptyTextDark: {
    color: '#666666',
  },
});

export const ModernChatRoom: React.FC<ChatRoomProps> = ({
  participantName,
  participantAvatar,
  isOnline,
  productName,
  productImage,
  messages,
  currentUserId,
  isDarkMode,
  isLoading,
  onSendMessage,
  onBack,
}) => {
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    const textToSend = messageText;
    setMessageText('');
    setIsSending(true);

    try {
      await onSendMessage(textToSend);
    } catch (error) {
      setMessageText(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === currentUserId;

    return (
      <View
        style={[
          styles.messageBubble,
          isOwnMessage ? styles.messageBubbleOwn : styles.messageBubbleOther,
        ]}
      >
        <View
          style={[
            styles.messageBubbleContent,
            isOwnMessage
              ? styles.messageBubbleContentOwn
              : [
                  styles.messageBubbleContentOther,
                  isDarkMode && styles.messageBubbleContentOtherDark,
                ],
          ]}
        >
          <Text
            style={[
              styles.messageText,
              !isOwnMessage && [
                styles.messageTextOther,
                isDarkMode && styles.messageTextOtherDark,
              ],
            ]}
          >
            {item.content}
          </Text>
        </View>
        <Text
          style={[
            styles.messageTime,
            !isOwnMessage && styles.messageTimeOther,
            isDarkMode && !isOwnMessage && styles.messageTimeOtherDark,
          ]}
        >
          {item.timestamp}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, isDarkMode && styles.containerDark]}
    >
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>

        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, isDarkMode && styles.avatarDark]}>
            <Text style={styles.avatarText}>
              {participantName.charAt(0).toUpperCase()}
            </Text>
          </View>
          {isOnline && (
            <View
              style={[
                styles.onlineIndicator,
                isDarkMode && styles.onlineIndicatorDark,
              ]}
            />
          )}
        </View>

        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>
            {participantName}
          </Text>
          <Text style={[styles.headerSubtitle, isDarkMode && styles.headerSubtitle]}>
            {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
          </Text>
          <Text style={[styles.productBadge, isDarkMode && styles.productBadgeDark]}>
            🛍️ {productName}
          </Text>
        </View>
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>
            Henüz mesaj yok. Sohbeti başlatın! 💬
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          removeClippedSubviews={true}
        />
      )}

      <View style={[styles.inputContainer, isDarkMode && styles.inputContainerDark]}>
        <TextInput
          style={[styles.input, isDarkMode && styles.inputDark]}
          placeholder="Mesaj yazın..."
          placeholderTextColor={isDarkMode ? '#666666' : '#999999'}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          editable={!isSending}
        />
        <TouchableOpacity
          style={[styles.sendButton, (isSending || !messageText.trim()) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={isSending || !messageText.trim()}
        >
          <Text style={styles.sendButtonIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};
