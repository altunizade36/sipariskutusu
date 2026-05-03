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

  const AVATAR = 68;
  const ITEM_W = 84;
  const LABEL_SIZE = 11;
  const RING_PAD = 3;

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

  const GRADIENT_UNSEEN: [string, string, string] = ['#4338CA', '#2563EB', '#38BDF8'];
  const GRADIENT_SEEN: [string, string] = ['#CBD5E1', '#94A3B8'];
  const GRADIENT_LIVE: [string, string, string] = ['#DC2626', '#EF4444', '#FB923C'];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 6, gap: 6 }}
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
              <LinearGradient
                colors={['#E0E7FF', '#DBEAFE', '#EDE9FE']}
                style={{
                  width: AVATAR + 8,
                  height: AVATAR + 8,
                  borderRadius: (AVATAR + 8) / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: colors.primary + '50',
                }}
              >
                <View
                  style={{
                    width: AVATAR + 2,
                    height: AVATAR + 2,
                    borderRadius: (AVATAR + 2) / 2,
                    backgroundColor: '#F0F5FF',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <LinearGradient
                    colors={['#1E5FC6', '#3B82F6']}
                    style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="add" size={22} color="#fff" />
                  </LinearGradient>
                </View>
              </LinearGradient>
            ) : (
              <View style={{ position: 'relative' }}>
              <LinearGradient
                colors={getBadgeMeta(s.badge)?.label?.includes('CANLI') ? GRADIENT_LIVE : s.seen ? GRADIENT_SEEN : GRADIENT_UNSEEN}
                start={{ x: 0.15, y: 1 }}
                end={{ x: 0.85, y: 0 }}
                style={{
                  width: AVATAR + 8,
                  height: AVATAR + 8,
                  borderRadius: (AVATAR + 8) / 2,
                  padding: RING_PAD,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* White gap ring */}
                <View
                  style={{
                    width: AVATAR + 2,
                    height: AVATAR + 2,
                    borderRadius: (AVATAR + 2) / 2,
                    backgroundColor: '#fff',
                    padding: 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Image
                    source={{ uri: s.image }}
                    style={{ width: AVATAR - 2, height: AVATAR - 2, borderRadius: (AVATAR - 2) / 2 }}
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
                    position: 'absolute', bottom: 2, right: 2,
                    width: 14, height: 14, borderRadius: 7,
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
                  marginTop: -10,
                  paddingHorizontal: 7,
                  paddingVertical: 2.5,
                  borderRadius: 20,
                  backgroundColor: badgeMeta.color,
                  borderWidth: 1.5,
                  borderColor: '#fff',
                  zIndex: 1,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 5,
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 8, color: '#fff', letterSpacing: 0.5 }}>
                  {badgeMeta.label}
                </Text>
              </View>
            ) : null}

            {/* Seller name */}
            <Text
              numberOfLines={1}
              style={{
                fontFamily: s.seen ? fonts.regular : fonts.medium,
                fontSize: LABEL_SIZE,
                color: s.seen ? '#94A3B8' : '#0F172A',
                textAlign: 'center',
                marginTop: badgeMeta && !s.isAdd ? 5 : 8,
                maxWidth: ITEM_W - 4,
              }}
            >
              {s.isAdd ? 'Hikaye ekle' : s.seller}
            </Text>

            {/* Price tag or story-count dots */}
            {!s.isAdd && s.priceTag ? (
              <View style={{ marginTop: 3, backgroundColor: colors.primary + '15', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.primary }}
                >
                  {s.priceTag}
                </Text>
              </View>
            ) : !s.isAdd && storyCount > 1 ? (
              <View style={{ flexDirection: 'row', gap: 3, marginTop: 5, alignItems: 'center' }}>
                {Array.from({ length: Math.min(storyCount, 4) }).map((_, di) => (
                  <View
                    key={di}
                    style={{
                      width: di === 0 ? 16 : 4,
                      height: 3,
                      borderRadius: 1.5,
                      backgroundColor: s.seen ? '#CBD5E1' : (di === 0 ? colors.primary : colors.primary + '50'),
                    }}
                  />
                ))}
                {storyCount > 4 && (
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
