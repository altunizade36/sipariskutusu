import { View, Text, ScrollView, Pressable, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { colors, fonts } from '../constants/theme';
import type { Story } from '../data/mockData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface DynamicStoryTrayProps {
  stories: Story[];
  onStoryPress?: (storyId: string, sellerKey?: string) => void;
  showAddButton?: boolean;
  onAddPress?: () => void;
  layout?: 'compact' | 'full';
  autoGroupBySeller?: boolean;
}

type GroupedStory = Story & { sellerStoryCount?: number };

export function DynamicStoryTray({
  stories,
  onStoryPress,
  showAddButton = true,
  onAddPress,
  layout = 'full',
  autoGroupBySeller = true,
}: DynamicStoryTrayProps) {
  const router = useRouter();

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

  const containerSize = layout === 'compact' ? 64 : 72;
  const labelSize = layout === 'compact' ? 9 : 10;
  const subtextSize = layout === 'compact' ? 8 : 9;

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
      contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}
    >
      {groupedStories.map((s) => (
        <Pressable
          key={s.id}
          className="items-center"
          style={{ width: containerSize + 8 }}
          onPress={() => handleStoryPress(s)}
        >
          {s.isAdd ? (
            <View
              style={{
                backgroundColor: '#F7F7F7',
                borderColor: colors.borderLight,
                width: containerSize,
                height: containerSize,
              }}
              className="rounded-full items-center justify-center border-2 border-dashed"
            >
              <Ionicons name="add" size={layout === 'compact' ? 18 : 20} color={colors.primary} />
            </View>
          ) : (
            <View
              style={{
                borderColor: s.seen ? colors.borderDefault : colors.primary,
                borderWidth: 2,
                width: containerSize,
                height: containerSize,
              }}
              className="rounded-full overflow-hidden bg-[#F7F7F7]"
            >
              <Image
                source={{ uri: s.image }}
                className="w-full h-full"
                resizeMode="cover"
              />
            </View>
          )}
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.medium,
              fontSize: labelSize,
              color: colors.textPrimary,
              textAlign: 'center',
              marginTop: 4,
              maxWidth: containerSize + 8,
            }}
          >
            {s.seller}
          </Text>
          {!s.isAdd && Number(s.sellerStoryCount ?? 0) > 1 ? (
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: subtextSize,
                color: colors.textMuted,
                marginTop: 1,
              }}
            >
              {Number(s.sellerStoryCount ?? 0)} hikaye
            </Text>
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}
