import { Animated, Platform, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { colors } from '../constants/theme';

interface ScrollToTopButtonProps {
  visible: boolean;
  onPress: () => void;
}

export function ScrollToTopButton({ visible, onPress }: ScrollToTopButtonProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visible, fadeAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        position: 'absolute',
        bottom: 20,
        right: 20,
        zIndex: 10,
      }}
    >
      <Pressable
        onPress={onPress}
        className="w-12 h-12 rounded-full bg-white items-center justify-center shadow-lg"
        style={{
          shadowColor: colors.textPrimary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <Ionicons name="chevron-up" size={24} color={colors.primary} />
      </Pressable>
    </Animated.View>
  );
}
