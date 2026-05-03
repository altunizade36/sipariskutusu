import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type MascotVariant = 'welcome' | 'loading' | 'order' | 'success';

export type BoxMascotProps = {
  variant: MascotVariant;
  size?: number;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
};

const welcomeImg = require('../../assets/mascot/box-welcome.png');
const loadingImg = require('../../assets/mascot/box-loading.png');
const orderImg = require('../../assets/mascot/box-order.png');
const successImg = require('../../assets/mascot/box-success.png');

const mascotImages = {
  welcome: welcomeImg,
  loading: loadingImg,
  order: orderImg,
  success: successImg,
} as const;

export default function BoxMascot({
  variant,
  size = 180,
  animated = true,
  style,
}: BoxMascotProps) {
  const bounce = useRef(new Animated.Value(0)).current;
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [variant]);

  useEffect(() => {
    if (!animated) {
      bounce.stopAnimation();
      bounce.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1,
          duration: 900,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 900,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );

    loop.start();

    return () => loop.stop();
  }, [animated, bounce]);

  const translateY = bounce.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const scale = bounce.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
  });

  const imageSource = mascotImages[variant];
  const fallbackFontSize = Math.max(22, Math.round(size * 0.2));

  return (
    <Animated.View
      style={[
        styles.wrapper,
        style,
        {
          width: size,
          height: size,
          transform: animated && Platform.OS !== 'web'
            ? [{ translateY }, { scale }]
            : [{ scale: 1 }],
        },
      ]}
    >
      {hasImageError ? (
        <View
          style={[
            styles.fallbackCircle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        >
          <View
            style={[
              styles.fallbackInner,
              {
                width: size * 0.72,
                height: size * 0.72,
                borderRadius: size * 0.18,
              },
            ]}
          >
            <Text style={[styles.fallbackText, { fontSize: fallbackFontSize }]}>BO</Text>
          </View>
        </View>
      ) : (
        <Image
          source={imageSource}
          style={{ width: size, height: size }}
          resizeMode="contain"
          onError={() => setHasImageError(true)}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF1FF',
  },
  fallbackInner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A66FF',
    shadowColor: '#0A66FF',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  fallbackText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
