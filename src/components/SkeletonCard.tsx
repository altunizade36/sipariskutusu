import { View, Text } from 'react-native';
import { useMemo } from 'react';

type Props = {
  width?: number | string;
};

export default function SkeletonCard({ width = '100%' }: Props) {
  const animatedStyle = useMemo(
    () => ({
      animation: 'pulse 1.5s ease-in-out infinite',
    }),
    []
  );

  return (
    <View style={{ width: typeof width === 'number' ? width : undefined }} className="bg-white">
      {/* Image skeleton */}
      <View
        style={{ aspectRatio: 3 / 4 }}
        className="bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 relative overflow-hidden"
      >
        {/* Shimmer effect via opacity animation */}
        <View className="absolute inset-0 bg-white/40" />
      </View>

      {/* Title skeleton */}
      <View className="p-3 gap-2">
        <View className="h-4 bg-slate-200 rounded w-3/4" />
        <View className="h-4 bg-slate-200 rounded w-1/2" />

        {/* Bottom info skeleton */}
        <View className="flex-row justify-between items-center mt-2">
          <View className="h-5 bg-slate-200 rounded w-1/3" />
          <View className="w-6 h-6 bg-slate-200 rounded-full" />
        </View>
      </View>
    </View>
  );
}
