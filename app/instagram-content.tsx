import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, Image, ActivityIndicator,
  RefreshControl, FlatList, Dimensions, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import {
  fetchInstagramPosts,
  fetchInstagramReels,
  fetchInstagramStories,
  getContentStatusMap,
  setContentStatus,
  syncInstagramContent,
  formatIgCount,
  statusLabel,
  statusColor,
  type InstagramPost,
  type InstagramReel,
  type InstagramStory,
  type ContentStatusMap,
} from '../src/services/instagramService';
import { useAuth } from '../src/context/AuthContext';
import { submitListingToSupabase } from '../src/services/listingService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 8;
const GRID_COLS = 2;
const GRID_ITEM = (SCREEN_WIDTH - 32 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

type ContentTab = 'posts' | 'reels' | 'stories';
type FilterType = 'all' | 'converted' | 'drafts' | 'missing' | 'hidden';

const FILTER_TABS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'converted', label: 'Ürüne Çevrilenler' },
  { id: 'drafts', label: 'Taslaklar' },
  { id: 'missing', label: 'Eksik Bilgili' },
  { id: 'hidden', label: 'Gizlenenler' },
];

function AutoBadge({ label }: { label: string }) {
  return (
    <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, marginLeft: 4 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 8, color: colors.primary }}>TAHMİN</Text>
    </View>
  );
}

export default function InstagramContentScreen() {
  const router = useRouter();
  const { user, isDarkMode } = useAuth();

  const [activeTab, setActiveTab] = useState<ContentTab>('posts');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [reels, setReels] = useState<InstagramReel[]>([]);
  const [stories, setStories] = useState<InstagramStory[]>([]);
  const [statusMap, setStatusMap] = useState<ContentStatusMap>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [publishingBulk, setPublishingBulk] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const pal = {
    bg: isDarkMode ? '#0F172A' : '#F8FAFC',
    card: isDarkMode ? '#111827' : '#FFFFFF',
    border: isDarkMode ? '#334155' : '#E5E7EB',
    tabBg: isDarkMode ? '#111827' : '#FFFFFF',
    tabBorder: isDarkMode ? '#1E293B' : '#33333315',
    tabActive: isDarkMode ? '#1E3A8A' : '#EFF6FF',
    textPrimary: isDarkMode ? '#E5E7EB' : '#1E293B',
    textSecondary: isDarkMode ? '#94A3B8' : '#64748B',
    textMuted: isDarkMode ? '#64748B' : '#9CA3AF',
    filterActive: isDarkMode ? '#1E3A8A' : '#DBEAFE',
    filterActiveTx: isDarkMode ? '#93C5FD' : '#1E40AF',
    filterBg: isDarkMode ? '#1F2937' : '#F3F4F6',
    filterTx: isDarkMode ? '#9CA3AF' : '#6B7280',
    actionBg: isDarkMode ? '#1F2937' : '#F3F4F6',
    hiddenOverlay: 'rgba(15,23,42,0.7)',
    headerBg: isDarkMode ? '#111827' : '#FFFFFF',
  };

  const loadAll = useCallback(async () => {
    const [p, r, s, sm] = await Promise.all([
      fetchInstagramPosts(),
      fetchInstagramReels(),
      fetchInstagramStories(),
      getContentStatusMap(),
    ]);
    setPosts(p);
    setReels(r);
    setStories(s);
    setStatusMap(sm);
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

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncInstagramContent();
      await loadAll();
    } catch {
      Alert.alert('Hata', 'Senkronizasyon başarısız oldu.');
    } finally {
      setSyncing(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleHidePost(postId: string) {
    const current = statusMap[postId];
    const nextHidden = !(current?.isHidden);
    await setContentStatus(postId, { isHidden: nextHidden });
    setStatusMap((prev) => ({
      ...prev,
      [postId]: { isHidden: nextHidden, convertedProductId: prev[postId]?.convertedProductId ?? null, isDeleted: false },
    }));
  }

  async function handleRemoveFromApp(postId: string) {
    Alert.alert(
      'Uygulamadan Kaldır',
      'Bu içerik listeden kaldırılacak. Orijinal Instagram gönderisi silinmez.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kaldır', style: 'destructive',
          onPress: async () => {
            await setContentStatus(postId, { isDeleted: true });
            setStatusMap((prev) => ({
              ...prev,
              [postId]: { ...(prev[postId] ?? { isHidden: false, convertedProductId: null }), isDeleted: true },
            }));
          },
        },
      ]
    );
  }

  async function handleBulkHide() {
    for (const id of selectedIds) {
      await setContentStatus(id, { isHidden: true });
    }
    setStatusMap(await getContentStatusMap());
    setBulkMode(false);
    setSelectedIds(new Set());
  }

  async function handleBulkRemove() {
    Alert.alert('Toplu Kaldır', `${selectedIds.size} içerik uygulamadan kaldırılacak.`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Kaldır', style: 'destructive',
        onPress: async () => {
          for (const id of selectedIds) {
            await setContentStatus(id, { isDeleted: true });
          }
          setStatusMap(await getContentStatusMap());
          setBulkMode(false);
          setSelectedIds(new Set());
        },
      },
    ]);
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

  function convertToStory(post: InstagramPost) {
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
      Alert.alert('Uyarı', 'Yayınlanmaya hazır içerik bulunamadı. Önce eksik bilgileri tamamlayın.');
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
        await setContentStatus(p.id, { convertedProductId: `listing_${Date.now()}` });
        published++;
      } catch {}
    }
    setStatusMap(await getContentStatusMap());
    setPublishingBulk(false);
    setBulkMode(false);
    setSelectedIds(new Set());
    Alert.alert('Tamamlandı', `${published} ilan başarıyla yayınlandı.`);
  }

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      const st = statusMap[p.id];
      if (st?.isDeleted) return false;
      if (activeFilter === 'hidden') return st?.isHidden ?? false;
      if (st?.isHidden) return false;
      if (activeFilter === 'converted') return !!st?.convertedProductId || p.status === 'published';
      if (activeFilter === 'drafts') return p.status === 'auto_draft' || p.status === 'needs_review';
      if (activeFilter === 'missing') return (p.parsedDraft?.missingFields?.length ?? 0) > 0;
      return true;
    });
  }, [posts, statusMap, activeFilter]);

  const TABS: { id: ContentTab; label: string; icon: string; count?: number }[] = [
    { id: 'posts', label: 'Gönderiler', icon: 'grid-outline', count: filteredPosts.length },
    { id: 'reels', label: 'Reels', icon: 'play-circle-outline', count: reels.length },
    { id: 'stories', label: 'Hikayeler', icon: 'ellipse-outline', count: stories.length },
  ];

  function renderPostCard({ item: post }: { item: InstagramPost }) {
    const draft = post.parsedDraft;
    const isSelected = selectedIds.has(post.id);
    const st = statusMap[post.id];
    const isHidden = st?.isHidden ?? false;
    const isConverted = !!(st?.convertedProductId) || post.status === 'published';

    return (
      <Pressable
        onLongPress={() => { setBulkMode(true); toggleSelect(post.id); }}
        onPress={() => bulkMode ? toggleSelect(post.id) : undefined}
        style={{
          width: GRID_ITEM,
          backgroundColor: pal.card,
          borderRadius: 18,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: isSelected ? colors.primary : isHidden ? '#6B7280' : pal.border,
          opacity: isHidden ? 0.7 : 1,
        }}
      >
        <View style={{ position: 'relative' }}>
          <Image source={{ uri: post.mediaUrl }} style={{ width: '100%', height: GRID_ITEM }} resizeMode="cover" />
          {isHidden && (
            <View style={{ position: 'absolute', inset: 0, backgroundColor: pal.hiddenOverlay, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="eye-off-outline" size={28} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff', marginTop: 4 }}>Gizlendi</Text>
            </View>
          )}
          {post.mediaType === 'CAROUSEL_ALBUM' && !isHidden && (
            <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: 3 }}>
              <Ionicons name="copy-outline" size={12} color="#fff" />
            </View>
          )}
          {isSelected && (
            <View style={{ position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={13} color="#fff" />
            </View>
          )}
          {isConverted && !isHidden && (
            <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: '#16A34A', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 8, color: '#fff' }}>YAYINDA</Text>
            </View>
          )}
          {!isConverted && !isHidden && (
            <View style={{ position: 'absolute', bottom: 6, left: 6, backgroundColor: statusColor(post.status) + 'EE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 8, color: '#fff' }}>{statusLabel(post.status)}</Text>
            </View>
          )}
        </View>

        <View style={{ padding: 9 }}>
          <Text numberOfLines={2} style={{ fontFamily: fonts.medium, fontSize: 11, color: pal.textPrimary, lineHeight: 15, marginBottom: 6 }}>
            {post.caption}
          </Text>

          {draft && (
            <View style={{ gap: 3, marginBottom: 6 }}>
              {draft.price !== null && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#16A34A' }}>₺{draft.price}</Text>
                  {draft.autoFields?.includes('price') && <AutoBadge label="fiyat" />}
                </View>
              )}
              {draft.categoryName && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: pal.textMuted }}>{draft.categoryName}</Text>
                  {draft.autoFields?.includes('category') && <AutoBadge label="kategori" />}
                </View>
              )}
            </View>
          )}

          {draft && draft.missingFields.length > 0 && (
            <View style={{ backgroundColor: isDarkMode ? '#450A0A' : '#FFF5F5', borderRadius: 6, padding: 5, marginBottom: 6 }}>
              {draft.missingFields.slice(0, 2).map((f) => (
                <Text key={f} style={{ fontFamily: fonts.regular, fontSize: 9, color: colors.danger }}>• {f}</Text>
              ))}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 7 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="heart-outline" size={10} color={pal.textMuted} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 9, color: pal.textMuted }}>{formatIgCount(post.likeCount)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="chatbubble-outline" size={10} color={pal.textMuted} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 9, color: pal.textMuted }}>{post.commentsCount}</Text>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 9, color: pal.textMuted, flex: 1, textAlign: 'right' }}>
              {new Date(post.timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
            </Text>
          </View>

          {!bulkMode && !isConverted && !isHidden && (
            <View style={{ gap: 5 }}>
              <Pressable
                onPress={() => openQuickPublish(post)}
                style={{ backgroundColor: colors.primary, borderRadius: 8, padding: 7, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 }}
              >
                <Ionicons name="storefront-outline" size={12} color="#fff" />
                <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>Ürüne Çevir</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <Pressable
                  onPress={() => convertToStory(post)}
                  style={{ flex: 1, backgroundColor: pal.actionBg, borderRadius: 8, padding: 6, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 3 }}
                >
                  <Ionicons name="play-circle-outline" size={11} color={pal.textSecondary} />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 9, color: pal.textSecondary }}>Hikaye</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleHidePost(post.id)}
                  style={{ flex: 1, backgroundColor: pal.actionBg, borderRadius: 8, padding: 6, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 3 }}
                >
                  <Ionicons name="eye-off-outline" size={11} color={pal.textSecondary} />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 9, color: pal.textSecondary }}>Gizle</Text>
                </Pressable>
              </View>
            </View>
          )}

          {!bulkMode && isHidden && (
            <Pressable
              onPress={() => handleHidePost(post.id)}
              style={{ backgroundColor: pal.actionBg, borderRadius: 8, padding: 7, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 }}
            >
              <Ionicons name="eye-outline" size={12} color={pal.textSecondary} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: pal.textSecondary }}>Tekrar Göster</Text>
            </Pressable>
          )}

          {!bulkMode && (
            <Pressable
              onPress={() => handleRemoveFromApp(post.id)}
              style={{ alignItems: 'center', paddingTop: 5 }}
            >
              <Text style={{ fontFamily: fonts.regular, fontSize: 9, color: pal.textMuted }}>Uygulamadan kaldır</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    );
  }

  function renderReelCard({ item: reel }: { item: InstagramReel }) {
    return (
      <View style={{ backgroundColor: pal.card, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: pal.border, marginBottom: 12 }}>
        <View style={{ position: 'relative' }}>
          <Image source={{ uri: reel.thumbnailUrl }} style={{ width: '100%', aspectRatio: 9 / 16, maxHeight: 280 }} resizeMode="cover" />
          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="play" size={24} color="#fff" />
            </View>
          </View>
          <View style={{ position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
            <Ionicons name="eye-outline" size={12} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{formatIgCount(reel.viewCount)}</Text>
          </View>
          <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#fff' }}>9:16 REEL</Text>
          </View>
        </View>
        <View style={{ padding: 14 }}>
          <Text numberOfLines={2} style={{ fontFamily: fonts.medium, fontSize: 13, color: pal.textPrimary, lineHeight: 18, marginBottom: 10 }}>
            {reel.caption}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="heart-outline" size={14} color={pal.textMuted} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: pal.textMuted }}>{formatIgCount(reel.likeCount)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="chatbubble-outline" size={14} color={pal.textMuted} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: pal.textMuted }}>{reel.commentsCount}</Text>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: pal.textMuted, flex: 1, textAlign: 'right' }}>
              {new Date(reel.timestamp).toLocaleDateString('tr-TR')}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push({ pathname: '/share-story', params: { imageUrl: reel.thumbnailUrl, caption: reel.caption } } as never)}
            style={{ backgroundColor: pal.actionBg, borderRadius: 12, padding: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
          >
            <Ionicons name="share-outline" size={15} color={pal.textSecondary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: pal.textSecondary }}>Hikayeye Çevir</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderStoryCard({ item: story }: { item: InstagramStory }) {
    const hoursLeft = Math.max(0, Math.round((new Date(story.expiresAt).getTime() - Date.now()) / 3600000));
    return (
      <View style={{ width: 120, alignItems: 'center', marginRight: 12 }}>
        <View style={{ width: 90, height: 160, borderRadius: 18, overflow: 'hidden', borderWidth: 2.5, borderColor: '#E1306C', position: 'relative' }}>
          <Image source={{ uri: story.mediaUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          <View style={{ position: 'absolute', bottom: 6, left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="eye-outline" size={9} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: '#fff' }}>{story.viewCount}</Text>
            </View>
          </View>
          <View style={{ position: 'absolute', top: 6, left: 0, right: 0, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 8, color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }}>
              9:16
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: hoursLeft <= 3 ? colors.danger : pal.textSecondary, marginTop: 5 }}>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: pal.bg }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: pal.headerBg, borderBottomWidth: 1, borderBottomColor: pal.tabBorder }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: pal.actionBg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={22} color={pal.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: pal.textPrimary }}>Instagram İçerikleri</Text>
        </View>

        <Pressable onPress={handleSync} disabled={syncing} style={{ marginRight: 6, width: 34, height: 34, borderRadius: 17, backgroundColor: pal.actionBg, alignItems: 'center', justifyContent: 'center' }}>
          {syncing ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="refresh-outline" size={17} color={pal.textPrimary} />}
        </Pressable>

        {!bulkMode ? (
          <Pressable
            onPress={() => setBulkMode(true)}
            style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#EFF6FF', borderRadius: 10 }}
          >
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>Çoklu Seç</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => { setBulkMode(false); setSelectedIds(new Set()); }}
            style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: pal.actionBg, borderRadius: 10 }}
          >
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: pal.textSecondary }}>İptal ({selectedIds.size})</Text>
          </Pressable>
        )}
      </View>

      {/* Bulk Action Bar */}
      {bulkMode && selectedIds.size > 0 && (
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pal.tabBg, borderBottomWidth: 1, borderBottomColor: pal.tabBorder, gap: 8 }}>
          {readyBulkCount > 0 && (
            <Pressable
              onPress={handleBulkPublish}
              disabled={publishingBulk}
              style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 9, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}
            >
              {publishingBulk && <ActivityIndicator size="small" color="#fff" />}
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{readyBulkCount} Ürüne Çevir</Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleBulkHide}
            style={{ flex: 1, backgroundColor: pal.actionBg, borderRadius: 10, paddingVertical: 9, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}
          >
            <Ionicons name="eye-off-outline" size={14} color={pal.textSecondary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: pal.textSecondary }}>Gizle</Text>
          </Pressable>
          <Pressable
            onPress={handleBulkRemove}
            style={{ flex: 1, backgroundColor: isDarkMode ? '#450A0A' : '#FFF5F5', borderRadius: 10, paddingVertical: 9, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}
          >
            <Ionicons name="trash-outline" size={14} color={colors.danger} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.danger }}>Kaldır</Text>
          </Pressable>
        </View>
      )}

      {/* Content Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: pal.tabBg, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: pal.tabBorder }}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, backgroundColor: activeTab === tab.id ? pal.tabActive : 'transparent' }}
          >
            <Ionicons name={tab.icon as any} size={15} color={activeTab === tab.id ? colors.primary : pal.textSecondary} />
            <Text style={{ fontFamily: activeTab === tab.id ? fonts.bold : fonts.medium, fontSize: 12, color: activeTab === tab.id ? colors.primary : pal.textSecondary }}>
              {tab.label}
            </Text>
            {tab.count !== undefined && tab.count > 0 && (
              <View style={{ backgroundColor: activeTab === tab.id ? colors.primary : pal.actionBg, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: activeTab === tab.id ? '#fff' : pal.textMuted }}>{tab.count}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* Filter Chips — only for posts */}
      {activeTab === 'posts' && (
        <View style={{ backgroundColor: pal.tabBg, paddingBottom: 10 }}>
          <FlatList
            horizontal
            data={FILTER_TABS}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 8 }}
            renderItem={({ item }) => {
              const active = activeFilter === item.id;
              return (
                <Pressable
                  onPress={() => setActiveFilter(item.id)}
                  style={{ backgroundColor: active ? pal.filterActive : pal.filterBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
                >
                  <Text style={{ fontFamily: active ? fonts.bold : fonts.medium, fontSize: 12, color: active ? pal.filterActiveTx : pal.filterTx }}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#E1306C" size="large" />
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: pal.textSecondary, marginTop: 12 }}>İçerikler yükleniyor...</Text>
        </View>
      ) : (
        <>
          {activeTab === 'posts' && (
            <FlatList
              data={filteredPosts}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={{ gap: GRID_GAP }}
              contentContainerStyle={{ padding: 16, gap: GRID_GAP, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E1306C" />}
              ListEmptyComponent={() => (
                <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                  <Ionicons name="images-outline" size={52} color={pal.textMuted} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: pal.textPrimary, marginTop: 14 }}>İçerik yok</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: pal.textSecondary, marginTop: 6, textAlign: 'center' }}>
                    {activeFilter !== 'all' ? 'Bu filtreyle içerik bulunamadı.' : 'Henüz içerik içe aktarılmadı.'}
                  </Text>
                </View>
              )}
              renderItem={renderPostCard}
            />
          )}

          {activeTab === 'reels' && (
            <FlatList
              data={reels}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E1306C" />}
              ListEmptyComponent={() => (
                <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                  <Ionicons name="play-circle-outline" size={52} color={pal.textMuted} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: pal.textPrimary, marginTop: 14 }}>Reel yok</Text>
                </View>
              )}
              renderItem={renderReelCard}
            />
          )}

          {activeTab === 'stories' && (
            <FlatList
              data={stories}
              keyExtractor={(item) => item.id}
              horizontal
              contentContainerStyle={{ padding: 16 }}
              showsHorizontalScrollIndicator={false}
              ListHeaderComponent={
                stories.length > 0 ? (
                  <View style={{ paddingHorizontal: 0, paddingBottom: 12 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: pal.textPrimary }}>
                      Aktif Hikayeler ({stories.length})
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: pal.textSecondary, marginTop: 3 }}>
                      24 saat içinde sona erer. 9:16 oranında tam ekran.
                    </Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={() => (
                <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 }}>
                  <Ionicons name="ellipse-outline" size={52} color={pal.textMuted} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: pal.textPrimary, marginTop: 14 }}>Aktif hikaye yok</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: pal.textSecondary, marginTop: 6, textAlign: 'center' }}>
                    Instagram hikayeleriniz buraya aktarılacak.
                  </Text>
                </View>
              )}
              renderItem={renderStoryCard}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}
