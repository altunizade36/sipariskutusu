import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../constants/theme';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <View className="items-center mb-6">
        <View
          className="w-16 h-16 rounded-full items-center justify-center mb-4"
          style={{ backgroundColor: '#F3F4F6' }}
        >
          <Ionicons name={icon as any} size={32} color={colors.textSecondary} />
        </View>

        <Text
          style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, textAlign: 'center' }}
          className="mb-2"
        >
          {title}
        </Text>

        <Text
          style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }}
          className="max-w-xs"
        >
          {description}
        </Text>
      </View>

      {action && (
        <Pressable
          onPress={action.onPress}
          className="rounded-lg bg-blue-50 px-6 py-3 border border-blue-200"
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary, textAlign: 'center' }}>
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
