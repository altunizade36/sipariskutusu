import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { colors, fonts } from '../constants/theme';

interface InfoBannerProps {
  icon?: string;
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
  dismissible?: boolean;
  variant?: 'info' | 'warning' | 'success';
}

export function InfoBanner({
  icon = 'information-circle',
  title,
  description,
  action,
  dismissible = false,
  variant = 'info',
}: InfoBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const variantStyles = {
    info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600' },
    success: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600' },
  };

  const style = variantStyles[variant];

  return (
    <View className={`${style.bg} ${style.border} border rounded-lg p-4 mx-4 mb-4 flex-row`}>
      <Ionicons name={icon as any} size={20} className={style.icon} style={{ marginRight: 12, color: colors.primary }} />
      <View className="flex-1">
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginBottom: 4 }}>
          {title}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: action ? 8 : 0 }}>
          {description}
        </Text>
        {action && (
          <Pressable onPress={action.onPress}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>
              {action.label} →
            </Text>
          </Pressable>
        )}
      </View>
      {dismissible && (
        <Pressable
          onPress={() => setDismissed(true)}
          className="ml-2 justify-start"
        >
          <Ionicons name="close" size={16} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}
