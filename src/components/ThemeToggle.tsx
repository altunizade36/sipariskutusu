import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  variant?: 'icon' | 'pill' | 'segmented';
  label?: string;
}

/**
 * Karanlık mod geçiş bileşeni.
 * - icon:       sadece ikon (header için ideal)
 * - pill:       ikon + etiketli pill
 * - segmented:  açık / sistem / karanlık üçlü seçici
 */
export function ThemeToggle({ variant = 'icon', label }: ThemeToggleProps) {
  const { mode, activeTheme, colors, setMode, toggleTheme } = useTheme();
  const isDark = activeTheme === 'dark';

  if (variant === 'segmented') {
    const options: Array<{ id: 'light' | 'system' | 'dark'; icon: keyof typeof Ionicons.glyphMap; label: string }> = [
      { id: 'light', icon: 'sunny', label: 'Açık' },
      { id: 'system', icon: 'phone-portrait', label: 'Sistem' },
      { id: 'dark', icon: 'moon', label: 'Karanlık' },
    ];

    return (
      <View
        style={{
          flexDirection: 'row',
          padding: 4,
          borderRadius: 14,
          backgroundColor: colors.borderLight,
          gap: 4,
        }}
      >
        {options.map((opt) => {
          const active = mode === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => setMode(opt.id)}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: active ? colors.surface : 'transparent',
                gap: 6,
                shadowColor: '#000',
                shadowOpacity: active ? 0.08 : 0,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 },
                elevation: active ? 2 : 0,
              }}
            >
              <Ionicons
                name={opt.icon}
                size={15}
                color={active ? colors.primary : colors.textSecondary}
              />
              <Text
                style={{
                  fontFamily: 'Roboto_500Medium',
                  fontSize: 12,
                  color: active ? colors.primary : colors.textSecondary,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (variant === 'pill') {
    return (
      <Pressable
        onPress={toggleTheme}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.borderDefault,
          backgroundColor: colors.surface,
        }}
      >
        <Ionicons
          name={isDark ? 'moon' : 'sunny'}
          size={16}
          color={colors.primary}
        />
        <Text style={{ fontFamily: 'Roboto_500Medium', fontSize: 12, color: colors.textPrimary }}>
          {label ?? (isDark ? 'Karanlık' : 'Açık')}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={toggleTheme}
      accessibilityRole="button"
      accessibilityLabel="Temayı değiştir"
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? 'rgba(96,165,250,0.14)' : 'rgba(30,95,198,0.10)',
      }}
    >
      <Ionicons
        name={isDark ? 'moon' : 'sunny'}
        size={20}
        color={colors.primary}
      />
    </Pressable>
  );
}
