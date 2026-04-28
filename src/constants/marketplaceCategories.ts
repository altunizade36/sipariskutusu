export type MarketplaceCategory = {
  id: string;
  name: string;
  icon: string;
};

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  { id: 'women', name: 'Kadın', icon: '👗' },
  { id: 'men', name: 'Erkek', icon: '👔' },
  { id: 'mother-child', name: 'Anne & Çocuk', icon: '🧸' },
  { id: 'home', name: 'Ev & Yaşam', icon: '🏠' },
  { id: 'supermarket', name: 'Market', icon: '🛒' },
  { id: 'cosmetics', name: 'Kozmetik', icon: '💄' },
  { id: 'shoes-bags', name: 'Ayakkabı & Çanta', icon: '👜' },
  { id: 'electronics', name: 'Elektronik', icon: '📱' },
  { id: 'watches', name: 'Saat & Aksesuar', icon: '⌚' },
  { id: 'sports', name: 'Spor & Outdoor', icon: '⚽' },
];

export function getMarketplaceCategory(categoryId: string) {
  return MARKETPLACE_CATEGORIES.find((item) => item.id === categoryId) ?? MARKETPLACE_CATEGORIES[0];
}
