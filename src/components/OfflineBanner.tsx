import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../constants/theme';

interface OfflineBannerProps {
  onRetry?: () => void;
}

export function OfflineBanner({ onRetry }: OfflineBannerProps) {
  return (
    <View className="bg-red-50 border-b border-red-200 px-4 py-3 flex-row items-center justify-between">
      <View className="flex-row items-center gap-2 flex-1">
        <Ionicons name="cloud-offline-outline" size={16} color="#DC2626" />
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#DC2626' }}>
            İnternet Bağlantısı Yok
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: '#991B1B' }}>
            Lütfen bağlantınızı kontrol edin
          </Text>
        </View>
      </View>
      {onRetry && (
        <Pressable onPress={onRetry} className="ml-2">
          <Ionicons name="refresh" size={16} color="#DC2626" />
        </Pressable>
      )}
    </View>
  );
}
