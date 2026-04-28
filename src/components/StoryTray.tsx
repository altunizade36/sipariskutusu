import { View, Text, ScrollView, Pressable, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { colors, fonts } from '../constants/theme';
import type { Story } from '../data/mockData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface StoryTrayProps {
  stories: Story[];
  onStoryPress?: (storyId: string, sellerKey?: string) => void;
  showAddButton?: boolean;
  onAddPress?: () => void;
  layout?: 'compact' | 'full';
  variant?: 'default' | 'commerce';
  autoGroupBySeller?: boolean;
}

type GroupedStory = Story & { sellerStoryCount?: number };

export function StoryTray({
  stories,
  onStoryPress,
  showAddButton = true,
  onAddPress,
  layout = 'full',
  variant = 'default',
  autoGroupBySeller = true,
}: StoryTrayProps) {
  const router = useRouter();
  const isCommerce = variant === 'commerce';

  const groupedStories = useMemo<GroupedStory[]>(() => {
    const addStory = stories.find((item) => item.isAdd);
    const sellerGroups = new Map<string, typeof stories>();

    stories
      .filter((item) => !item.isAdd)
      .forEach((item) => {
        if (!autoGroupBySeller) {
          return;
        }

        const sellerKey = (item.sellerKey || item.seller || item.id).trim();
        const current = sellerGroups.get(sellerKey) ?? [];
        sellerGroups.set(sellerKey, [...current, item]);
      });

    let sellerPreviews: GroupedStory[] = [];

    if (autoGroupBySeller && sellerGroups.size > 0) {
      sellerPreviews = Array.from(sellerGroups.entries()).map(([sellerKey, sellerStories]) => {
        const sorted = [...sellerStories].sort(
          (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
        );
        const latest = sorted[0];

        return {
          ...latest,
          sellerKey,
          sellerStoryCount: sorted.length,
        };
      });
    } else {
      sellerPreviews = stories.filter((item) => !item.isAdd);
    }

    // Sort by creation date (newest first)
    sellerPreviews.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

    return addStory && showAddButton ? [addStory, ...sellerPreviews] : sellerPreviews;
  }, [stories, showAddButton, autoGroupBySeller]);

  const containerSize = isCommerce ? 84 : layout === 'compact' ? 64 : 72;
  const itemWidth = isCommerce ? Math.min(104, Math.max(94, SCREEN_WIDTH / 4.1)) : containerSize + 8;
  const labelSize = isCommerce ? 11 : layout === 'compact' ? 9 : 10;
  const subtextSize = isCommerce ? 9 : layout === 'compact' ? 8 : 9;
  const imageInset = isCommerce ? 3 : 0;

  const getBadgeMeta = (badge?: string) => {
    const normalized = badge?.trim().toLocaleLowerCase('tr-TR');

    if (normalized === 'canlı' || normalized === 'canli') {
      return { label: 'CANLI', color: colors.danger };
    }

    if (normalized === 'yeni') {
      return { label: 'YENI', color: colors.primary };
    }

    return badge ? { label: badge, color: '#0F766E' } : null;
  };

  const handleStoryPress = (story: GroupedStory) => {
    if (story.isAdd) {
      if (onAddPress) {
        onAddPress();
      } else {
        router.push('/share-story');
      }
      return;
    }

    if (onStoryPress) {
      onStoryPress(story.id, story.sellerKey);
    } else {
      const storyIdParam = story.backendId ? encodeURIComponent(story.backendId) : encodeURIComponent(story.id);
      const sellerQuery = story.sellerKey ? `&sellerKey=${encodeURIComponent(story.sellerKey)}` : '';
      router.push(`/story-viewer?storyId=${storyIdParam}${sellerQuery}` as never);
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: isCommerce ? 14 : 12, gap: isCommerce ? 14 : 12, paddingBottom: isCommerce ? 2 : 0 }}
    >
      {groupedStories.map((s) => {
        const badgeMeta = getBadgeMeta(s.badge);
        const storyCount = Number(s.sellerStoryCount ?? 0);
        const hasProductInfo = Boolean(s.productTitle || s.priceTag);

        return (
          <Pressable
            key={s.id}
            className="items-center"
            style={{ width: itemWidth }}
            onPress={() => handleStoryPress(s)}
          >
            {s.isAdd ? (
            <View
              style={{
                backgroundColor: isCommerce ? '#EFF6FF' : '#F7F7F7',
                borderColor: isCommerce ? colors.primary : colors.borderLight,
                width: containerSize,
                height: containerSize,
              }}
              className="rounded-full items-center justify-center border-2 border-dashed"
            >
              <View
                className="rounded-full items-center justify-center"
                style={{ width: isCommerce ? 34 : 28, height: isCommerce ? 34 : 28, backgroundColor: '#fff' }}
              >
                <Ionicons name="add" size={layout === 'compact' ? 18 : 22} color={colors.primary} />
              </View>
            </View>
          ) : (
            <View className="relative">
              <View
                style={{
                  borderColor: s.seen ? colors.borderDefault : colors.primary,
                  borderWidth: isCommerce ? 2.5 : 2,
                  width: containerSize,
                  height: containerSize,
                  padding: imageInset,
                  backgroundColor: s.seen ? '#F7F7F7' : '#EFF6FF',
                }}
                className="rounded-full overflow-hidden"
              >
                <Image
                  source={{ uri: s.image }}
                  className="w-full h-full rounded-full"
                  resizeMode="cover"
                />
              </View>
              {badgeMeta ? (
                <View
                  className="absolute -bottom-1 self-center px-2 py-[2px] rounded-full"
                  style={{ backgroundColor: badgeMeta.color }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 8, color: '#fff' }}>
                    {badgeMeta.label}
                  </Text>
                </View>
              ) : null}
              {isCommerce && storyCount > 1 ? (
                <View
                  className="absolute -right-1 top-1 rounded-full items-center justify-center border border-white"
                  style={{ width: 22, height: 22, backgroundColor: colors.textPrimary }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#fff' }}>{storyCount}</Text>
                </View>
              ) : null}
            </View>
          )}
          <Text
            numberOfLines={isCommerce ? 2 : 1}
            style={{
              fontFamily: fonts.medium,
              fontSize: labelSize,
              color: colors.textPrimary,
              textAlign: 'center',
              marginTop: isCommerce ? 7 : 4,
              maxWidth: itemWidth,
              lineHeight: isCommerce ? 14 : undefined,
            }}
          >
            {s.seller}
          </Text>
          {isCommerce && !s.isAdd && hasProductInfo ? (
            <View className="items-center mt-1" style={{ maxWidth: itemWidth }}>
              {s.priceTag ? (
                <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.primary }}>
                  {s.priceTag}
                </Text>
              ) : null}
              {s.productTitle ? (
                <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 9, color: colors.textMuted, maxWidth: itemWidth }}>
                  {s.productTitle}
                </Text>
              ) : null}
            </View>
          ) : !s.isAdd && storyCount > 1 ? (
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: subtextSize,
                color: colors.textMuted,
                marginTop: 1,
              }}
            >
              {storyCount} hikaye
            </Text>
          ) : null}
          {isCommerce && s.isAdd ? (
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.regular, fontSize: subtextSize, color: colors.textMuted, marginTop: 1, maxWidth: itemWidth }}
            >
              ürün paylaş
            </Text>
          ) : null}
        </Pressable>
        );
      })}
    </ScrollView>
  );
}
