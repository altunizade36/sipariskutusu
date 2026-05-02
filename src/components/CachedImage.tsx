import { Image, ImageContentFit, ImageStyle } from 'expo-image';
import { useState } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  uri: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  /** Show this placeholder while loading. Defaults to a light gray box. */
  placeholderColor?: string;
  /** Icon size for error fallback. Defaults to 28. */
  fallbackIconSize?: number;
}

/**
 * Drop-in Image replacement with:
 * - Automatic disk + memory cache (expo-image)
 * - Fade-in transition
 * - Gray placeholder while loading
 * - Broken-image icon on error
 */
export default function CachedImage({
  uri,
  style,
  containerStyle,
  contentFit = 'cover',
  placeholderColor = '#E2E8F0',
  fallbackIconSize = 28,
}: Props) {
  const [error, setError] = useState(false);

  if (!uri || error) {
    return (
      <View style={[styles.fallback, { backgroundColor: placeholderColor }, containerStyle]}>
        <Ionicons name="image-outline" size={fallbackIconSize} color="#94A3B8" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      transition={200}
      cachePolicy="disk"
      onError={() => setError(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
