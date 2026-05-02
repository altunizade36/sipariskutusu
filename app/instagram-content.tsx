import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Image, ActivityIndicator,
  RefreshControl, FlatList, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import {
  fetchInstagramPosts,
  fetchInstagramReels,
  fetchInstagramStories,
  formatIgCount,
  statusLabel,
  statusColor,
  type InstagramPost,
  type InstagramReel,
  type InstagramStory,
} from '../src/services/instagramService';
import { useAuth } from '../src/context/AuthContext';
import { submitListingToSupabase } from '../src/services/listingService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_ITEM = (SCREEN_WIDTH - 32 - 8) / 2;

type ContentTab = 'posts' | 'reels' | 'stories';

export default function InstagramContentScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<ContentTab>('posts');
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [reels, setReels] = useState<InstagramReel[]>([]);
  const [stories, setStories] = useState<InstagramStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [publishingBulk, setPublishingBulk] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [p, r, s] = await Promise.all([
        fetchInstagramPosts(),
        fetchInstagramReels(),
        fetchInstagramStories(),
      ]);
      setPosts(p);
      setReels(r);
      setStories(s);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  async function onRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openQuickPublish(post: InstagramPost) {
    router.push({
      pathname: '/instagram-quick-publish',
      params: {
        postId: post.id,
        mediaUrl: post.mediaUrl,
        caption: post.caption,
        draft: JSON.stringify(post.parsedDraft),
      },
    } as never);
  }

  async function convertToStory(post: InstagramPost) {
    router.push({
      pathname: '/share-story',
      params: { imageUrl: post.mediaUrl, caption: post.caption },
    } as never);
  }

  async function handleBulkPublish() {
    const readyPosts = posts.filter(
      (p) => selectedIds.has(p.id) && p.parsedDraft && p.parsedDraft.missingFields.length === 0
    );
    if (readyPosts.length === 0) {
      return;
    }
    setPublishingBulk(true);
    let published = 0;
    for (const p of readyPosts) {
      try {
        const d = p.parsedDraft!;
        await submitListingToSupabase({
          userId: user?.id ?? '',
          title: d.title,
          description: d.description,
          price: d.price ?? 0,
          categoryId: d.categoryId ?? '',
          subCategoryId: d.subCategoryId ?? '',
          customSubCategory: '',
          condition: 'Yeni',
          sizeVariants: d.sizes,
          colorVariants: d.colors,
          city: d.city ?? '',
          district: '',
          neighborhood: '',
          delivery: [d.deliveryType ?? 'Kargo'],
          freeShipping: false,
          bargaining: false,
          coverIndex: 0,
          photos: [p.mediaUrl],
          source: 'instagram',
        } as any);
        published++;
      } catch {}
    }
    setPublishingBulk(false);
    setBulkMode(false);
    setSelectedIds(new Set());
    alert(`${published} ilan başarıyla yayınlandı.`);
  }

  const TABS: { id: ContentTab; label: string; icon: string }[] = [
    { id: 'posts', label: 'Gönderiler', icon: 'grid-outline' },
    { id: 'reels', label: 'Reels', icon: 'play-circle-outline' },
    { id: 'stories', label: 'Hikayeler', icon: 'ellipse-outline' },
  ];

  function renderPostItem(post: InstagramPost) {
    const draft = post.parsedDraft;
    const isSelected = selectedIds.has(post.id);

    return (
      <Pressable
        key={post.id}
        onLongPress={() => { setBulkMode(true); toggleSelect(post.id); }}
        onPress={() => bulkMode ? toggleSelect(post.id) : undefined}
        style={{ width: GRID_ITEM, backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderColor: isSelected ? colors.primary : '#33333310' }}
      >
        <View style={{ position: 'relative' }}>
          <Image source={{ uri: post.mediaUrl }} style={{ width: '100%', height: GRID_ITEM * 1.1 }} resizeMode="cover" />
          {post.mediaType === 'CAROUSEL_ALBUM' && (
            <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: 4 }}>
              <Ionicons name="copy-outline" size={14} color="#fff" />
            </View>
          )}
          {isSelected && (
            <View style={{ position: 'absolute', top: 8, left: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={14} color="#fff" />
            </View>
          )}
          <View style={{ position: 'absolute', bottom: 6, left: 6, backgroundColor: statusColor(post.status) + 'EE', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#fff' }}>{statusLabel(post.status)}</Text>
          </View>
        </View>

        <View style={{ padding: 10 }}>
          <Text numberOfLines={2} style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textPrimary, lineHeight: 15, marginBottom: 6 }}>
            {post.caption}
          </Text>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="heart-outline" size={11} color={colors.textMuted} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textMuted }}>{formatIgCount(post.likeCount)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="chatbubble-outline" size={11} color={colors.textMuted} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textMuted }}>{post.commentsCount}</Text>
            </View>
          </View>

          {draft && draft.missingFields.length > 0 && (
            <View style={{ backgroundColor: '#FFF5F5', borderRadius: 8, padding: 6, marginBottom: 6 }}>
              {draft.missingFields.map((f) => (
                <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.danger }} />
                  <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.danger }}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          {!bulkMode && post.status !== 'published' && (
            <View style={{ gap: 6 }}>
              <Pressable
                onPress={() => openQuickPublish(post)}
                style={{ backgroundColor: colors.primary, borderRadius: 10, padding: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}
              >
                <Ionicons name="storefront-outline" size={13} color="#fff" />
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>Ürüne Çevir</Text>
              </Pressable>
              <Pressable
                onPress={() => convertToStory(post)}
                style={{ backgroundColor: '#F3F4F6', borderRadius: 10, padding: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}
              >
                <Ionicons name="play-circle-outline" size={13} color={colors.textSecondary} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}>Hikayeye Çevir</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  function renderReelItem(reel: InstagramReel) {
    return (
      <View key={reel.id} style={{ backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#33333312', marginBottom: 12 }}>
        <View style={{ position: 'relative' }}>
          <Image source={{ uri: reel.thumbnailUrl }} style={{ width: '100%', height: 200 }} resizeMode="cover" />
          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="play" size={24} color="#fff" />
            </View>
          </View>
          <View style={{ position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
            <Ionicons name="eye-outline" size={12} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{formatIgCount(reel.viewCount)}</Text>
          </View>
        </View>

        <View style={{ padding: 14 }}>
          <Text numberOfLines={2} style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary, lineHeight: 18, marginBottom: 10 }}>
            {reel.caption}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="heart-outline" size={14} color={colors.textMuted} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted }}>{formatIgCount(reel.likeCount)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted }}>{reel.commentsCount}</Text>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, flex: 1, textAlign: 'right' }}>
              {new Date(reel.timestamp).toLocaleDateString('tr-TR')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => router.push({ pathname: '/share-story', params: { imageUrl: reel.thumbnailUrl, caption: reel.caption } } as never)}
              style={{ flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, padding: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
            >
              <Ionicons name="share-outline" size={15} color={colors.textSecondary} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>Hikayeye Çevir</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  function renderStoryItem(story: InstagramStory) {
    const hoursLeft = Math.max(0, Math.round((new Date(story.expiresAt).getTime() - Date.now()) / 3600000));
    return (
      <View key={story.id} style={{ width: 120, alignItems: 'center', marginRight: 12 }}>
        <View style={{ width: 90, height: 140, borderRadius: 18, overflow: 'hidden', borderWidth: 2.5, borderColor: '#E1306C', position: 'relative' }}>
          <Image source={{ uri: story.mediaUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          <View style={{ position: 'absolute', bottom: 6, left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="eye-outline" size={9} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#fff' }}>{story.viewCount}</Text>
            </View>
          </View>
        </View>
        <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.textSecondary, marginTop: 5, textAlign: 'center' }}>
          {hoursLeft}s kaldı
        </Text>
        <Pressable
          onPress={() => router.push({ pathname: '/share-story', params: { imageUrl: story.mediaUrl } } as never)}
          style={{ marginTop: 5, backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}
        >
          <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.primary }}>Paylaş</Text>
        </Pressable>
      </View>
    );
  }

  const readyBulkCount = [...selectedIds].filter((id) => {
    const p = posts.find((x) => x.id === id);
    return p?.parsedDraft && p.parsedDraft.missingFields.length === 0;
  }).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#33333315' }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 10 }}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary }}>Instagram İçerikleri</Text>
        </View>
        {!bulkMode ? (
          <Pressable
            onPress={() => setBulkMode(true)}
            style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#EFF6FF', borderRadius: 10 }}
          >
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>Çoklu Seç</Text>
          </Pressable>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => { setBulkMode(false); setSelectedIds(new Set()); }}
              style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F3F4F6', borderRadius: 10 }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>İptal</Text>
            </Pressable>
            {readyBulkCount > 0 && (
              <Pressable
                onPress={handleBulkPublish}
                disabled={publishingBulk}
                style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.primary, borderRadius: 10, flexDirection: 'row', gap: 5, alignItems: 'center' }}
              >
                {publishingBulk && <ActivityIndicator size="small" color="#fff" />}
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>
                  {readyBulkCount} İlanı Yayınla
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#33333315' }}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 10, backgroundColor: activeTab === tab.id ? '#EFF6FF' : 'transparent' }}
          >
            <Ionicons name={tab.icon as any} size={16} color={activeTab === tab.id ? colors.primary : colors.textSecondary} />
            <Text style={{ fontFamily: activeTab === tab.id ? fonts.bold : fonts.medium, fontSize: 12, color: activeTab === tab.id ? colors.primary : colors.textSecondary }}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 12 }}>İçerikler yükleniyor...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'posts' && (
            <>
              {posts.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                  <Ionicons name="images-outline" size={52} color="#D1D5DB" />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginTop: 14 }}>Gönderi yok</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {posts.map(renderPostItem)}
                </View>
              )}
            </>
          )}

          {activeTab === 'reels' && (
            <>
              {reels.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                  <Ionicons name="play-circle-outline" size={52} color="#D1D5DB" />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginTop: 14 }}>Reel yok</Text>
                </View>
              ) : reels.map(renderReelItem)}
            </>
          )}

          {activeTab === 'stories' && (
            <>
              {stories.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                  <Ionicons name="ellipse-outline" size={52} color="#D1D5DB" />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginTop: 14 }}>Aktif hikaye yok</Text>
                </View>
              ) : (
                <View>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginBottom: 14 }}>
                    Aktif Hikayeler ({stories.length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {stories.map(renderStoryItem)}
                  </ScrollView>
                  <View style={{ marginTop: 20, backgroundColor: '#EFF6FF', borderRadius: 16, padding: 14 }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.primary, textAlign: 'center' }}>
                      Hikayeleri mağazana eklemek için "Paylaş" butonuna bas.
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
