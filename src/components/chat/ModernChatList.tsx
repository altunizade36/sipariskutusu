import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';

interface ChatConversation {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  productImage: string;
  participantId: string;
  participantName: string;
  participantAvatar: string;
  isOnline: boolean;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isSeller: boolean;
}

interface ModernChatListProps {
  conversations: ChatConversation[];
  currentUserId: string;
  isLoading: boolean;
  isDarkMode: boolean;
  onSelectChat: (conversationId: string) => void;
  onNewChat: () => void;
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerDark: {
    borderBottomColor: '#2A2A2A',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
  },
  headerTitleDark: {
    color: '#FFFFFF',
  },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  searchContainerDark: {
    backgroundColor: '#1A1A1A',
  },
  searchInput: {
    flex: 1,
    color: '#000000',
    fontSize: 14,
    marginLeft: 8,
    paddingVertical: 8,
  },
  searchInputDark: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingVertical: 8,
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  chatItemDark: {
    borderBottomColor: '#1A1A1A',
  },
  chatItemActive: {
    backgroundColor: '#F9FAFB',
  },
  chatItemActiveDark: {
    backgroundColor: '#1A1A1A',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarDark: {
    backgroundColor: '#2A2A2A',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  onlineIndicatorDark: {
    borderColor: '#0A0A0A',
  },
  chatContent: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  participantNameDark: {
    color: '#FFFFFF',
  },
  chatTime: {
    fontSize: 12,
    color: '#999999',
    marginLeft: 8,
  },
  chatTimeDark: {
    color: '#666666',
  },
  productTag: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  productTagDark: {
    backgroundColor: '#1E3A5F',
  },
  productTagText: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '500',
  },
  productTagTextDark: {
    color: '#93C5FD',
  },
  lastMessage: {
    fontSize: 13,
    color: '#666666',
  },
  lastMessageDark: {
    color: '#999999',
  },
  unreadBadge: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  emptyTextDark: {
    color: '#FFFFFF',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  emptySubtextDark: {
    color: '#999999',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 28,
    color: '#FFFFFF',
  },
});

export const ModernChatList: React.FC<ModernChatListProps> = ({
  conversations,
  currentUserId,
  isLoading,
  isDarkMode,
  onSelectChat,
  onNewChat,
}) => {
  const [searchText, setSearchText] = useState('');

  const filteredConversations = useMemo(() => {
    if (!searchText.trim()) return conversations;
    
    const query = searchText.toLowerCase();
    return conversations.filter(
      (conv) =>
        conv.participantName.toLowerCase().includes(query) ||
        conv.productName.toLowerCase().includes(query) ||
        conv.lastMessage.toLowerCase().includes(query)
    );
  }, [conversations, searchText]);

  const renderChatItem = ({ item }: { item: ChatConversation }) => (
    <TouchableOpacity
      style={[
        styles.chatItem,
        isDarkMode && styles.chatItemDark,
      ]}
      onPress={() => onSelectChat(item.id)}
      activeOpacity={0.6}
    >
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, isDarkMode && styles.avatarDark]}>
          <Text style={styles.avatarText}>
            {item.participantName.charAt(0).toUpperCase()}
          </Text>
        </View>
        {item.isOnline && (
          <View style={[styles.onlineIndicator, isDarkMode && styles.onlineIndicatorDark]} />
        )}
      </View>

      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text
            style={[styles.participantName, isDarkMode && styles.participantNameDark]}
            numberOfLines={1}
          >
            {item.participantName}
          </Text>
          <Text style={[styles.chatTime, isDarkMode && styles.chatTimeDark]}>
            {item.lastMessageTime}
          </Text>
        </View>

        <View style={[styles.productTag, isDarkMode && styles.productTagDark]}>
          <Text style={[styles.productTagText, isDarkMode && styles.productTagTextDark]}>
            🛍️ {item.productName}
          </Text>
        </View>

        <Text
          style={[styles.lastMessage, isDarkMode && styles.lastMessageDark]}
          numberOfLines={1}
        >
          {item.lastMessage}
        </Text>
      </View>

      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, isDarkMode && styles.containerDark]}>
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? '#3B82F6' : '#3B82F6'} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <View style={styles.headerTop}>
          <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>
            Mesajlar
          </Text>
          <TouchableOpacity style={styles.headerIcon} onPress={onNewChat}>
            <Text style={styles.headerIconText}>✉️</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchContainer, isDarkMode && styles.searchContainerDark]}>
          <Text style={styles.headerIconText}>🔍</Text>
          <TextInput
            style={[styles.searchInput, isDarkMode && styles.searchInputDark]}
            placeholder="Ara..."
            placeholderTextColor={isDarkMode ? '#666666' : '#999999'}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
      </View>

      {filteredConversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>
            {searchText ? 'Sohbet bulunamadı' : 'Henüz sohbet yok'}
          </Text>
          <Text style={[styles.emptySubtext, isDarkMode && styles.emptySubtextDark]}>
            {searchText
              ? 'Farklı bir arama terimi deneyin'
              : 'Yeni sohbet başlatmak için + tuşuna basın'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={onNewChat}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
};
