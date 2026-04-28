export type Product = {
  id: string;
  sellerId?: string;
  storeId?: string;
  title: string;
  brand: string;
  description?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  rating: number;
  reviewCount: number;
  favoriteCount: string;
  image: string;
  mediaUris?: string[];
  videoUri?: string;
  badge?: string;
  freeShipping?: boolean;
  category: string;
  condition?: string;
  location?: string;
  district?: string;
  delivery?: string[];
  availableSizes?: string[];
  availableColors?: string[];
  attributes?: Array<{ label: string; value: string }>;
  stock?: number;
  whatsapp?: string;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

export type Story = {
  id: string;
  backendId?: string;
  productId?: string;
  seller: string;
  sellerKey?: string;
  storeName?: string;
  ownerId?: string;
  createdAt?: string;
  expiresAt?: string;
  isArchived?: boolean;
  productTitle?: string;
  productDescription?: string;
  priceTag?: string;
  likeCount?: number;
  commentCount?: number;
  badge?: string;
  image: string;
  isAdd?: boolean;
  seen?: boolean;
};

export const categories: Category[] = [
  { id: 'women', name: 'Kadın', icon: '👗', color: '#3B82F6' },
  { id: 'men', name: 'Erkek', icon: '👔', color: '#1E5FC6' },
  { id: 'mother-child', name: 'Anne & Çocuk', icon: '🧸', color: '#60A5FA' },
  { id: 'home', name: 'Ev & Yaşam', icon: '🏠', color: '#0EA5E9' },
  { id: 'supermarket', name: 'Market', icon: '🛒', color: '#2563EB' },
  { id: 'cosmetics', name: 'Kozmetik', icon: '💄', color: '#7C3AED' },
  { id: 'shoes-bags', name: 'Ayakkabı & Çanta', icon: '👜', color: '#1D4ED8' },
  { id: 'electronics', name: 'Elektronik', icon: '📱', color: '#0F766E' },
  { id: 'watches', name: 'Saat & Aksesuar', icon: '⌚', color: '#B45309' },
  { id: 'sports', name: 'Spor & Outdoor', icon: '⚽', color: '#2563EB' },
];

export const stories: Story[] = [
  { id: 'add', seller: 'Hikaye Ekle', image: '', isAdd: true },
  { id: 's1', seller: 'ModaStore', image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&q=80' },
  { id: 's2', seller: 'TeknoPlus', image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=200&q=80' },
  { id: 's3', seller: 'EvDekor', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=200&q=80' },
  { id: 's4', seller: 'SporMax', image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200&q=80' },
  { id: 's5', seller: 'Güzellik', image: 'https://images.unsplash.com/photo-1522335789203-aaa0db1ebcd1?w=200&q=80' },
  { id: 's6', seller: 'Ayakkabı', image: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=200&q=80' },
  { id: 's7', seller: 'ÇocukDünyası', image: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=200&q=80' },
  { id: 's8', seller: 'MarketExpress', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&q=80' },
];

export const discountTiers = [
  { id: '5', label: '5%+', color: '#DBEAFE', textColor: '#1E40AF' },
  { id: '10', label: '10%+', color: '#BFDBFE', textColor: '#1E3A8A' },
  { id: '30', label: '30%+', color: '#93C5FD', textColor: '#1E3A8A' },
  { id: '50', label: '50%+', color: '#1E5FC6', textColor: '#FFFFFF' },
];

export const heroBanners = [
  {
    id: '1',
    title: 'Mega Flash İndirim',
    subtitle: '%70\'e varan indirimler',
    cta: 'Şimdi Al',
    bgGradient: ['#1E5FC6', '#3B82F6'],
    emoji: '🛍️',
  },
  {
    id: '2',
    title: 'Yeni Sezon',
    subtitle: 'Her gün yeni ürünler',
    cta: 'Keşfet',
    bgGradient: ['#2563EB', '#60A5FA'],
    emoji: '✨',
  },
  {
    id: '3',
    title: 'Ücretsiz Kargo',
    subtitle: '150₺ üzeri siparişlerde',
    cta: 'İncele',
    bgGradient: ['#0F766E', '#0EA5E9'],
    emoji: '🚚',
  },
];

export const products: Product[] = [
  {
    id: 'p1',
    title: 'Oversize Pamuklu Tişört',
    brand: 'Koton',
    price: 149.99,
    originalPrice: 299.99,
    discount: 50,
    rating: 4.6,
    reviewCount: 1243,
    favoriteCount: '12.4B',
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80',
    badge: 'Çok Satan',
    freeShipping: true,
    category: 'women',
    stock: 12,
  },
  {
    id: 'p2',
    title: 'Kablosuz Bluetooth Kulaklık',
    brand: 'Xiaomi',
    price: 599.00,
    originalPrice: 899.00,
    discount: 33,
    rating: 4.8,
    reviewCount: 8732,
    favoriteCount: '45.2B',
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80',
    badge: 'Flash',
    freeShipping: true,
    category: 'electronics',
    stock: 7,
  },
  {
    id: 'p3',
    title: 'Kadın Spor Ayakkabı',
    brand: 'Adidas',
    price: 1299.00,
    originalPrice: 2199.00,
    discount: 41,
    rating: 4.7,
    reviewCount: 2104,
    favoriteCount: '8.9B',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
    freeShipping: true,
    category: 'shoes-bags',
    stock: 5,
  },
  {
    id: 'p4',
    title: 'Mat Likit Ruj Seti',
    brand: 'Maybelline',
    price: 89.90,
    originalPrice: 159.90,
    discount: 44,
    rating: 4.5,
    reviewCount: 3421,
    favoriteCount: '21.7B',
    image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600&q=80',
    badge: 'Çok Satan',
    category: 'cosmetics',
    stock: 18,
  },
  {
    id: 'p5',
    title: 'Akıllı Saat Series 9',
    brand: 'Apple',
    price: 12999.00,
    originalPrice: 14999.00,
    discount: 13,
    rating: 4.9,
    reviewCount: 5632,
    favoriteCount: '67.3B',
    image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80',
    freeShipping: true,
    category: 'electronics',
    stock: 4,
  },
  {
    id: 'p6',
    title: 'Deri Çapraz Çanta',
    brand: 'Mango',
    price: 449.99,
    originalPrice: 799.99,
    discount: 44,
    rating: 4.4,
    reviewCount: 892,
    favoriteCount: '5.6B',
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80',
    freeShipping: true,
    category: 'shoes-bags',
    stock: 9,
  },
  {
    id: 'p7',
    title: 'Seramik Kupa Seti (4\'lü)',
    brand: 'Karaca',
    price: 199.00,
    originalPrice: 349.00,
    discount: 43,
    rating: 4.6,
    reviewCount: 1567,
    favoriteCount: '9.1B',
    image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&q=80',
    category: 'home',
    stock: 14,
  },
  {
    id: 'p8',
    title: 'Erkek Slim Fit Kot Pantolon',
    brand: 'LC Waikiki',
    price: 249.99,
    originalPrice: 449.99,
    discount: 44,
    rating: 4.3,
    reviewCount: 2341,
    favoriteCount: '14.2B',
    image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&q=80',
    freeShipping: true,
    category: 'men',
    stock: 8,
  },
  {
    id: 'p9',
    title: 'Oyuncu Mekanik Klavye RGB',
    brand: 'Logitech',
    price: 1899.00,
    originalPrice: 2799.00,
    discount: 32,
    rating: 4.7,
    reviewCount: 1876,
    favoriteCount: '7.4B',
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&q=80',
    badge: 'Flash',
    freeShipping: true,
    category: 'electronics',
    stock: 6,
  },
  {
    id: 'p10',
    title: 'Kaydırmaz Yoga Matı',
    brand: 'Decathlon',
    price: 299.00,
    originalPrice: 499.00,
    discount: 40,
    rating: 4.8,
    reviewCount: 4231,
    favoriteCount: '18.3B',
    image: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&q=80',
    freeShipping: true,
    category: 'sports',
    stock: 15,
  },
  {
    id: 'p11',
    title: 'Bebek Organik Pamuk Tulum',
    brand: 'Mothercare',
    price: 129.99,
    originalPrice: 229.99,
    discount: 43,
    rating: 4.9,
    reviewCount: 987,
    favoriteCount: '3.8B',
    image: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=600&q=80',
    badge: 'Çok Satan',
    category: 'mother-child',
    stock: 10,
  },
  {
    id: 'p12',
    title: 'Paslanmaz Çelik Matara',
    brand: 'Stanley',
    price: 599.00,
    originalPrice: 899.00,
    discount: 33,
    rating: 4.7,
    reviewCount: 2987,
    favoriteCount: '16.8B',
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80',
    freeShipping: true,
    category: 'sports',
    stock: 11,
  },
];

export const trendingSearches = [
  'iPhone 15',
  'kışlık mont',
  'nike spor ayakkabı',
  'air fryer',
  'samsung galaxy',
  'sırt çantası',
  'parfüm',
  'airpods',
];
