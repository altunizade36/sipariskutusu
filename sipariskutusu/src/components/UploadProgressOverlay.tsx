import { View, Text, Modal, ActivityIndicator } from 'react-native';
import { colors, fonts } from '../constants/theme';
import BoxMascot from './BoxMascot';

interface UploadProgressOverlayProps {
  visible: boolean;
  progress: number;
  message: string;
  error?: string | null;
}

export function UploadProgressOverlay({
  visible,
  progress,
  message,
  error,
}: UploadProgressOverlayProps) {
  if (!visible) return null;

  const mascotVariant = error ? 'loading' : progress >= 100 ? 'success' : progress > 0 ? 'order' : 'loading';

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View className="flex-1 bg-black/50 justify-center items-center">
        <View className="bg-white rounded-xl p-6 w-80 shadow-lg">
          {/* Icon/Loader */}
          <View className="items-center mb-4">
            {error ? (
              <Text className="text-4xl mb-2">⚠️</Text>
            ) : (
              <>
                <BoxMascot variant={mascotVariant} size={132} animated={mascotVariant !== 'success'} />
                {mascotVariant !== 'success' ? <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 10 }} /> : null}
              </>
            )}
          </View>

          {/* Message */}
          <Text
            className="text-center text-base font-semibold mb-4"
            style={{ color: colors.textPrimary }}
          >
            {error || message}
          </Text>

          {/* Progress Bar */}
          {!error && progress > 0 && (
            <View className="mb-4">
              <View
                className="h-2 bg-gray-200 rounded-full overflow-hidden"
                style={{ width: '100%' }}
              >
                <View
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </View>
              <Text
                className="text-xs text-center mt-2"
                style={{ color: colors.textSecondary }}
              >
                {Math.round(progress)}%
              </Text>
            </View>
          )}

          {/* Error message details */}
          {error && (
            <Text
              className="text-xs text-center"
              style={{ color: colors.textSecondary }}
            >
              Lütfen tekrar deneyin
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}
