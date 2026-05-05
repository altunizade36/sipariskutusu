import { fetchMyStore, createSellerStore } from '../services/storeService';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCategorySlugPath } from '../catalog';
import { products, stories, type Product, type Story } from '../data/mockData';
import { sampleListings, DEMO_TARGET } from '../data/sampleListings';
import { fetchListings, updateListing as updateListingRemote, deleteListing as deleteListingRemote } from '../services/listingService';
import { isSupabaseConfigured } from '../services/supabase';
import { useAuth } from './AuthContext';
import {
  createStory,
  deleteStory as deleteStoryRemote,
  fetchActiveStories,
  markStorySeen as markStorySeenRemote,
  updateStory as updateStoryRemote,
} from '../services/storyService';
import { fetchStoreFollowState, followStore, unfollowStore } from '../services/storeFollowService';
import { addStoryCommentRemote, fetchStoryComments, fetchStoryEngagement, setStoryLike } from '../services/storyEngagementService';
import { captureError } from '../services/monitoring';
import { mapListingToProduct } from '../utils/listingMapper';
import { isVideoUri } from '../utils/media';
import {
  discoverSellers,
  sellerStories,
  storeData,
  storeHighlights as initialStoreHighlights,
  storePosts as initialStorePosts,
  type StoreHighlight,
  type StorePost,
} from '../data/storeData';

type CreateListingInput = {
  id?: string;
  sellerId?: string;
  storeId?: string;
  imageUri?: string;
  stock?: number;
  title: string;
  description: string;
  price: number;
  categoryId: string;
  condition: string;
  location: string;
  district: string;
  delivery: string[];
  mediaUris?: string[];
  availableSizes?: string[];
  availableColors?: string[];
  freeShipping?: boolean;
  attributes?: Array<{ label: string; value: string }>;
};

type CreateStoryInput = {
  title: string;
  categoryId: string;
  caption: string;
  priceTag?: string;
  imageUri?: string;
  productId?: string;
  isVideo?: boolean;
};

type CreateStoreInput = {
  name: string;
  username: string;
  description: string;
  city: string;
  email: string;
  phone: string;
  whatsapp?: string;
  website?: string;
  defaultStock: number;
  deliveryInfo: string;
  avatar?: string;
  coverImage?: string;
  categoryId: string;
  instagramHandle?: string;
  // Terms acceptance flags
  acceptedTermsOfService: boolean;
  acceptedPrivacyPolicy: boolean;
  acceptedKVKK: boolean;
  acceptedPlatformLiability: boolean;
};

export type SellerStoreProfile = typeof storeData & {
  categoryId: string;
  defaultStock: number;
  instagramHandle?: string;
  sellerRole?: 'seller';
  website?: string;
};

export type ChatMessage = {
  id: string;
  sender: 'me' | 'store';
  text: string;
  createdAt: string;
};

export type ChatConversation = {
  id: string;
  title: string;
  avatar: string;
  unreadCount: number;
  lastMessageAt: string;
  messages: ChatMessage[];
};

export type CartItem = {
  id: string;
  productId: string;
  quantity: number;
  size: string;
};

export type CartLine = {
  id: string;
  product: Product;
  quantity: number;
  size: string;
  availableStock: number;
};

export type SellerPublishReadiness = {
  ok: boolean;
  missing: string[];
};

type ListingsContextValue = {
  allProducts: Product[];
  homeProducts: Product[];
  homeHasMore: boolean;
  homeLoadingMore: boolean;
  homeStories: Story[];
  myStoryArchive: Story[];
  storyComments: Record<string, string[]>;
  storyLikes: Record<string, boolean>;
  markStorySeen: (storyId: string) => void;
  toggleStoryLike: (storyId: string) => void;
  addStoryComment: (storyId: string, comment: string) => void;
  editHomeStory: (
    storyId: string,
    updates: Partial<Pick<Story, 'productTitle' | 'productDescription' | 'priceTag' | 'image'>>,
  ) => Promise<boolean>;
  deleteHomeStory: (storyId: string) => Promise<boolean>;
  hasStore: boolean;
  sellerStore: SellerStoreProfile | null;
  sellerPublishReadiness: SellerPublishReadiness;
  canPublishAsSeller: boolean;
  publishedListings: Product[];
  storeProducts: Product[];
  storePosts: StorePost[];
  storeHighlights: StoreHighlight[];
  storeFollowersCount: number;
  storeFollowingCount: number;
  storeMessageCount: number;
  isFollowingStore: boolean;
  followedSellers: Record<string, boolean>;
  cartItems: CartLine[];
  cartItemCount: number;
  conversations: ChatConversation[];
  activeConversationId: string;
  typingConversationId: string | null;
  addListing: (listing: CreateListingInput) => Product;
  updateListing: (id: string, updates: Partial<{ title: string; description: string; price: number; mediaUris: string[]; videoUri: string | null }>) => Promise<void>;
  removeListing: (id: string) => Promise<void>;
  createStore: (store: CreateStoreInput) => Promise<SellerStoreProfile>;
  updateStoreProfile: (updates: Partial<{ name: string; description: string; city: string; avatar: string; coverImage: string; whatsapp: string; instagramHandle: string; website: string; phone: string; email: string; deliveryInfo: string }>) => Promise<void>;
  shareHomeStory: (story: CreateStoryInput) => { post: StorePost; product: Product };
  addStoryToHighlights: (postId: string) => void;
  updateHighlightTitle: (highlightId: string, nextTitle: string) => void;
  toggleFollowStore: () => void;
  toggleSellerFollow: (sellerKey: string) => void;
  setFollowedSellersMap: (
    next:
      | Record<string, boolean>
      | ((current: Record<string, boolean>) => Record<string, boolean>)
  ) => void;
  addToCart: (productId: string, size: string) => { ok: boolean; message: string };
  updateCartQuantity: (itemId: string, quantity: number) => { ok: boolean; message?: string };
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  getAvailableStock: (productId: string) => number;
  openConversation: (conversationId: string) => void;
  openOrCreateConversation: (sellerKey: string, sellerName: string, sellerAvatar?: string) => string;
  sendMessage: (conversationId: string, text: string) => void;
  deleteConversation: (conversationId: string) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  sendStoreMessage: () => void;
  reloadProducts: () => Promise<void>;
  reloadHomeStories: () => Promise<void>;
  loadMoreProducts: () => Promise<void>;
};

const ListingsContext = createContext<ListingsContextValue | null>(null);
const STORE_FOLLOWING_KEY = 'store-following-v1';
const FOLLOWED_SELLERS_KEY = 'followed-sellers-v1';
const CHAT_CONVERSATIONS_KEY = 'chat-conversations-v1';
const CHAT_ACTIVE_CONVERSATION_KEY = 'chat-active-conversation-v1';
const STORY_COMMENTS_KEY = 'story-comments-v1';
const STORY_LIKES_KEY = 'story-likes-v1';
const HOME_PRODUCTS_PAGE_SIZE = 20;

const listingImagesByCategory: Record<string, string> = {
  women: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80',
  men: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
  'mother-child': 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=600&q=80',
  home: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&q=80',
  supermarket: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80',
  cosmetics: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&q=80',
  'shoes-bags': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
  electronics: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80',
  watches: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80',
  sports: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=600&q=80',
};

const sellerCategoryMap: Record<string, Product['category']> = {
  Moda: 'women',
  Elektronik: 'electronics',
  'Ev & Yaşam': 'home',
  Ayakkabı: 'shoes-bags',
  Kozmetik: 'cosmetics',
};

const catalogRootToLegacyCategory: Record<string, Product['category']> = {
  kadin: 'women',
  erkek: 'men',
  'anne-cocuk': 'mother-child',
  'ev-yasam': 'home',
  supermarket: 'supermarket',
  kozmetik: 'cosmetics',
  'ayakkabi-canta': 'shoes-bags',
  elektronik: 'electronics',
  'saat-aksesuar': 'watches',
  'spor-outdoor': 'sports',
  otomotiv: 'electronics',
  'kitap-hobi-kirtasiye': 'home',
  'pet-shop': 'home',
  'yapi-market-bahce': 'home',
  'ofis-is': 'electronics',
};

function resolveCatalogRootSlug(categoryId: string) {
  const [rootSlug] = getCategorySlugPath(categoryId);
  return rootSlug ?? categoryId;
}

function resolveMarketplaceCategory(categoryId: string): Product['category'] {
  const rootSlug = resolveCatalogRootSlug(categoryId);
  return catalogRootToLegacyCategory[rootSlug] ?? 'women';
}

function resolveListingImage(categoryId: string) {
  const marketplaceCategory = resolveMarketplaceCategory(categoryId);
  return listingImagesByCategory[marketplaceCategory] ?? products[0].image;
}

const sellerPopularProductTemplates = [
  { title: 'Sezonun En Sevilen Parçası', price: 799.9, badge: 'Popüler İlan' },
  { title: 'Top Seller Önerisi', price: 1249.0, badge: 'En Çok İncelenen' },
  { title: 'Bu Haftanın Favori Ürünü', price: 459.9, badge: 'Vitrinde' },
  { title: 'Editörün Seçtiği Ürün', price: 999.0, badge: 'Trend' },
  { title: 'Hızlı Tükenen Ürün', price: 289.9, badge: 'Yeni' },
];

const storeProductTemplates = [
  {
    title: 'Mağaza Özel Drop',
    image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&q=80',
    price: 899.0,
    originalPrice: 1299.0,
    discount: 31,
    category: 'women' as Product['category'],
  },
  {
    title: 'Canlı Yayın Fırsatı',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
    price: 1499.0,
    originalPrice: 1899.0,
    discount: 21,
    category: 'shoes-bags' as Product['category'],
  },
  {
    title: 'Vitrine Yeni Gelen',
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80',
    price: 549.0,
    originalPrice: 799.0,
    discount: 31,
    category: 'shoes-bags' as Product['category'],
  },
];

const storeStoryTemplates = [
  {
    title: 'Yeni vitrin turu',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80',
    type: 'collection' as const,
    category: 'women' as Product['category'],
  },
  {
    title: 'Canlı yayın öncesi seçimler',
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&q=80',
    type: 'campaign' as const,
    category: 'electronics' as Product['category'],
  },
  {
    title: 'Bugünün favori kombinleri',
    image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&q=80',
    type: 'product' as const,
    category: 'women' as Product['category'],
  },
];

const initialSellerProducts: Product[] = discoverSellers.map((seller, index) => {
  const template = sellerPopularProductTemplates[index % sellerPopularProductTemplates.length];

  return {
    id: `seller-product-${seller.id}`,
    title: `${seller.name} ${template.title}`,
    brand: seller.name,
    price: template.price + index * 80,
    originalPrice: template.price + index * 120,
    discount: 20,
    rating: seller.rating,
    reviewCount: 200 + index * 37,
    favoriteCount: seller.followers,
    image: seller.coverImage,
    badge: template.badge,
    freeShipping: true,
    category: sellerCategoryMap[seller.category] ?? 'women',
  };
});

const initialStoreProducts: Product[] = storeProductTemplates.map((template, index) => ({
  id: `store-product-${index + 1}`,
  title: template.title,
  brand: storeData.name,
  price: template.price,
  originalPrice: template.originalPrice,
  discount: template.discount,
  rating: storeData.rating,
  reviewCount: 340 + index * 23,
  favoriteCount: 'Yeni',
  image: template.image,
  badge: 'Mağazada Yeni',
  freeShipping: true,
  category: template.category,
}));

const initialHomeStories: Story[] = [
  {
    ...stories[0],
    createdAt: nowIso(),
    expiresAt: getStoryExpiryIso(),
  },
  ...sellerStories.map((story) => ({
    id: `seller-story-${story.id}`,
    seller: story.seller,
    sellerKey: normalizeSellerKey(story.seller),
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    expiresAt: getStoryExpiryIso(new Date(Date.now() - 30 * 60 * 1000).toISOString()),
    image: story.avatar,
  })),
  ...stories.slice(1).map((story, index) => {
    const createdAt = new Date(Date.now() - (index + 1) * 20 * 60 * 1000).toISOString();
    return {
      ...story,
      sellerKey: normalizeSellerKey(story.seller),
      createdAt,
      expiresAt: getStoryExpiryIso(createdAt),
    };
  }),
];

const initialConversations: ChatConversation[] = [
  {
    id: 'store1',
    title: storeData.name,
    avatar: storeData.avatar,
    unreadCount: 1,
    lastMessageAt: new Date().toISOString(),
    messages: [
      {
        id: 'msg-store-welcome',
        sender: 'store',
        text: 'Merhaba! Hoş geldiniz. Yardımcı olabileceğim bir konu var mı?',
        createdAt: new Date().toISOString(),
      },
    ],
  },
];

function nowIso() {
  return new Date().toISOString();
}

function getStoryExpiryIso(createdAtIso?: string) {
  const createdAtMs = createdAtIso ? new Date(createdAtIso).getTime() : Date.now();
  return new Date(createdAtMs + 24 * 60 * 60 * 1000).toISOString();
}

function normalizeSellerKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

function getStock(product: Product | undefined) {
  return Math.max(product?.stock ?? 0, 0);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function ListingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [hasStore, setHasStore] = useState(false);
  const [sellerStore, setSellerStore] = useState<SellerStoreProfile | null>(null);
  const [backendProducts, setBackendProducts] = useState<Product[]>([]);
  const [backendPage, setBackendPage] = useState(0);
  const [backendHasMore, setBackendHasMore] = useState(true);
  const [backendLoadingMore, setBackendLoadingMore] = useState(false);
  const backendLoadingMoreRef = useRef(false);
  const [publishedListings, setPublishedListings] = useState<Product[]>([]);
  const [storyLinkedProducts, setStoryLinkedProducts] = useState<Product[]>([]);
  const [storePosts, setStorePosts] = useState<StorePost[]>(initialStorePosts);
  const [storeHighlights, setStoreHighlights] = useState<StoreHighlight[]>(initialStoreHighlights);
  const [homeStories, setHomeStories] = useState<Story[]>(initialHomeStories);
  const [storySeenIds, setStorySeenIds] = useState<string[]>([]);
  const [storyLikes, setStoryLikes] = useState<Record<string, boolean>>({});
  const [storyComments, setStoryComments] = useState<Record<string, string[]>>({});
  const [storyLikeCounts, setStoryLikeCounts] = useState<Record<string, number>>({});
  const [storyCommentCounts, setStoryCommentCounts] = useState<Record<string, number>>({});
  const [storeFollowersCount, setStoreFollowersCount] = useState(124800);
  const [storeFollowingCount, setStoreFollowingCount] = useState(312);
  const [isFollowingStore, setIsFollowingStore] = useState(false);
  const [followedSellers, setFollowedSellers] = useState<Record<string, boolean>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState('store1');
  const [typingConversationId, setTypingConversationId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(CHAT_CONVERSATIONS_KEY)
      .then((raw) => {
        if (!active || !raw) {
          return;
        }

        const parsed = JSON.parse(raw) as ChatConversation[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversations(parsed);
        }
      })
      .catch(() => {
        // no-op
      });

    AsyncStorage.getItem(CHAT_ACTIVE_CONVERSATION_KEY)
      .then((raw) => {
        if (!active || !raw) {
          return;
        }

        setActiveConversationId(raw);
      })
      .catch(() => {
        // no-op
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(STORY_COMMENTS_KEY)
      .then((raw) => {
        if (!active || !raw) {
          return;
        }

        const parsed = JSON.parse(raw) as Record<string, string[]>;
        if (!parsed || typeof parsed !== 'object') {
          return;
        }

        const normalized = Object.fromEntries(
          Object.entries(parsed).map(([storyId, comments]) => [
            storyId,
            Array.isArray(comments) ? comments.map((entry) => String(entry)) : [],
          ]),
        );

        setStoryComments(normalized);
      })
      .catch(() => {
        // no-op
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(STORY_LIKES_KEY)
      .then((raw) => {
        if (!active || !raw) {
          return;
        }

        const parsed = JSON.parse(raw) as Record<string, boolean>;
        if (!parsed || typeof parsed !== 'object') {
          return;
        }

        const normalized = Object.fromEntries(
          Object.entries(parsed).map(([storyId, liked]) => [storyId, Boolean(liked)]),
        );

        setStoryLikes(normalized);
      })
      .catch(() => {
        // no-op
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(CHAT_CONVERSATIONS_KEY, JSON.stringify(conversations)).catch(() => {
      // no-op
    });
  }, [conversations]);

  useEffect(() => {
    AsyncStorage.setItem(CHAT_ACTIVE_CONVERSATION_KEY, activeConversationId).catch(() => {
      // no-op
    });
  }, [activeConversationId]);

  useEffect(() => {
    AsyncStorage.setItem(STORY_COMMENTS_KEY, JSON.stringify(storyComments)).catch(() => {
      // no-op
    });
  }, [storyComments]);

  useEffect(() => {
    AsyncStorage.setItem(STORY_LIKES_KEY, JSON.stringify(storyLikes)).catch(() => {
      // no-op
    });
  }, [storyLikes]);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(STORE_FOLLOWING_KEY)
      .then((raw) => {
        if (!active || raw === null) {
          return;
        }

        setIsFollowingStore(raw === '1');
      })
      .catch(() => {
        // no-op
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORE_FOLLOWING_KEY, isFollowingStore ? '1' : '0').catch(() => {
      // no-op
    });
  }, [isFollowingStore]);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(FOLLOWED_SELLERS_KEY)
      .then((raw) => {
        if (!active || !raw) {
          return;
        }

        const parsed = JSON.parse(raw) as Record<string, boolean>;
        if (parsed && typeof parsed === 'object') {
          setFollowedSellers(parsed);
        }
      })
      .catch(() => {
        // no-op
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(FOLLOWED_SELLERS_KEY, JSON.stringify(followedSellers)).catch(() => {
      // no-op
    });
  }, [followedSellers]);

  useEffect(() => {
    if (!isSupabaseConfigured || !user || user.id.startsWith('demo-')) {
      return;
    }

    const backendStoryIds = homeStories
      .filter((item) => !item.isAdd && item.backendId)
      .map((item) => item.backendId as string);

    if (backendStoryIds.length === 0) {
      return;
    }

    let active = true;

    Promise.all([
      fetchStoryEngagement(backendStoryIds),
      fetchStoryComments(backendStoryIds),
    ])
      .then(([summary, commentsByBackendStoryId]) => {
        if (!active) {
          return;
        }

        const likeCountMap: Record<string, number> = {};
        const commentCountMap: Record<string, number> = {};
        const likedMap: Record<string, boolean> = {};
        const commentTextMap: Record<string, string[]> = {};

        homeStories.forEach((story) => {
          if (!story.backendId) {
            return;
          }

          const engagement = summary[story.backendId];
          if (!engagement) {
            return;
          }

          likeCountMap[story.id] = engagement.likeCount;
          commentCountMap[story.id] = engagement.commentCount;
          likedMap[story.id] = engagement.likedByMe;
          commentTextMap[story.id] = commentsByBackendStoryId[story.backendId] ?? [];
        });

        setStoryLikeCounts((current) => ({ ...current, ...likeCountMap }));
        setStoryCommentCounts((current) => ({ ...current, ...commentCountMap }));
        setStoryLikes((current) => ({ ...current, ...likedMap }));
        setStoryComments((current) => ({ ...current, ...commentTextMap }));
      })
      .catch((error) => {
        captureError(error, { scope: 'story_engagement_fetch' });
      });

    return () => {
      active = false;
    };
  }, [homeStories, user?.id]);

  const loadActiveHomeStories = useCallback(async () => {
    if (!isSupabaseConfigured) {
      return;
    }

    const items = await fetchActiveStories();

    const mapped: Story[] = items.map((item) => ({
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
    }));

    setHomeStories((current) => {
      const addStory = current.find((item) => item.isAdd) ?? initialHomeStories[0];
      const localStories = current.filter((item) => !item.isAdd && !item.backendId);
      const remoteIds = new Set(mapped.map((item) => item.backendId));
      const dedupedLocal = localStories.filter((item) => !item.backendId || !remoteIds.has(item.backendId));

      return [addStory, ...mapped, ...dedupedLocal];
    });
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let active = true;

    loadActiveHomeStories()
      .then(() => {
        if (!active) {
          return;
        }
      })
      .catch((error) => {
        captureError(error, { scope: 'stories_fetch' });
      });

    return () => {
      active = false;
    };
  }, [loadActiveHomeStories]);

  const loadBackendProductsPage = useCallback(async (page: number, mode: 'replace' | 'append') => {
    if (!isSupabaseConfigured) {
      return;
    }

    if (backendLoadingMoreRef.current) {
      return;
    }

    backendLoadingMoreRef.current = true;
    setBackendLoadingMore(true);
    try {
      const items = await fetchListings({}, page, HOME_PRODUCTS_PAGE_SIZE);
      const mapped = items
        .filter((item) => {
          const title = (item.title ?? '').toLowerCase();
          const seller = ((item as any).seller_name ?? '').toLowerCase();
          if (title.includes('smoke') || seller.includes('smoke')) return false;
          if (title.includes('test listing') || title.includes('dummy')) return false;
          return true;
        })
        .map(mapListingToProduct);

      setBackendProducts((current) => {
        if (mode === 'replace') {
          return mapped;
        }

        const seen = new Set(current.map((item) => item.id));
        const next = mapped.filter((item) => !seen.has(item.id));
        return [...current, ...next];
      });

      setBackendPage(page);
      setBackendHasMore(items.length === HOME_PRODUCTS_PAGE_SIZE);
    } catch (error) {
      if (mode === 'replace') {
        console.warn('Backend ilanları yüklenemedi, mock veri kullanılıyor:', error);
      }
      throw error;
    } finally {
      backendLoadingMoreRef.current = false;
      setBackendLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    loadBackendProductsPage(0, 'replace').catch(() => undefined);
  }, [loadBackendProductsPage]);

  const activeStore = sellerStore ?? storeData;
    // Kullanıcının mevcut mağazasını Supabase'den yükle
    useEffect(() => {
      if (!isSupabaseConfigured) return;
      let active = true;
      fetchMyStore()
        .then((row) => {
          if (!active || !row) return;
          const profile: SellerStoreProfile = {
            ...storeData,
            id: row.id,
            name: row.name,
            username: `@${row.username}`,
            description: row.description,
            city: row.city,
            avatar: row.avatar_url || storeData.avatar,
            coverImage: row.cover_url || storeData.coverImage,
            email: row.email,
            phone: row.phone,
            whatsapp: row.whatsapp || '',
            website: row.website || '',
            deliveryInfo: row.delivery_info,
            categoryId: row.category_id,
            defaultStock: row.default_stock,
            instagramHandle: row.instagram_handle || '',
            sellerRole: 'seller',
            verified: Boolean(row.is_verified),
          };
          setSellerStore(profile);
          setHasStore(true);
        })
        .catch(() => {});
      return () => { active = false; };
    }, []);

  const storeProducts = useMemo(
    () => (hasStore ? [...publishedListings, ...storyLinkedProducts] : []),
    [hasStore, publishedListings, storyLinkedProducts],
  );
  const computedHomeStories = useMemo(() => {
    const now = Date.now();

    return homeStories
      .filter((item) => {
        if (item.isAdd) {
          return true;
        }

        if (!item.expiresAt) {
          return true;
        }

        return new Date(item.expiresAt).getTime() > now;
      })
      .map((item) => ({ ...item, seen: item.isAdd ? false : storySeenIds.includes(item.id) }));
  }, [homeStories, storySeenIds])
    .map((item) => ({
      ...item,
      likeCount: storyLikeCounts[item.id] ?? item.likeCount,
      commentCount: storyCommentCounts[item.id] ?? item.commentCount,
      viewCount: item.viewCount ?? 0,
    }));
  const myStoryArchive = useMemo(() => {
    if (!user) {
      return [];
    }

    const now = Date.now();

    return homeStories
      .filter((item) => {
        if (item.isAdd) {
          return false;
        }

        return item.ownerId === user.id
          && Boolean(item.expiresAt)
          && new Date(item.expiresAt as string).getTime() <= now;
      })
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .map((item) => ({ ...item, isArchived: true }));
  }, [homeStories, user]);
  const baseMarketplaceProducts = useMemo(
    () => (backendProducts.length > 0 ? backendProducts : [...initialStoreProducts, ...initialSellerProducts, ...products]),
    [backendProducts],
  );

  // Ana sayfada her satıcıdan max 2 ürün çıkacak şekilde round-robin karıştırma
  const diversifyFeed = useCallback((items: Product[]): Product[] => {
    const MAX_PER_SELLER = 2;
    const buckets = new Map<string, Product[]>();
    const noSellerId: Product[] = [];

    for (const item of items) {
      const key = item.sellerId ?? item.storeId ?? null;
      if (!key) {
        noSellerId.push(item);
        continue;
      }
      if (!buckets.has(key)) buckets.set(key, []);
      const bucket = buckets.get(key)!;
      if (bucket.length < MAX_PER_SELLER) bucket.push(item);
    }

    // Round-robin: sırayla her satıcıdan 1'er ürün al
    const sellerQueues = Array.from(buckets.values());
    const result: Product[] = [];
    let round = 0;
    let added = true;
    while (added) {
      added = false;
      for (const queue of sellerQueues) {
        if (round < queue.length) {
          result.push(queue[round]);
          added = true;
        }
      }
      round++;
    }

    return [...result, ...noSellerId];
  }, []);

  const visibleDemoListings = useMemo(() => {
    const realCount = baseMarketplaceProducts.length;
    const slots = Math.max(0, DEMO_TARGET - realCount);
    return sampleListings.slice(0, slots);
  }, [baseMarketplaceProducts]);

  const homeProducts = useMemo(
    () => {
      const combined = [...publishedListings, ...storyLinkedProducts, ...baseMarketplaceProducts];
      const diversified = diversifyFeed(combined);
      return [...diversified, ...visibleDemoListings];
    },
    [baseMarketplaceProducts, publishedListings, storyLinkedProducts, diversifyFeed, visibleDemoListings],
  );
  const allProducts = useMemo(
    () => [...publishedListings, ...storyLinkedProducts, ...baseMarketplaceProducts, ...sampleListings],
    [baseMarketplaceProducts, publishedListings, storyLinkedProducts],
  );
  const storeMessageCount = conversations.find((item) => item.id === 'store1')?.unreadCount ?? 0;
  const cartItems = useMemo(
    () =>
      cart
        .map((item) => {
          const product = allProducts.find((entry) => entry.id === item.productId);

          if (!product) {
            return null;
          }

          const normalizedQuantity = Math.min(item.quantity, getStock(product));

          if (normalizedQuantity <= 0) {
            return null;
          }

          return {
            id: item.id,
            product,
            quantity: normalizedQuantity,
            size: item.size,
            availableStock: getStock(product),
          } satisfies CartLine;
        })
        .filter(Boolean) as CartLine[],
    [allProducts, cart],
  );
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const sellerPublishReadiness = useMemo<SellerPublishReadiness>(() => {
    const missing: string[] = [];

    if (!hasStore || !sellerStore) {
      missing.push('Mağaza kurulumunu tamamla.');
      return {
        ok: false,
        missing,
      };
    }

    if (!sellerStore.name?.trim()) {
      missing.push('Mağaza adını ekle.');
    }
    if (!sellerStore.description?.trim()) {
      missing.push('Mağaza açıklamasını doldur.');
    }
    if (!sellerStore.city?.trim()) {
      missing.push('Şehir bilgisini gir.');
    }
    if (!sellerStore.categoryId?.trim()) {
      missing.push('Kategori seç.');
    }
    if (!sellerStore.email?.trim()) {
      missing.push('E-posta bilgisini gir.');
    }
    if (!sellerStore.phone?.trim()) {
      missing.push('Telefon bilgisini gir.');
    }

    const hasSalesChannel = Boolean(
      sellerStore.whatsapp?.trim() || sellerStore.instagramHandle?.trim() || sellerStore.website?.trim(),
    );

    if (!hasSalesChannel) {
      missing.push('En az bir satış kanalı ekle (WhatsApp, Instagram veya website).');
    }

    return {
      ok: missing.length === 0,
      missing,
    };
  }, [hasStore, sellerStore]);

  const canPublishAsSeller = sellerPublishReadiness.ok;

  function addListing(listing: CreateListingInput) {
    const defaultStockPerListing = sellerStore?.defaultStock ?? 6;
    const mediaUris = listing.mediaUris?.filter(Boolean) ?? (listing.imageUri?.trim() ? [listing.imageUri.trim()] : undefined);
    const createdProduct: Product = {
      id: listing.id ?? `listing-${Date.now()}`,
      sellerId: listing.sellerId,
      storeId: listing.storeId,
      title: listing.title,
      brand: activeStore.name,
      description: listing.description,
      price: listing.price,
      rating: 4.8,
      reviewCount: 0,
      favoriteCount: 'Yeni',
      image: listing.imageUri?.trim() || resolveListingImage(listing.categoryId),
      mediaUris,
      badge: 'Yeni İlan',
      freeShipping: Boolean(listing.freeShipping),
      category: resolveMarketplaceCategory(listing.categoryId),
      condition: listing.condition,
      location: listing.location,
      district: listing.district,
      delivery: listing.delivery,
      availableSizes: listing.availableSizes,
      availableColors: listing.availableColors,
      attributes: listing.attributes,
      stock: listing.stock ?? defaultStockPerListing,
      whatsapp: activeStore.whatsapp,
    };

    setPublishedListings((current) => [createdProduct, ...current]);
    return createdProduct;
  }

  async function updateListing(id: string, updates: Partial<{ title: string; description: string; price: number; mediaUris: string[]; videoUri: string | null }>) {
    setPublishedListings((current) =>
      current.map((product) =>
        product.id === id
          ? (() => {
              const nextMedia = updates.mediaUris && updates.mediaUris.length > 0
                ? updates.mediaUris
                : product.mediaUris ?? [product.image];
              const nextVideo = updates.videoUri === null
                ? undefined
                : updates.videoUri ?? product.videoUri;
              const nextCover = nextMedia.find((uri) => !isVideoUri(uri))
                ?? nextVideo
                ?? nextMedia[0]
                ?? product.image;

              return {
                ...product,
                title: updates.title ?? product.title,
                description: updates.description ?? product.description,
                price: updates.price ?? product.price,
                mediaUris: nextMedia,
                videoUri: nextVideo,
                image: nextCover,
              };
            })()
          : product,
      ),
    );

    if (isSupabaseConfigured) {
      try {
        await updateListingRemote(id, {
          title: updates.title,
          description: updates.description,
          price: updates.price,
          imageUris: updates.mediaUris,
          videoUri: updates.videoUri ?? undefined,
          mediaUris: updates.mediaUris,
        });
      } catch (error) {
        captureError(error, { scope: 'listing_update' });
      }
    }
  }

  async function removeListing(id: string) {
    setPublishedListings((current) => current.filter((product) => product.id !== id));
    setStoryLinkedProducts((current) => current.filter((product) => product.id !== id));
    setStorePosts((current) => current.filter((post) => post.linkedProductId !== id));
    setStoreHighlights((current) => current.filter((highlight) => {
      const linkedPostId = highlight.linkedPostId;
      if (!linkedPostId) {
        return true;
      }

      const linkedPost = storePosts.find((post) => post.id === linkedPostId);
      return linkedPost?.linkedProductId !== id;
    }));

    if (isSupabaseConfigured) {
      try {
        await deleteListingRemote(id);
      } catch (error) {
        captureError(error, { scope: 'listing_remove' });
      }
    }
  }

  async function createStore(store: CreateStoreInput) {
    const normalizedUsername = store.username.trim().replace(/\s+/g, '').replace(/^@*/, '');
    const localProfile: SellerStoreProfile = {
      ...storeData,
      id: 'seller-store',
      name: store.name.trim(),
      username: `@${normalizedUsername}`,
      description: store.description.trim(),
      city: store.city.trim(),
      avatar: store.avatar?.trim() || 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&q=80',
      coverImage: store.coverImage?.trim() || resolveListingImage(store.categoryId) || storeData.coverImage,
      email: store.email.trim(),
      phone: store.phone.trim(),
      whatsapp: store.whatsapp?.trim() || '',
      website: store.website?.trim() || '',
      followers: '0',
      following: '0',
      productCount: 0,
      rating: 5,
      reviewCount: 0,
      deliveryInfo: store.deliveryInfo.trim(),
      established: new Date().getFullYear().toString(),
      verified: false,
      categoryId: store.categoryId,
      defaultStock: Math.max(1, Math.min(999, Math.trunc(store.defaultStock))),
      instagramHandle: store.instagramHandle?.trim() || '',
      sellerRole: 'seller',
    };

    setSellerStore(localProfile);
    setHasStore(true);
    setPublishedListings([]);
    setStoryLinkedProducts([]);
    setStorePosts([]);
    setStoreHighlights([]);
    setStoreFollowersCount(0);
    setStoreFollowingCount(0);
    // Supabase'e kaydet
    if (isSupabaseConfigured) {
      try {
        const remote = await createSellerStore(store);
        setSellerStore((current) => current ? {
          ...current,
          id: remote.id,
          name: remote.name,
          username: `@${remote.username}`,
          description: remote.description,
          city: remote.city,
          email: remote.email,
          phone: remote.phone,
          whatsapp: remote.whatsapp || '',
          website: remote.website || '',
          avatar: remote.avatar_url || current.avatar,
          coverImage: remote.cover_url || current.coverImage,
          deliveryInfo: remote.delivery_info,
          categoryId: remote.category_id,
          defaultStock: remote.default_stock,
          instagramHandle: remote.instagram_handle || '',
          verified: Boolean(remote.is_verified),
          sellerRole: 'seller',
        } : current);
      } catch (_err) {
        // local state korunuyor
      }
    }
    return localProfile;
  }

  async function updateStoreProfile(updates: Partial<{ name: string; description: string; city: string; avatar: string; coverImage: string; whatsapp: string; instagramHandle: string; website: string; phone: string; email: string; deliveryInfo: string }>) {
    if (!sellerStore) return;

    const updatedProfile: SellerStoreProfile = {
      ...sellerStore,
      name: updates.name ?? sellerStore.name,
      description: updates.description ?? sellerStore.description,
      city: updates.city ?? sellerStore.city,
      avatar: updates.avatar ?? sellerStore.avatar,
      coverImage: updates.coverImage ?? sellerStore.coverImage,
      whatsapp: updates.whatsapp ?? sellerStore.whatsapp,
      instagramHandle: updates.instagramHandle ?? sellerStore.instagramHandle,
      website: updates.website ?? sellerStore.website,
      phone: updates.phone ?? sellerStore.phone,
      email: updates.email ?? sellerStore.email,
      deliveryInfo: updates.deliveryInfo ?? sellerStore.deliveryInfo,
    };

    setSellerStore(updatedProfile);

    if (isSupabaseConfigured && sellerStore.id && isUuid(sellerStore.id)) {
      try {
        const { updateSellerStore } = await import('../services/storeService');
        const remote = await updateSellerStore(sellerStore.id, {
          name: updates.name,
          description: updates.description,
          city: updates.city,
          avatar: updates.avatar,
          coverImage: updates.coverImage,
          whatsapp: updates.whatsapp,
          instagramHandle: updates.instagramHandle,
          website: updates.website,
          phone: updates.phone,
          email: updates.email,
          deliveryInfo: updates.deliveryInfo,
        });

        setSellerStore((current) => current ? {
          ...current,
          name: remote.name,
          username: `@${remote.username}`,
          description: remote.description,
          city: remote.city,
          avatar: remote.avatar_url || current.avatar,
          coverImage: remote.cover_url || current.coverImage,
          whatsapp: remote.whatsapp || '',
          instagramHandle: remote.instagram_handle || '',
          website: remote.website || '',
          phone: remote.phone || '',
          email: remote.email || '',
          deliveryInfo: remote.delivery_info || '',
          verified: Boolean(remote.is_verified),
        } : current);
      } catch (error) {
        captureError(error, { scope: 'store_profile_update' });
      }
    }
  }

  function shareHomeStory(story: CreateStoryInput) {
    const template = storeStoryTemplates[storePosts.length % storeStoryTemplates.length];
    const timestamp = Date.now();
    const defaultStoryStock = Math.max(1, Math.floor((sellerStore?.defaultStock ?? 6) / 2));
    const selectedProduct = story.productId
      ? allProducts.find((item) => item.id === story.productId)
      : undefined;
    const shouldCreateLinkedProduct = !selectedProduct;
    const createdProduct: Product = selectedProduct
      ? { ...selectedProduct }
      : {
          id: `story-product-${timestamp}`,
          title: story.title,
          brand: activeStore.name,
          price: 699 + storePosts.length * 25,
          originalPrice: 899 + storePosts.length * 25,
          discount: 22,
          rating: activeStore.rating,
          reviewCount: 0,
          favoriteCount: 'Yeni',
          image: story.imageUri?.trim() || resolveListingImage(story.categoryId) || template.image,
          badge: 'Hikayede',
          freeShipping: true,
          category: resolveMarketplaceCategory(story.categoryId),
          stock: defaultStoryStock,
          whatsapp: activeStore.whatsapp,
        };
    const createdPost: StorePost = {
      id: `store-post-${timestamp}`,
      image: createdProduct.image,
      title: story.title || createdProduct.title,
      date: nowIso(),
      type: 'product',
      likes: 0,
      comments: 0,
      isVideo: Boolean(story.isVideo),
      linkedProductId: createdProduct.id,
    };

    if (shouldCreateLinkedProduct) {
      setStoryLinkedProducts((current) => [createdProduct, ...current]);
    }
    setStorePosts((current) => [createdPost, ...current]);
    const createdAt = nowIso();
    setHomeStories((current) => [
      current[0],
      {
        id: `home-shared-story-${timestamp}`,
        seller: activeStore.name,
        storeName: activeStore.name,
        sellerKey: user?.id || normalizeSellerKey(activeStore.name),
        ownerId: user?.id,
        productId: createdProduct.id,
        createdAt,
        expiresAt: getStoryExpiryIso(createdAt),
        productTitle: story.title || createdProduct.title,
        productDescription: story.caption,
        priceTag: story.priceTag || `${createdProduct.price} TL`,
        likeCount: 0,
        commentCount: 0,
        image: story.imageUri?.trim() || createdProduct.image,
      },
      ...current.slice(1),
    ]);

    if (isSupabaseConfigured && user && !user.id.startsWith('demo-')) {
      createStory({
        imageUri: story.imageUri?.trim() || createdProduct.image,
        caption: story.caption,
        storeId: isUuid(activeStore.id) ? activeStore.id : undefined,
        listingId: isUuid(createdProduct.id) ? createdProduct.id : undefined,
      })
        .then((saved) => {
          setHomeStories((current) =>
            current.map((entry) =>
              entry.id === `home-shared-story-${timestamp}`
                ? { ...entry, backendId: saved.id, productId: saved.listing_id ?? entry.productId }
                : entry,
            ),
          );
        })
        .catch((error) => {
          captureError(error, { scope: 'story_share' });
        });
    }

    return { post: createdPost, product: createdProduct };
  }

  function markStorySeen(storyId: string) {
    setStorySeenIds((current) => (current.includes(storyId) ? current : [...current, storyId]));

    if (!isSupabaseConfigured || !user || user.id.startsWith('demo-')) {
      return;
    }

    const story = homeStories.find((item) => item.id === storyId);
    if (!story?.backendId) {
      return;
    }

    markStorySeenRemote(story.backendId).catch((error) => {
      captureError(error, { scope: 'story_mark_seen' });
    });
  }

  function toggleStoryLike(storyId: string) {
    const story = homeStories.find((item) => item.id === storyId);
    const isLikedNow = Boolean(storyLikes[storyId]);
    const nextLiked = !isLikedNow;
    const fallbackLikeCount = story?.likeCount ?? 0;

    setStoryLikes((current) => ({
      ...current,
      [storyId]: nextLiked,
    }));
    setStoryLikeCounts((current) => ({
      ...current,
      [storyId]: Math.max((current[storyId] ?? fallbackLikeCount) + (nextLiked ? 1 : -1), 0),
    }));

    if (!isSupabaseConfigured || !user || user.id.startsWith('demo-') || !story?.backendId) {
      return;
    }

    setStoryLike(story.backendId, nextLiked).catch((error) => {
      captureError(error, { scope: 'story_like_toggle' });
      setStoryLikes((current) => ({
        ...current,
        [storyId]: isLikedNow,
      }));
      setStoryLikeCounts((current) => ({
        ...current,
        [storyId]: Math.max((current[storyId] ?? fallbackLikeCount) + (isLikedNow ? 1 : -1), 0),
      }));
    });
  }

  function addStoryComment(storyId: string, comment: string) {
    const clean = comment.trim();
    if (!clean) {
      return;
    }

    const story = homeStories.find((item) => item.id === storyId);
    const fallbackCommentCount = story?.commentCount ?? 0;

    setStoryComments((current) => ({
      ...current,
      [storyId]: [...(current[storyId] ?? []), clean],
    }));
    setStoryCommentCounts((current) => ({
      ...current,
      [storyId]: (current[storyId] ?? fallbackCommentCount) + 1,
    }));

    if (!isSupabaseConfigured || !user || user.id.startsWith('demo-') || !story?.backendId) {
      return;
    }

    addStoryCommentRemote(story.backendId, clean).catch((error) => {
      captureError(error, { scope: 'story_comment_add' });
      setStoryComments((current) => {
        const next = [...(current[storyId] ?? [])];
        const index = next.lastIndexOf(clean);
        if (index >= 0) {
          next.splice(index, 1);
        }
        return {
          ...current,
          [storyId]: next,
        };
      });
      setStoryCommentCounts((current) => ({
        ...current,
        [storyId]: Math.max((current[storyId] ?? fallbackCommentCount) - 1, 0),
      }));
    });
  }

  async function editHomeStory(
    storyId: string,
    updates: Partial<Pick<Story, 'productTitle' | 'productDescription' | 'priceTag' | 'image'>>,
  ) {
    const target = homeStories.find((item) => item.id === storyId);

    if (!target || !user || target.ownerId !== user.id) {
      return false;
    }

    setHomeStories((current) =>
      current.map((item) =>
        item.id === storyId
          ? {
              ...item,
              productTitle: updates.productTitle ?? item.productTitle,
              productDescription: updates.productDescription ?? item.productDescription,
              priceTag: updates.priceTag ?? item.priceTag,
              image: updates.image ?? item.image,
            }
          : item,
      ),
    );

    if (!isSupabaseConfigured || !target.backendId || user.id.startsWith('demo-')) {
      return true;
    }

    try {
      const nextCaption = [
        updates.productDescription ?? target.productDescription ?? '',
        updates.priceTag ?? target.priceTag ? `Fiyat: ${updates.priceTag ?? target.priceTag}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      await updateStoryRemote(target.backendId, {
        caption: nextCaption || null,
        imageUri: updates.image,
      });

      return true;
    } catch (error) {
      captureError(error, { scope: 'story_edit' });
      return false;
    }
  }

  async function deleteHomeStory(storyId: string) {
    const target = homeStories.find((item) => item.id === storyId);

    if (!target || !user || target.ownerId !== user.id) {
      return false;
    }

    const previous = homeStories;
    setHomeStories((current) => current.filter((item) => item.id !== storyId));

    if (!isSupabaseConfigured || !target.backendId || user.id.startsWith('demo-')) {
      return true;
    }

    try {
      await deleteStoryRemote(target.backendId);
      return true;
    } catch (error) {
      captureError(error, { scope: 'story_delete' });
      setHomeStories(previous);
      return false;
    }
  }

  function openOrCreateConversation(sellerKey: string, sellerName: string, sellerAvatar?: string) {
    const key = sellerKey.trim() || normalizeSellerKey(sellerName) || 'store1';
    const conversationId = `seller-${key}`;

    setConversations((current) => {
      if (current.some((conversation) => conversation.id === conversationId)) {
        return current;
      }

      return [
        {
          id: conversationId,
          title: sellerName,
          avatar: sellerAvatar || storeData.avatar,
          unreadCount: 0,
          lastMessageAt: nowIso(),
          messages: [],
        },
        ...current,
      ];
    });
    setActiveConversationId(conversationId);

    return conversationId;
  }

  function addStoryToHighlights(postId: string) {
    const storyPost = storePosts.find((post) => post.id === postId);
    const alreadyHighlighted = storeHighlights.some((item) => item.linkedPostId === postId);

    if (!storyPost || alreadyHighlighted) {
      return;
    }

    setStoreHighlights((current) => [
      {
        id: `highlight-${postId}`,
        title: storyPost.title,
        image: storyPost.image,
        type: storyPost.type,
        date: storyPost.date,
        linkedPostId: postId,
      },
      ...current,
    ]);
  }

  function updateHighlightTitle(highlightId: string, nextTitle: string) {
    const clean = nextTitle.trim();
    if (!clean) {
      return;
    }

    setStoreHighlights((current) =>
      current.map((item) =>
        item.id === highlightId
          ? {
              ...item,
              title: clean,
            }
          : item,
      ),
    );
  }

  function toggleFollowStore() {
    setIsFollowingStore((current) => {
      const next = !current;
      setStoreFollowersCount((followers) => followers + (next ? 1 : -1));

      if (isSupabaseConfigured && user && !user.id.startsWith('demo-') && isUuid(activeStore.id)) {
        (async () => {
          try {
            if (next) {
              await followStore(activeStore.id);
            } else {
              await unfollowStore(activeStore.id);
            }

            const state = await fetchStoreFollowState(activeStore.id);
            setIsFollowingStore(state.isFollowing);
            if (state.followerCount > 0) {
              setStoreFollowersCount(state.followerCount);
            }
          } catch (error) {
            captureError(error, { scope: 'store_follow_toggle' });
          }
        })();
      }

      return next;
    });
  }

  function toggleSellerFollow(sellerKey: string) {
    const normalizedKey = sellerKey.trim();
    if (!normalizedKey) {
      return;
    }

    const isCurrentlyFollowed = Boolean(followedSellers[normalizedKey]);

    setFollowedSellers((current) => ({
      ...current,
      [normalizedKey]: !current[normalizedKey],
    }));

    if (!isSupabaseConfigured || !user || user.id.startsWith('demo-') || !isUuid(normalizedKey)) {
      return;
    }

    (async () => {
      try {
        if (isCurrentlyFollowed) {
          await unfollowStore(normalizedKey);
        } else {
          await followStore(normalizedKey);
        }
      } catch (error) {
        captureError(error, { scope: 'seller_follow_toggle' });
        setFollowedSellers((current) => ({
          ...current,
          [normalizedKey]: isCurrentlyFollowed,
        }));
      }
    })();
  }

  function setFollowedSellersMap(
    next:
      | Record<string, boolean>
      | ((current: Record<string, boolean>) => Record<string, boolean>),
  ) {
    setFollowedSellers((current) =>
      typeof next === 'function'
        ? next(current)
        : next,
    );
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !user || user.id.startsWith('demo-') || !isUuid(activeStore.id)) {
      return;
    }

    let active = true;

    fetchStoreFollowState(activeStore.id)
      .then((state) => {
        if (!active) {
          return;
        }

        setIsFollowingStore(state.isFollowing);
        if (state.followerCount > 0) {
          setStoreFollowersCount(state.followerCount);
        }
      })
      .catch((error) => {
        captureError(error, { scope: 'store_follow_state' });
      });

    return () => {
      active = false;
    };
  }, [activeStore.id, user?.id]);

  function getAvailableStock(productId: string) {
    const product = allProducts.find((item) => item.id === productId);
    const inCart = cart.reduce((sum, item) => (item.productId === productId ? sum + item.quantity : sum), 0);
    return Math.max(getStock(product) - inCart, 0);
  }

  function addToCart(productId: string, size: string) {
    const product = allProducts.find((item) => item.id === productId);

    if (!product) {
      return { ok: false, message: 'Ürün bulunamadı.' };
    }

    const availableStock = getAvailableStock(productId);

    if (availableStock <= 0) {
      return { ok: false, message: 'Stok tükendi.' };
    }

    const normalizedSize = size.trim() || 'Standart';

    setCart((current) => {
      const existing = current.find((item) => item.productId === productId && item.size === normalizedSize);

      if (existing) {
        return current.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: Math.min(item.quantity + 1, getStock(product)) }
            : item,
        );
      }

      return [
        ...current,
        {
          id: `cart-${productId}-${normalizedSize}`,
          productId,
          quantity: 1,
          size: normalizedSize,
        },
      ];
    });

    return {
      ok: true,
      message: availableStock === 1 ? 'Son ürün sepete eklendi.' : 'Ürün sepete eklendi.',
    };
  }

  function updateCartQuantity(itemId: string, quantity: number) {
    const target = cart.find((item) => item.id === itemId);
    const product = allProducts.find((item) => item.id === target?.productId);

    if (!target || !product) {
      return { ok: false, message: 'Sepet ürünü bulunamadı.' };
    }

    if (quantity <= 0) {
      setCart((current) => current.filter((item) => item.id !== itemId));
      return { ok: true };
    }

    const otherReserved = cart.reduce(
      (sum, item) => (item.productId === target.productId && item.id !== itemId ? sum + item.quantity : sum),
      0,
    );
    const maxAllowed = Math.max(getStock(product) - otherReserved, 0);

    if (maxAllowed <= 0) {
      return { ok: false, message: 'Bu ürün için stok kalmadı.' };
    }

    setCart((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, quantity: Math.min(quantity, maxAllowed) } : item,
      ),
    );

    return quantity > maxAllowed
      ? { ok: false, message: `En fazla ${maxAllowed} adet eklenebilir.` }
      : { ok: true };
  }

  function removeFromCart(itemId: string) {
    setCart((current) => current.filter((item) => item.id !== itemId));
  }

  function clearCart() {
    setCart([]);
  }

  function openConversation(conversationId: string) {
    setActiveConversationId(conversationId);
    setTypingConversationId((current) => (current === conversationId ? null : current));
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
      ),
    );
  }

  function sendMessage(conversationId: string, text: string) {
    const cleanText = text.trim();

    if (!cleanText) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `msg-me-${Date.now()}`,
      sender: 'me',
      text: cleanText,
      createdAt: nowIso(),
    };
    setConversations((current) =>
      current.map((conversation) => {
        if (conversation.id !== conversationId) {
          return conversation;
        }

        return {
          ...conversation,
          messages: [...conversation.messages, userMessage],
          lastMessageAt: userMessage.createdAt,
          unreadCount: 0,
        };
      }),
    );

    setTypingConversationId(conversationId);

    setTimeout(() => {
      const replyMessage: ChatMessage = {
        id: `msg-store-${Date.now()}-reply`,
        sender: 'store',
        text: 'Mesajın alındı. En kısa sürede geri dönüş sağlayacağız.',
        createdAt: nowIso(),
      };

      setConversations((current) =>
        current.map((conversation) => {
          if (conversation.id !== conversationId) {
            return conversation;
          }

          return {
            ...conversation,
            messages: [...conversation.messages, replyMessage],
            lastMessageAt: replyMessage.createdAt,
            unreadCount: 0,
          };
        }),
      );
      setTypingConversationId((current) => (current === conversationId ? null : current));
    }, 900);
  }

  function deleteConversation(conversationId: string) {
    setConversations((current) => {
      const next = current.filter((conversation) => conversation.id !== conversationId);
      const nextActive = next[0]?.id ?? '';

      setActiveConversationId((currentActive) => (currentActive === conversationId ? nextActive : currentActive));
      setTypingConversationId((currentTyping) => (currentTyping === conversationId ? null : currentTyping));

      return next;
    });
  }

  function deleteMessage(conversationId: string, messageId: string) {
    setConversations((current) =>
      current.map((conversation) => {
        if (conversation.id !== conversationId) {
          return conversation;
        }

        const nextMessages = conversation.messages.filter((message) => message.id !== messageId);
        const nextLastMessageAt = nextMessages[nextMessages.length - 1]?.createdAt ?? conversation.lastMessageAt;

        return {
          ...conversation,
          messages: nextMessages,
          lastMessageAt: nextLastMessageAt,
        };
      }),
    );
  }

  function sendStoreMessage() {
    openConversation('store1');
  }

  async function reloadProducts() {
    if (!isSupabaseConfigured) return;
    try {
      await loadBackendProductsPage(0, 'replace');
    } catch (error) {
      captureError(error, { scope: 'reload_products' });
    }
  }

  const reloadHomeStories = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      await loadActiveHomeStories();
    } catch (error) {
      captureError(error, { scope: 'reload_home_stories' });
    }
  }, [loadActiveHomeStories]);

  async function loadMoreProducts() {
    if (!isSupabaseConfigured || !backendHasMore || backendLoadingMore) {
      return;
    }

    try {
      await loadBackendProductsPage(backendPage + 1, 'append');
    } catch (error) {
      captureError(error, { scope: 'load_more_products' });
    }
  }

  const value: ListingsContextValue = {
    allProducts,
    homeProducts,
    homeHasMore: backendHasMore,
    homeLoadingMore: backendLoadingMore,
    homeStories: computedHomeStories,
    myStoryArchive,
    storyComments,
    storyLikes,
    markStorySeen,
    toggleStoryLike,
    addStoryComment,
    editHomeStory,
    deleteHomeStory,
    hasStore,
    sellerStore,
    sellerPublishReadiness,
    canPublishAsSeller,
    publishedListings,
    storeProducts,
    storePosts,
    storeHighlights,
    storeFollowersCount,
    storeFollowingCount,
    storeMessageCount,
    isFollowingStore,
    followedSellers,
    cartItems,
    cartItemCount,
    conversations,
    activeConversationId,
    typingConversationId,
    addListing,
    updateListing,
    removeListing,
    createStore,
    updateStoreProfile,
    shareHomeStory,
    addStoryToHighlights,
    updateHighlightTitle,
    toggleFollowStore,
    toggleSellerFollow,
    setFollowedSellersMap,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    getAvailableStock,
    openConversation,
    openOrCreateConversation,
    sendMessage,
    deleteConversation,
    deleteMessage,
    sendStoreMessage,
    reloadProducts,
    reloadHomeStories,
    loadMoreProducts,
  };

  return <ListingsContext.Provider value={value}>{children}</ListingsContext.Provider>;
}

export function useListings() {
  const context = useContext(ListingsContext);

  if (!context) {
    throw new Error('useListings must be used within a ListingsProvider');
  }

  return context;
}