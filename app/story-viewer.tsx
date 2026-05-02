import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import { useListings } from '../src/context/ListingsContext';
import { getOrCreateConversationForListing } from '../src/services/chatLinkageService';
import { useAuth } from '../src/context/AuthContext';
import type { Story } from '../src/data/mockData';
import { fetchStoryById, formatStoryExpiration } from '../src/services/storyService';
import { trackEvent } from '../src/services/monitoring';
import { TELEMETRY_EVENTS } from '../src/constants/telemetryEvents';

const STORY_DURATION_MS = 5000;
const TICK_MS = 80;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default function StoryViewerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { storyId, sellerKey } = useLocalSearchParams<{ storyId?: string; sellerKey?: string }>();
  const {
    homeStories,
    markStorySeen,
    storyLikes,
    storyComments,
    toggleStoryLike,
    addStoryComment,
    openOrCreateConversation,
    editHomeStory,
    deleteHomeStory,
  } = useListings();

  const insets = useSafeAreaInsets();
  const [isPaused, setIsPaused] = useState(false);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editPriceTag, setEditPriceTag] = useState('');
  const [progress, setProgress] = useState(0);
  const [messageDraft, setMessageDraft] = useState('');
  const [remoteStory, setRemoteStory] = useState<Story | null>(null);
  const [remoteStoryFailed, setRemoteStoryFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const routeInitKeyRef = useRef('__uninitialized__');

  const localStories = useMemo(
    () => homeStories.filter((item) => !item.isAdd),
    [homeStories],
  );

  useEffect(() => {
    if (!storyId || !isUuid(storyId)) {
      setRemoteStory(null);
      setRemoteStoryFailed(false);
      return;
    }

    const existsLocally = localStories.some((item) => item.id === storyId || item.backendId === storyId);
    if (existsLocally || remoteStory?.backendId === storyId) {
      return;
    }

    let active = true;
    setRemoteStoryFailed(false);

    fetchStoryById(storyId)
      .then((item) => {
        if (!active) {
          return;
        }

        if (!item) {
          setRemoteStoryFailed(true);
          return;
        }

        setRemoteStory({
          id: `story-${item.id}`,
          backendId: item.id,
          productId: item.listing_id ?? undefined,
          seller: item.profiles?.full_name?.trim() || 'Satıcı',
          storeName: item.profiles?.full_name?.trim() || 'Satıcı',
          sellerKey: item.owner_id ?? item.user_id,
          ownerId: item.owner_id ?? item.user_id,
          avatarUrl: item.profiles?.avatar_url ?? undefined,
          createdAt: item.created_at,
          expiresAt: item.expires_at,
          productTitle: item.listings?.title ?? undefined,
          priceTag: typeof item.listings?.price === 'number' ? `${item.listings.price} TL` : undefined,
          productDescription: item.caption ?? undefined,
          viewCount: Math.max(0, item.view_count ?? 0),
          likeCount: 0,
          commentCount: 0,
          image: item.image_url,
        });
      })
      .catch(() => {
        if (active) {
          setRemoteStoryFailed(true);
        }
      });

    return () => {
      active = false;
    };
  }, [localStories, remoteStory?.backendId, storyId]);

  const stories = useMemo(
    () => (remoteStory ? [...localStories, remoteStory] : localStories),
    [localStories, remoteStory],
  );

  const groupedStories = useMemo(() => {
    const grouped = new Map<string, typeof stories>();
    stories.forEach((item) => {
      const key = (item.sellerKey || item.seller || item.id).trim();
      const current = grouped.get(key) ?? [];
      grouped.set(key, [...current, item]);
    });
    return grouped;
  }, [stories]);

  const sellerOrder = useMemo(() => {
    return Array.from(groupedStories.entries())
      .sort(([, aStories], [, bStories]) => {
        const aTime = Math.max(...aStories.map((item) => new Date(item.createdAt ?? 0).getTime()));
        const bTime = Math.max(...bStories.map((item) => new Date(item.createdAt ?? 0).getTime()));
        return bTime - aTime;
      })
      .map(([key]) => key);
  }, [groupedStories]);

  const [sellerIndex, setSellerIndex] = useState(0);
  const currentSellerKey = sellerOrder[sellerIndex] ?? sellerOrder[0];
  const sellerStories = useMemo(
    () => [...(groupedStories.get(currentSellerKey) ?? [])].sort((a, b) => 
      new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
    ),
    [currentSellerKey, groupedStories],
  );

  const [storyIndex, setStoryIndex] = useState(0);
  const story = sellerStories[storyIndex];
  const isOwner = Boolean(user && story?.ownerId && user.id === story.ownerId);
  const liked = story ? Boolean(storyLikes[story.id]) : false;
  const storyCommentsList = story ? (storyComments[story.id] ?? []) : [];
  const storyLikeCount = story ? Math.max((story.likeCount ?? 0) + (liked ? 1 : 0), 0) : 0;
  const storyViewCount = story ? Math.max(story.viewCount ?? 0, 0) : 0;
  const storyCommentCount = story ? (story.commentCount ?? 0) + storyCommentsList.length : 0;
  const storyRemainingSec = Math.max(0, Math.ceil((1 - progress) * (STORY_DURATION_MS / 1000)));
  const storyExpiryLabel = story?.expiresAt ? formatStoryExpiration(story.expiresAt) : null;

  function exitViewer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }

  useEffect(() => {
    if (sellerOrder.length === 0) return;

    const routeKey = `${storyId ?? ''}|${sellerKey ?? ''}`;
    if (routeInitKeyRef.current === routeKey) return;

    const targetSellerIndex = Math.max(
      0,
      sellerKey
        ? sellerOrder.findIndex((item) => item === sellerKey)
        : sellerOrder.findIndex((key) => groupedStories.get(key)?.some((item) => item.id === storyId || item.backendId === storyId)),
    );
    const targetSellerKey = sellerOrder[targetSellerIndex] ?? sellerOrder[0];
    const targetStories = [...(groupedStories.get(targetSellerKey) ?? [])].sort(
      (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime(),
    );
    const targetStoryIndex = Math.max(0, targetStories.findIndex((item) => item.id === storyId || item.backendId === storyId));

    routeInitKeyRef.current = routeKey;
    setSellerIndex(targetSellerIndex);
    setStoryIndex(targetStoryIndex);
    setProgress(0);
  }, [groupedStories, sellerKey, sellerOrder, storyId]);

  useEffect(() => {
    if (sellerOrder.length === 0) return;
    if (sellerIndex > sellerOrder.length - 1) {
      setSellerIndex(Math.max(sellerOrder.length - 1, 0));
    }
  }, [sellerIndex, sellerOrder.length]);

  useEffect(() => {
    if (!story && sellerStories.length > 0) {
      setStoryIndex(0);
      setProgress(0);
      return;
    }

    if (!story && storyId && isUuid(storyId) && !remoteStoryFailed) {
      return;
    }

    if (!story) {
      exitViewer();
      return;
    }

    markStorySeen(story.id);
    trackEvent(TELEMETRY_EVENTS.STORY_VIEWED, {
      story_id: story.id ?? null,
      seller_id: (story.sellerKey || story.ownerId || null) ?? null,
      seller_name: story.seller ?? null,
    });
    setProgress(0);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (isPaused) {
      return;
    }

    timerRef.current = setInterval(() => {
      setProgress((current) => {
        const next = current + (TICK_MS / STORY_DURATION_MS);

        if (next >= 1) {
          if (storyIndex < sellerStories.length - 1) {
            setStoryIndex((value) => value + 1);
            return 0;
          }

          if (sellerIndex < sellerOrder.length - 1) {
            setSellerIndex((value) => value + 1);
            setStoryIndex(0);
            return 0;
          }

          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          exitViewer();
          return 1;
        }

        return next;
      });
    }, TICK_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPaused, sellerIndex, sellerOrder.length, sellerStories.length, story, storyIndex]);

  useEffect(() => {
    setMessageDraft('');
    setIsComposerFocused(false);
    setIsEditing(false);
    setEditTitle(story?.productTitle ?? '');
    setEditCaption(story?.productDescription ?? '');
    setEditPriceTag(story?.priceTag ?? '');
  }, [story?.id]);

  if (!story) {
    return null;
  }

  function nextStory() {
    if (storyIndex < sellerStories.length - 1) {
      setStoryIndex((current) => current + 1);
      return;
    }
    if (sellerIndex < sellerOrder.length - 1) {
      setSellerIndex((current) => current + 1);
      setStoryIndex(0);
      setProgress(0);
      return;
    }
    exitViewer();
  }

  function prevStory() {
    if (storyIndex > 0) {
      setStoryIndex((current) => current - 1);
      return;
    }
    if (sellerIndex > 0) {
      const prevSellerStories = [...(groupedStories.get(sellerOrder[sellerIndex - 1]) ?? [])].sort(
        (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime(),
      );
      setSellerIndex((current) => current - 1);
      setStoryIndex(Math.max(prevSellerStories.length - 1, 0));
      return;
    }
    setProgress(0);
  }

  function closeViewer() {
    exitViewer();
  }

  async function handleSaveStoryEdit() {
    if (!story || !isOwner) {
      return;
    }

    const ok = await editHomeStory(story.id, {
      productTitle: editTitle.trim() || undefined,
      productDescription: editCaption.trim() || undefined,
      priceTag: editPriceTag.trim() || undefined,
    });

    if (ok) {
      setIsEditing(false);
    }
  }

  async function handleDeleteStory() {
    if (!story || !isOwner) {
      return;
    }

    const ok = await deleteHomeStory(story.id);
    if (ok) {
      nextStory();
    }
  }

  async function handleDirectProductLink() {
    if (!story || !story.productId) return;
    
    // Navigate directly to product page
    router.push(`/product/${story.productId}`);
  }

  function handleMessageSeller() {
    if (!story || !story.seller) {
      return;
    }

    const conversationId = openOrCreateConversation(
      (story.sellerKey || story.ownerId || story.seller).trim(),
      story.storeName || story.seller,
      story.image,
    );

    router.push(`/messages?conversationId=${conversationId}`);
  }

  async function handleSendMessage() {
    if (!story || !user) return;

    const clean = messageDraft.trim();
    if (!clean) return;

    try {
      // Get seller from story
      const sellerId = (story.sellerKey || '').trim();
      if (!sellerId || !isUuid(sellerId)) {
        return;
      }

      // Get listing (product) ID
      const listingId = story.productId || story.id;
      if (!isUuid(listingId)) {
        return;
      }

      // Create conversation with listing link
      const conversation = await getOrCreateConversationForListing(
        user.id,
        sellerId,
        listingId
      );

      // Navigate to messages
      router.push(`/messages?conversationId=${conversation.id}`);
      setMessageDraft('');
    } catch (err) {
      console.error('Error sending message:', err);
    }
  }

  const bottomPad = 0; // handled by SafeAreaView edges bottom

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Full-screen story image */}
      <Image
        source={{ uri: story.image }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        resizeMode="cover"
      />

      {/* ── TOP GRADIENT (subtle shadow so text reads) ── */}
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130, zIndex: 18 }}
        pointerEvents="none"
      />

      {/* ── TOP AREA ── */}
      <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 }}>
        {/* Progress bars */}
        <View style={{ flexDirection: 'row', gap: 3, paddingHorizontal: 12, paddingTop: 10 }}>
          {sellerStories.map((item, i) => {
            const fill = i < storyIndex ? 1 : i > storyIndex ? 0 : progress;
            return (
              <View
                key={item.id}
                style={{ flex: 1, height: 2, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}
              >
                <View
                  style={{ width: `${Math.max(0, Math.min(1, fill)) * 100}%`, height: '100%', backgroundColor: '#fff', borderRadius: 99 }}
                />
              </View>
            );
          })}
        </View>

        {/* Seller row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#fff', overflow: 'hidden', marginRight: 10 }}>
            <Image source={{ uri: story.avatarUrl || story.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff', letterSpacing: 0.1 }}
            >
              {story.seller}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 1 }}>
              {sellerStories.length > 1 ? `${storyIndex + 1}/${sellerStories.length} · ` : ''}{isPaused ? 'duraklatıldı' : `${storyRemainingSec}s`}{storyExpiryLabel ? ` · ${storyExpiryLabel}` : ''}
            </Text>
          </View>
          {isOwner ? (
            <>
              <Pressable
                onPress={() => setIsEditing((c) => !c)}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center', marginRight: 6 }}
              >
                <Ionicons name={isEditing ? 'close-outline' : 'create-outline'} size={18} color="#fff" />
              </Pressable>
              <Pressable
                onPress={handleDeleteStory}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(180,0,0,0.5)', alignItems: 'center', justifyContent: 'center', marginRight: 6 }}
              >
                <Ionicons name="trash-outline" size={16} color="#fff" />
              </Pressable>
            </>
          ) : null}
          <Pressable
            onPress={closeViewer}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>

      {/* ── BOTTOM GRADIENT OVERLAY ── */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20 }}>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.97)']}
          locations={[0, 0.35, 0.65, 1]}
          style={{ paddingTop: 160 }}
        >
          {/* Edit form */}
          {isEditing ? (
            <View style={{ paddingHorizontal: 16, gap: 8, marginBottom: 14 }}>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Ürün adı"
                placeholderTextColor="rgba(255,255,255,0.45)"
                style={{ height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 14, color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
              />
              <TextInput
                value={editPriceTag}
                onChangeText={setEditPriceTag}
                placeholder="Fiyat (örn: 249 TL)"
                placeholderTextColor="rgba(255,255,255,0.45)"
                style={{ height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 14, color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
              />
              <TextInput
                value={editCaption}
                onChangeText={setEditCaption}
                placeholder="Açıklama"
                placeholderTextColor="rgba(255,255,255,0.45)"
                style={{ height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 14, color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
              />
              <Pressable
                onPress={handleSaveStoryEdit}
                style={{ height: 44, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Kaydet</Text>
              </Pressable>
            </View>
          ) : (story.productTitle || story.priceTag) ? (
            /* Product info */
            <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
              {story.productTitle ? (
                <Text
                  style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff', letterSpacing: 0.1 }}
                  numberOfLines={2}
                >
                  {story.productTitle}
                </Text>
              ) : null}
              {story.productDescription ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.78)', marginTop: 4, lineHeight: 18 }} numberOfLines={2}>
                  {story.productDescription}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                {story.priceTag ? (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{story.priceTag}</Text>
                  </View>
                ) : null}
                {story.productId ? (
                  <Pressable
                    onPress={handleDirectProductLink}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 99 }}
                  >
                    <Ionicons name="storefront-outline" size={13} color="#111" />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#111' }}>Ürüne Git</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* View + like count stats row */}
          {!isEditing ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, marginBottom: 10 }}>
              {storyViewCount > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="eye-outline" size={14} color="rgba(255,255,255,0.65)" />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                    {storyViewCount >= 1000 ? `${(storyViewCount / 1000).toFixed(1)}B` : storyViewCount}
                  </Text>
                </View>
              ) : null}
              {storyLikeCount > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="heart" size={13} color="rgba(248,113,113,0.85)" />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                    {storyLikeCount >= 1000 ? `${(storyLikeCount / 1000).toFixed(1)}B` : storyLikeCount}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Instagram bottom bar — quick replies + input + send + heart */}
          <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: 14, paddingTop: 4 }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
              {/* Quick reply chips — hidden while composer is focused */}
              {!isComposerFocused && !isOwner ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 10, paddingHorizontal: 2 }}
                >
                  {[
                    'Fiyat bilgisi verir misiniz?',
                    'Hâlâ satışta mı?',
                    'Kargo detayları neler?',
                    'Kaç adet kaldı?',
                    'Farklı rengi var mı?',
                    'Whatsapp\'tan yazabilir miyim?',
                  ].map((reply) => (
                    <Pressable
                      key={reply}
                      onPress={() => setMessageDraft(reply)}
                      style={{
                        borderRadius: 99,
                        borderWidth: 1.5,
                        borderColor: 'rgba(255,255,255,0.5)',
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        backgroundColor: 'rgba(255,255,255,0.1)',
                      }}
                    >
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#fff' }}>
                        {reply}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}

              <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 10, gap: 10 }}>
                <TextInput
                  value={messageDraft}
                  onChangeText={setMessageDraft}
                  onFocus={() => { setIsPaused(true); setIsComposerFocused(true); }}
                  onBlur={() => { setIsPaused(false); setIsComposerFocused(false); }}
                  onSubmitEditing={() => { handleSendMessage(); Keyboard.dismiss(); }}
                  placeholder={`${story.seller}'e mesaj gönder...`}
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  returnKeyType="send"
                  style={{
                    flex: 1,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1.5,
                    borderColor: 'rgba(255,255,255,0.4)',
                    paddingHorizontal: 18,
                    fontFamily: fonts.regular,
                    fontSize: 14,
                    color: '#fff',
                  }}
                />
                {messageDraft.trim().length > 0 ? (
                  <Pressable
                    onPress={() => { handleSendMessage(); Keyboard.dismiss(); }}
                    style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: colors.primary }}
                  >
                    <Ionicons name="send" size={20} color="#fff" />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => toggleStoryLike(story.id)}
                    style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name={liked ? 'heart' : 'heart-outline'} size={32} color={liked ? '#F87171' : '#fff'} />
                  </Pressable>
                )}
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </LinearGradient>
      </View>

      {/* Touch zones — left = prev, right = next */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 100,
          bottom: 160,
          flexDirection: 'row',
          display: isComposerFocused ? 'none' : 'flex',
          zIndex: 10,
        }}
      >
        <Pressable
          onPressIn={() => setIsPaused(true)}
          onPressOut={() => setIsPaused(false)}
          onPress={prevStory}
          delayLongPress={200}
          style={{ flex: 1 }}
        />
        <Pressable
          onPressIn={() => setIsPaused(true)}
          onPressOut={() => setIsPaused(false)}
          onPress={nextStory}
          delayLongPress={200}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}
