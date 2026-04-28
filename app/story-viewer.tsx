import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import { useListings } from '../src/context/ListingsContext';
import { getOrCreateConversationForListing } from '../src/services/chatLinkageService';
import { useAuth } from '../src/context/AuthContext';
import type { Story } from '../src/data/mockData';
import { fetchStoryById } from '../src/services/storyService';

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

  const [isPaused, setIsPaused] = useState(false);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editPriceTag, setEditPriceTag] = useState('');
  const [progress, setProgress] = useState(0);
  const [commentDraft, setCommentDraft] = useState('');
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
          createdAt: item.created_at,
          expiresAt: item.expires_at,
          productTitle: item.listings?.title ?? undefined,
          priceTag: typeof item.listings?.price === 'number' ? `${item.listings.price} TL` : undefined,
          productDescription: item.caption ?? undefined,
          likeCount: Math.max(0, item.view_count ?? 0),
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
  const storyCommentCount = story ? (story.commentCount ?? 0) + storyCommentsList.length : 0;
  const storyRemainingSec = Math.max(0, Math.ceil((1 - progress) * (STORY_DURATION_MS / 1000)));

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
    setCommentDraft('');
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

  function submitComment() {
    if (!story) return;
    const clean = commentDraft.trim();
    if (!clean) return;
    addStoryComment(story.id, clean);
    setCommentDraft('');
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

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      {/* Progress bars header */}
      <View className="absolute top-0 left-0 right-0 z-20 px-3 pt-2">
        <View className="flex-row gap-1">
          {sellerStories.map((item, i) => {
            const fill = i < storyIndex ? 1 : i > storyIndex ? 0 : progress;
            return (
              <View key={item.id} className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden">
                <View style={{ width: `${Math.max(0, Math.min(1, fill)) * 100}%` }} className="h-full bg-white" />
              </View>
            );
          })}
        </View>

        {/* Seller info and close */}
        <View className="flex-row items-center justify-between mt-3 mb-2">
          <View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>
              {story.seller}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: '#E5E7EB' }}>
              Hikaye {storyIndex + 1}/{sellerStories.length}
              {isPaused ? ' • duraklatıldı' : ` • ${storyRemainingSec}s`}
            </Text>
          </View>
          <Pressable onPress={closeViewer} className="w-9 h-9 rounded-full bg-black/40 items-center justify-center">
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
        </View>
        {isOwner ? (
          <View className="flex-row gap-2 mb-2">
            <Pressable
              onPress={() => setIsEditing((current) => !current)}
              className="px-3 h-8 rounded-full items-center justify-center"
              style={{ backgroundColor: '#00000066' }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>
                {isEditing ? 'Iptal' : 'Duzenle'}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleDeleteStory}
              className="px-3 h-8 rounded-full items-center justify-center"
              style={{ backgroundColor: '#7F1D1DCC' }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>
                Sil
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Story image */}
      <View className="flex-1">
        <Image source={{ uri: story.image }} className="w-full h-full" resizeMode="cover" />
      </View>

      {/* Bottom overlay - Product info and actions */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        style={{ position: 'absolute', left: 12, right: 12, bottom: 10, zIndex: 30 }}
      >
        <View style={{ borderRadius: 14, backgroundColor: '#00000088', padding: 10, backdropFilter: 'blur(8px)' }}>
          {/* Product info card */}
          {isEditing ? (
            <View style={{ gap: 6, marginBottom: 6 }}>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Urun adi"
                placeholderTextColor="#9CA3AF"
                style={{
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: '#FFFFFFE6',
                  paddingHorizontal: 10,
                  fontFamily: fonts.regular,
                  fontSize: 11,
                  color: colors.textPrimary,
                }}
              />
              <TextInput
                value={editPriceTag}
                onChangeText={setEditPriceTag}
                placeholder="Fiyat etiketi"
                placeholderTextColor="#9CA3AF"
                style={{
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: '#FFFFFFE6',
                  paddingHorizontal: 10,
                  fontFamily: fonts.regular,
                  fontSize: 11,
                  color: colors.textPrimary,
                }}
              />
              <TextInput
                value={editCaption}
                onChangeText={setEditCaption}
                placeholder="Aciklama"
                placeholderTextColor="#9CA3AF"
                style={{
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: '#FFFFFFE6',
                  paddingHorizontal: 10,
                  fontFamily: fonts.regular,
                  fontSize: 11,
                  color: colors.textPrimary,
                }}
              />
              <Pressable
                onPress={handleSaveStoryEdit}
                style={{
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>
                  Degisiklikleri Kaydet
                </Text>
              </Pressable>
            </View>
          ) : story.productTitle ? (
            <>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }} numberOfLines={1}>
                {story.productTitle}
              </Text>
              {story.productDescription && (
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: '#E5E7EB', marginTop: 2 }} numberOfLines={2}>
                  {story.productDescription}
                </Text>
              )}
              {story.priceTag && (
                <View style={{ marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#111827DD', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>
                    {story.priceTag}
                  </Text>
                </View>
              )}
            </>
          ) : null}

          {/* Engagement metrics */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 14 }}>
            <Pressable onPress={() => toggleStoryLike(story.id)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? '#F87171' : '#fff'} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff', marginLeft: 5 }}>
                {storyLikeCount}
              </Text>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chatbubble-outline" size={17} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff', marginLeft: 5 }}>
                {storyCommentCount}
              </Text>
            </View>
          </View>

          {/* Direct action buttons */}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            {story.productId ? (
              <Pressable
                onPress={handleDirectProductLink}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 6,
                }}
              >
                <Ionicons name="eye-outline" size={16} color="#fff" />
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>
                  Ürüne Git
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={handleMessageSeller}
              style={{
                flex: 1,
                height: 36,
                borderRadius: 10,
                backgroundColor: '#1F2937',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
              }}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>
                Mesaj At
              </Text>
            </Pressable>
          </View>

          {/* Comment input */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <TextInput
              value={commentDraft}
              onChangeText={setCommentDraft}
              onFocus={() => {
                setIsPaused(true);
                setIsComposerFocused(true);
              }}
              onBlur={() => {
                setIsPaused(false);
                setIsComposerFocused(false);
              }}
              onSubmitEditing={submitComment}
              placeholder="Yorum yaz"
              placeholderTextColor="#9CA3AF"
              showSoftInputOnFocus
              autoCorrect
              autoCapitalize="sentences"
              returnKeyType="send"
              blurOnSubmit={false}
              style={{
                flex: 1,
                height: 34,
                borderRadius: 10,
                backgroundColor: '#FFFFFFE6',
                paddingHorizontal: 10,
                fontFamily: fonts.regular,
                fontSize: 11,
                color: colors.textPrimary,
              }}
            />
            <Pressable
              onPress={() => {
                submitComment();
                Keyboard.dismiss();
              }}
              disabled={!commentDraft.trim()}
              style={{
                height: 34,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: commentDraft.trim() ? '#FFFFFFE6' : '#E5E7EB',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.textPrimary }}>
                Gönder
              </Text>
            </Pressable>
          </View>

          {/* Message input */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <TextInput
              value={messageDraft}
              onChangeText={setMessageDraft}
              onFocus={() => {
                setIsPaused(true);
                setIsComposerFocused(true);
              }}
              onBlur={() => {
                setIsPaused(false);
                setIsComposerFocused(false);
              }}
              onSubmitEditing={handleSendMessage}
              placeholder="Mesaj gönder"
              placeholderTextColor="#9CA3AF"
              showSoftInputOnFocus
              autoCorrect
              autoCapitalize="sentences"
              returnKeyType="send"
              blurOnSubmit={false}
              style={{
                flex: 1,
                height: 34,
                borderRadius: 10,
                backgroundColor: '#FFFFFFE6',
                paddingHorizontal: 10,
                fontFamily: fonts.regular,
                fontSize: 11,
                color: colors.textPrimary,
              }}
            />
            <Pressable
              onPress={() => {
                handleSendMessage();
                Keyboard.dismiss();
              }}
              disabled={!messageDraft.trim()}
              style={{
                height: 34,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: messageDraft.trim() ? colors.primary : '#AFC7ED',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>
                Mesaj
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Touch zones for navigation */}
      <View style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 92,
        bottom: 220,
        flexDirection: 'row',
        display: isComposerFocused ? 'none' : 'flex',
        zIndex: 10,
      }}>
        <Pressable
          onPressIn={() => setIsPaused(true)}
          onPressOut={() => setIsPaused(false)}
          onPress={prevStory}
          delayLongPress={200}
          className="flex-1"
        />
        <Pressable
          onPressIn={() => setIsPaused(true)}
          onPressOut={() => setIsPaused(false)}
          onPress={nextStory}
          delayLongPress={200}
          className="flex-1"
        />
      </View>
    </SafeAreaView>
  );
}
