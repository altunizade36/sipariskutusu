import { ReactNode } from 'react';
import { ScrollView } from 'react-native';

type ChatListScreenProps = {
  children: ReactNode;
  refreshControl?: ReactNode;
};

export function ChatListScreen({ children, refreshControl }: ChatListScreenProps) {
  return (
    <ScrollView className="flex-1 px-3 pt-3" showsVerticalScrollIndicator={false} refreshControl={refreshControl as never}>
      {children}
    </ScrollView>
  );
}
