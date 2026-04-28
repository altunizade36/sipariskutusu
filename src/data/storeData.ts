export type StoreHighlight = {
  id: string;
  title: string;
  image: string;
  type: 'product' | 'campaign' | 'collection';
  date: string;
  linkedPostId?: string;
};

export type StorePost = {
  id: string;
  image: string;
  title: string;
  date: string;
  type: 'product' | 'campaign' | 'collection';
  likes: number;
  comments: number;
  isVideo?: boolean;
  linkedProductId?: string;
};

export type SellerStory = {
  id: string;
  seller: string;
  avatar: string;
  badge?: string;
};

export type DiscoverSeller = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  coverImage: string;
  city: string;
  category: string;
  followers: string;
  rating: number;
  headline: string;
  tags: string[];
  weeklyDrop: string;
  featured: boolean;
};

export const storeData = {
  id: 'store1',
  name: 'ModaStore Türkiye',
  username: '@modastoret',
  avatar: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=300&q=80',
  coverImage: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80',
  description: 'Türkiye\'nin en trend moda mağazası. Kadın, erkek ve çocuk giyim.',
  city: 'İstanbul, Türkiye',
  email: 'iletisim@modastoret.com',
  phone: '+90 212 555 01 23',
  whatsapp: '905325550123',
  website: 'https://modastore.example.com',
  followers: '124.8B',
  following: '312',
  productCount: 2847,
  rating: 4.8,
  reviewCount: 18432,
  deliveryInfo: 'Kargo: 1–3 iş günü. 150₺ üzeri ücretsiz kargo.',
  established: '2018',
  verified: true,
};

export const storeHighlights: StoreHighlight[] = [
  {
    id: 'h1',
    title: 'Yeni Sezon',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=300&q=80',
    type: 'collection',
    date: '2024-11-14',
  },
  {
    id: 'h2',
    title: 'Flash Sale',
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=300&q=80',
    type: 'campaign',
    date: '2024-11-13',
  },
  {
    id: 'h3',
    title: 'Kış Koleksiyonu',
    image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=300&q=80',
    type: 'collection',
    date: '2024-11-12',
  },
  {
    id: 'h4',
    title: 'Ürün Tanıtım',
    image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=300&q=80',
    type: 'product',
    date: '2024-11-11',
  },
  {
    id: 'h5',
    title: 'Aksesuar',
    image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=300&q=80',
    type: 'product',
    date: '2024-11-10',
  },
  {
    id: 'h6',
    title: 'Kampanya',
    image: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=300&q=80',
    type: 'campaign',
    date: '2024-11-09',
  },
];

export const storePosts: StorePost[] = [
  {
    id: 'sp1',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&q=80',
    title: 'Yeni Sezon Kış Koleksiyonu',
    date: '2024-11-14',
    type: 'collection',
    likes: 1243,
    comments: 82,
    isVideo: true,
  },
  {
    id: 'sp2',
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80',
    title: '%50 Flash İndirim Kampanyası',
    date: '2024-11-13',
    type: 'campaign',
    likes: 892,
    comments: 37,
    isVideo: true,
  },
  {
    id: 'sp3',
    image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&q=80',
    title: 'Oversize Kadın Mont',
    date: '2024-11-12',
    type: 'product',
    likes: 567,
    comments: 24,
    isVideo: false,
  },
  {
    id: 'sp4',
    image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&q=80',
    title: 'Trençkot Koleksiyonu',
    date: '2024-11-11',
    type: 'product',
    likes: 744,
    comments: 41,
    isVideo: true,
  },
  {
    id: 'sp5',
    image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&q=80',
    title: 'Aksesuar & Takı Serisi',
    date: '2024-11-10',
    type: 'product',
    likes: 389,
    comments: 19,
    isVideo: false,
  },
  {
    id: 'sp6',
    image: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=400&q=80',
    title: 'Kış İndirimleri Başladı!',
    date: '2024-11-09',
    type: 'campaign',
    likes: 1102,
    comments: 77,
    isVideo: true,
  },
  {
    id: 'sp7',
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80',
    title: 'Oversize Tişört Koleksiyonu',
    date: '2024-11-08',
    type: 'product',
    likes: 678,
    comments: 32,
    isVideo: true,
  },
  {
    id: 'sp8',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80',
    title: 'Spor Ayakkabı Serisi',
    date: '2024-11-07',
    type: 'product',
    likes: 534,
    comments: 21,
    isVideo: true,
  },
  {
    id: 'sp9',
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&q=80',
    title: 'Çanta Koleksiyonu',
    date: '2024-11-06',
    type: 'collection',
    likes: 921,
    comments: 49,
    isVideo: false,
  },
];

export const storeProducts = [
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80',
  'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&q=80',
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&q=80',
  'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&q=80',
  'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&q=80',
  'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&q=80',
  'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80',
  'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=400&q=80',
  'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&q=80',
  'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400&q=80',
  'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&q=80',
];

export const sellerStories: SellerStory[] = [
  {
    id: 'ss1',
    seller: 'ModaStore',
    avatar: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=300&q=80',
    badge: 'Trend',
  },
  {
    id: 'ss2',
    seller: 'TeknoPlus',
    avatar: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&q=80',
    badge: 'Yeni',
  },
  {
    id: 'ss3',
    seller: 'EvDekor',
    avatar: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=300&q=80',
  },
  {
    id: 'ss4',
    seller: 'SneakerHub',
    avatar: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&q=80',
    badge: 'Canlı',
  },
  {
    id: 'ss5',
    seller: 'BeautyLab',
    avatar: 'https://images.unsplash.com/photo-1522335789203-aaa0db1ebcd1?w=300&q=80',
  },
  {
    id: 'ss6',
    seller: 'MiniMarket',
    avatar: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300&q=80',
  },
];

export const discoverSellers: DiscoverSeller[] = [
  {
    id: 'ds1',
    name: 'ModaStore Türkiye',
    username: '@modastoret',
    avatar: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=300&q=80',
    coverImage: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80',
    city: 'İstanbul',
    category: 'Moda',
    followers: '124.8B',
    rating: 4.8,
    headline: 'Yeni sezon giyim, kombin önerileri ve her gün yenilenen vitrin.',
    tags: ['Kadın', 'Erkek', 'Yeni sezon'],
    weeklyDrop: 'Bu hafta 86 yeni ürün',
    featured: true,
  },
  {
    id: 'ds2',
    name: 'TeknoPlus',
    username: '@teknoplus',
    avatar: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&q=80',
    coverImage: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80',
    city: 'Ankara',
    category: 'Elektronik',
    followers: '89.4B',
    rating: 4.9,
    headline: 'Telefon, aksesuar ve oyuncu ekipmanlarında hızlı teslimat.',
    tags: ['Telefon', 'Oyuncu', 'Aksesuar'],
    weeklyDrop: 'Bu hafta 24 kampanya',
    featured: true,
  },
  {
    id: 'ds3',
    name: 'EvDekor Studio',
    username: '@evdekorstudio',
    avatar: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=300&q=80',
    coverImage: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&q=80',
    city: 'İzmir',
    category: 'Ev & Yaşam',
    followers: '42.1B',
    rating: 4.7,
    headline: 'Minimal ev dekorasyonu ve küçük alan çözümleri.',
    tags: ['Dekor', 'Minimal', 'Aydınlatma'],
    weeklyDrop: 'Bu hafta 12 koleksiyon',
    featured: false,
  },
  {
    id: 'ds4',
    name: 'SneakerHub',
    username: '@sneakerhub',
    avatar: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&q=80',
    coverImage: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=80',
    city: 'Bursa',
    category: 'Ayakkabı',
    followers: '67.9B',
    rating: 4.8,
    headline: 'Sneaker drop günleri, sınırlı seri ve günlük kombinler.',
    tags: ['Sneaker', 'Limitli seri', 'Streetwear'],
    weeklyDrop: 'Bu hafta 9 drop',
    featured: false,
  },
  {
    id: 'ds5',
    name: 'BeautyLab TR',
    username: '@beautylabtr',
    avatar: 'https://images.unsplash.com/photo-1522335789203-aaa0db1ebcd1?w=300&q=80',
    coverImage: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80',
    city: 'İstanbul',
    category: 'Kozmetik',
    followers: '58.3B',
    rating: 4.6,
    headline: 'Cilt bakım rutinleri ve haftalık canlı ürün denemeleri.',
    tags: ['Cilt bakımı', 'Makyaj', 'Canlı yayın'],
    weeklyDrop: 'Bu hafta 14 yeni set',
    featured: false,
  },
];
