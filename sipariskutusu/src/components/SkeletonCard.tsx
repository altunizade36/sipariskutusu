import { View, Animated, Platform, StyleSheet } from 'react-native';
import { useEffect, useRef } from 'react';

type Props = {
  width?: number | string;
};

export default function SkeletonCard({ width = '100%' }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });

  return (
    <View style={[styles.card, { width: typeof width === 'number' ? width : undefined }]}>
      {/* Image placeholder */}
      <Animated.View style={[styles.imagePlaceholder, { opacity }]} />

      {/* Info */}
      <View style={styles.info}>
        <Animated.View style={[styles.bone, { height: 9, width: '45%', borderRadius: 4, opacity }]} />
        <Animated.View style={[styles.bone, { height: 11, width: '92%', marginTop: 7, opacity }]} />
        <Animated.View style={[styles.bone, { height: 11, width: '68%', marginTop: 7, opacity }]} />
        <Animated.View style={[styles.bone, { height: 9, width: '55%', marginTop: 9, borderRadius: 4, opacity }]} />
        <View style={styles.priceRow}>
          <Animated.View style={[styles.bone, { height: 16, width: '38%', opacity }]} />
          <Animated.View style={[styles.bone, { height: 28, width: 28, borderRadius: 14, opacity }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', overflow: 'hidden' },
  imagePlaceholder: { aspectRatio: 3 / 4, backgroundColor: '#DDE3ED' },
  info: { padding: 10 },
  bone: { backgroundColor: '#DDE3ED', borderRadius: 6 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
});
