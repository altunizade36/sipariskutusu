import React from 'react';
import { Pressable, Text, View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface ChatHeaderProps {
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  onBack?: () => void;
  onInfo?: () => void;
}

/**
 * Instagram tarzı sohbet başlığı.
 * Online noktası, avatar ve tema-uyumlu renkler.
 */
export function ChatHeader({ title, subtitle, avatarUrl, isOnline, onBack, onInfo }: ChatHeaderProps) {
  const { colors, isDark } = useTheme();

  const initials = title
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'BO';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
      }}
    >
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          accessibilityLabel="Geri"
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
      ) : null}

      <View style={{ position: 'relative', marginRight: 12 }}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.borderLight,
            }}
          />
        ) : (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: isDark ? '#1E40AF' : '#DBEAFE',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: 'Cairo_700Bold',
                fontSize: 14,
                color: isDark ? '#BFDBFE' : '#1E5FC6',
              }}
            >
              {initials}
            </Text>
          </View>
        )}
        {isOnline ? (
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: colors.success,
              borderWidth: 2,
              borderColor: colors.surface,
            }}
          />
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: 'Cairo_700Bold',
            fontSize: 15,
            color: colors.textPrimary,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: 'Roboto_400Regular',
              fontSize: 11,
              color: isOnline ? colors.success : colors.textSecondary,
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {onInfo ? (
        <Pressable
          onPress={onInfo}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          accessibilityLabel="Sohbet bilgisi"
        >
          <Ionicons name="information-circle-outline" size={22} color={colors.textPrimary} />
        </Pressable>
      ) : null}
    </View>
  );
}
