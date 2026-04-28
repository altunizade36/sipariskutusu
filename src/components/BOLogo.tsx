import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface BOLogoProps {
  size?: number;
  isDarkMode?: boolean;
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  background: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#3B82F6',
  },
  backgroundDark: {
    backgroundColor: '#2563EB',
  },
  text: {
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  glow: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3B82F6',
    opacity: 0.2,
  },
});

export function BOLogo({ size = 48, isDarkMode = false }: BOLogoProps) {
  const padding = size * 0.3;
  const innerSize = size - padding * 2;
  const glowSize = size + 8;
  const glowOffset = -4;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View
        style={[
          styles.glow,
          {
            width: glowSize,
            height: glowSize,
            left: glowOffset,
            top: glowOffset,
            borderColor: isDarkMode ? '#2563EB' : '#3B82F6',
          },
        ]}
      />
      <View
        style={[
          styles.background,
          isDarkMode && styles.backgroundDark,
          {
            width: innerSize,
            height: innerSize,
            padding: size * 0.12,
          },
        ]}
      >
        <Text
          style={[
            styles.text,
            {
              fontSize: size * 0.5,
            },
          ]}
        >
          BO
        </Text>
      </View>
    </View>
  );
}
