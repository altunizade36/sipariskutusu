import { View, Text, ScrollView, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { colors, fonts } from '../constants/theme';
import type { Story } from '../data/mockData';

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

  const AVATAR = 62;
  const ITEM_W = 76;
  const LABEL_SIZE = 11;

  const getBadgeMeta = (badge?: string) => {
    const normalized = badge?.trim().toLocaleLowerCase('tr-TR');
    if (normalized === 'canlı' || normalized === 'canli') return { label: '● CANLI', color: '#EF4444' };
    if (normalized === 'yeni') return { label: 'YENİ', color: colors.primary };
    return badge ? { label: badge, color: '#0F766E' } : null;
  };

  const handleStoryPress = (story: GroupedStory) => {
    if (story.isAdd) {
      if (onAddPress) { onAddPress(); } else { router.push('/share-story'); }
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

  // App blue gradient for unseen stories
  const GRADIENT_UNSEEN: [string, string, string] = ['#1E5FC6', '#3B82F6', '#60A5FA'];
  const GRADIENT_SEEN: [string, string] = ['#D1D5DB', '#9CA3AF'];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}
    >
      {groupedStories.map((s) => {
        const badgeMeta = getBadgeMeta(s.badge);
        const storyCount = Number(s.sellerStoryCount ?? 0);

        return (
          <Pressable
            key={s.id}
            style={{ width: ITEM_W, alignItems: 'center' }}
            onPress={() => handleStoryPress(s)}
          >
            {/* Avatar ring */}
            {s.isAdd ? (
              <View
                style={{
                  width: AVATAR + 6,
                  height: AVATAR + 6,
                  borderRadius: (AVATAR + 6) / 2,
                  borderWidth: 2,
                  borderColor: '#E5E7EB',
                  borderStyle: 'dashed',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#F9FAFB',
                }}
              >
                <View
                  style={{
                    width: AVATAR,
                    height: AVATAR,
                    borderRadius: AVATAR / 2,
                    backgroundColor: '#EEF4FF',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="add" size={28} color={colors.primary} />
                </View>
              </View>
            ) : (
              <View style={{ position: 'relative' }}>
              <LinearGradient
                colors={s.seen ? GRADIENT_SEEN : GRADIENT_UNSEEN}
                start={{ x: 0.15, y: 1 }}
                end={{ x: 0.85, y: 0 }}
                style={{
                  width: AVATAR + 6,
                  height: AVATAR + 6,
                  borderRadius: (AVATAR + 6) / 2,
                  padding: 2.5,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* White gap ring */}
                <View
                  style={{
                    width: AVATAR + 1,
                    height: AVATAR + 1,
                    borderRadius: (AVATAR + 1) / 2,
                    backgroundColor: '#fff',
                    padding: 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Image
                    source={{ uri: s.image }}
                    style={{ width: AVATAR - 3, height: AVATAR - 3, borderRadius: (AVATAR - 3) / 2 }}
                    resizeMode="cover"
                  />
                </View>
              </LinearGradient>
              {/* Fresh story indicator dot — green circle bottom-right */}
              {(() => {
                const isFresh = !s.seen && s.createdAt &&
                  (Date.now() - new Date(s.createdAt).getTime() < 2 * 60 * 60 * 1000);
                return isFresh ? (
                  <View style={{
                    position: 'absolute', bottom: 1, right: 1,
                    width: 13, height: 13, borderRadius: 6.5,
                    backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#fff',
                  }} />
                ) : null;
              })()}
              </View>
            )}

            {/* Badge pill */}
            {badgeMeta && !s.isAdd ? (
              <View
                style={{
                  marginTop: -9,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 20,
                  backgroundColor: badgeMeta.color,
                  borderWidth: 1.5,
                  borderColor: '#fff',
                  zIndex: 1,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.25,
                  shadowRadius: 2,
                  elevation: 3,
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 8, color: '#fff', letterSpacing: 0.4 }}>
                  {badgeMeta.label}
                </Text>
              </View>
            ) : null}

            {/* Seller name */}
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.medium,
                fontSize: LABEL_SIZE,
                color: s.seen ? '#9CA3AF' : '#111827',
                textAlign: 'center',
                marginTop: badgeMeta && !s.isAdd ? 4 : 7,
                maxWidth: ITEM_W,
              }}
            >
              {s.isAdd ? 'Hikaye ekle' : s.seller}
            </Text>

            {/* Price tag or story-count dots */}
            {!s.isAdd && s.priceTag ? (
              <Text
                numberOfLines={1}
                style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.primary, marginTop: 1 }}
              >
                {s.priceTag}
              </Text>
            ) : !s.isAdd && storyCount > 1 ? (
              <View style={{ flexDirection: 'row', gap: 3, marginTop: 4, alignItems: 'center' }}>
                {Array.from({ length: Math.min(storyCount, 3) }).map((_, di) => (
                  <View
                    key={di}
                    style={{
                      width: di === 0 ? 14 : 5,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: s.seen ? '#D1D5DB' : colors.primary,
                      opacity: di === 0 ? 1 : 0.55,
                    }}
                  />
                ))}
                {storyCount > 3 && (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 7, color: colors.primary }}>+</Text>
                )}
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
