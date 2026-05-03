import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../constants/theme';

type Props = {
  size?: 'full' | 'card' | 'thumb';
  style?: object;
};

export function ProductImagePlaceholder({ size = 'card', style }: Props) {
  const isCard = size === 'card';
  const isFull = size === 'full';
  const isThumb = size === 'thumb';

  const iconSize = isFull ? 48 : isCard ? 28 : 16;
  const fontSize = isFull ? 18 : isCard ? 12 : 8;
  const gap = isFull ? 12 : isCard ? 7 : 4;

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: '#F1F5F9',
          alignItems: 'center',
          justifyContent: 'center',
          gap,
        },
        style,
      ]}
    >
      <View
        style={{
          transform: [{ rotate: '-10deg' }],
          alignItems: 'center',
          gap: isThumb ? 2 : 5,
          opacity: 0.35,
        }}
      >
        <Ionicons
          name="cube-outline"
          size={iconSize}
          color="#64748B"
        />
        {!isThumb && (
          <Text
            style={{
              fontFamily: fonts.headingBold,
              fontSize,
              color: '#64748B',
              textAlign: 'center',
              letterSpacing: 0.5,
            }}
          >
            Sipariş{'\n'}Kutusu
          </Text>
        )}
      </View>
    </View>
  );
}
