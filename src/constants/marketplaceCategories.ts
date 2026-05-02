export type MarketplaceSubcategory = {
  id: string;
  name: string;
  keywords: string[];
};

export type MarketplaceCategory = {
  id: string;
  name: string;
  icon: string;
  subcategories: MarketplaceSubcategory[];
};

export const ALL_SUBCATEGORY_ID = 'all';
export const OTHER_SUBCATEGORY_ID = 'other';

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  {
    id: 'women',
    name: 'Kadın',
    icon: '👗',
    subcategories: [
      { id: ALL_SUBCATEGORY_ID, name: 'Tümü', keywords: [] },
      { id: 'elbise', name: 'Elbise', keywords: ['elbise'] },
      { id: 'bluz-gomlek', name: 'Bluz & Gömlek', keywords: ['bluz', 'gömlek'] },
      { id: 'pantolon-jean', name: 'Pantolon & Jean', keywords: ['pantolon', 'jean', 'kot'] },
      { id: 'etek', name: 'Etek', keywords: ['etek'] },
      { id: 'ceket-mont', name: 'Ceket & Mont', keywords: ['ceket', 'mont', 'kaban'] },
      { id: 'ic-giyim', name: 'İç Giyim', keywords: ['iç giyim', 'sütyen', 'külot'] },
      { id: 'spor-giyim', name: 'Spor Giyim', keywords: ['spor giyim', 'tayt', 'eşofman'] },
      { id: 'tesettur', name: 'Tesettür', keywords: ['tesettür', 'ferace', 'şal'] },
      { id: 'ayakkabi', name: 'Ayakkabı', keywords: ['ayakkabı', 'sneaker', 'bot'] },
      { id: 'canta', name: 'Çanta', keywords: ['çanta'] },
      { id: 'aksesuar', name: 'Aksesuar', keywords: ['aksesuar'] },
      { id: OTHER_SUBCATEGORY_ID, name: 'Diğer', keywords: [] },
    ],
  },
  {
    id: 'men',
    name: 'Erkek',
    icon: '👔',
    subcategories: [
      { id: ALL_SUBCATEGORY_ID, name: 'Tümü', keywords: [] },
      { id: 'tisort', name: 'Tişört', keywords: ['tişört', 'tshirt'] },
      { id: 'gomlek', name: 'Gömlek', keywords: ['gömlek'] },
      { id: 'pantolon-jean', name: 'Pantolon & Jean', keywords: ['pantolon', 'jean', 'kot'] },
      { id: 'esofman', name: 'Eşofman', keywords: ['eşofman'] },
      { id: 'ceket-mont', name: 'Ceket & Mont', keywords: ['ceket', 'mont', 'kaban'] },
      { id: 'takim-elbise', name: 'Takım Elbise', keywords: ['takım elbise'] },
      { id: 'spor-giyim', name: 'Spor Giyim', keywords: ['spor giyim', 'forma'] },
      { id: 'ayakkabi', name: 'Ayakkabı', keywords: ['ayakkabı', 'sneaker', 'bot'] },
      { id: 'canta', name: 'Çanta', keywords: ['çanta'] },
      { id: 'aksesuar', name: 'Aksesuar', keywords: ['aksesuar'] },
      { id: OTHER_SUBCATEGORY_ID, name: 'Diğer', keywords: [] },
    ],
  },
  {
    id: 'mother-child',
    name: 'Anne & Çocuk',
    icon: '🧸',
    subcategories: [
      { id: ALL_SUBCATEGORY_ID, name: 'Tümü', keywords: [] },
      { id: 'bebek-giyim', name: 'Bebek Giyim', keywords: ['bebek giyim', 'zıbın', 'tulum'] },
      { id: 'cocuk-giyim', name: 'Çocuk Giyim', keywords: ['çocuk giyim'] },
      { id: 'oyuncak', name: 'Oyuncak', keywords: ['oyuncak'] },
      { id: 'bebek-bakim', name: 'Bebek Bakım', keywords: ['bebek bakım', 'biberon', 'emzik'] },
      { id: 'bebek-arabasi', name: 'Bebek Arabası', keywords: ['bebek arabası'] },
      { id: 'mama-sandalyesi', name: 'Mama Sandalyesi', keywords: ['mama sandalyesi'] },
      { id: 'okul-urunleri', name: 'Okul Ürünleri', keywords: ['okul ürünleri', 'kırtasiye'] },
      { id: OTHER_SUBCATEGORY_ID, name: 'Diğer', keywords: [] },
    ],
  },
  {
    id: 'home',
    name: 'Ev & Yaşam',
    icon: '🏠',
    subcategories: [
      { id: ALL_SUBCATEGORY_ID, name: 'Tümü', keywords: [] },
      { id: 'dekorasyon', name: 'Dekorasyon', keywords: ['dekorasyon', 'dekor'] },
      { id: 'mobilya', name: 'Mobilya', keywords: ['mobilya'] },
      { id: 'mutfak', name: 'Mutfak', keywords: ['mutfak'] },
      { id: 'ev-tekstili', name: 'Ev Tekstili', keywords: ['ev tekstili', 'nevresim', 'perde'] },
      { id: 'banyo', name: 'Banyo', keywords: ['banyo'] },
      { id: 'aydinlatma', name: 'Aydınlatma', keywords: ['aydınlatma', 'avize'] },
      { id: 'bahce-balkon', name: 'Bahçe & Balkon', keywords: ['bahçe', 'balkon'] },
      { id: OTHER_SUBCATEGORY_ID, name: 'Diğer', keywords: [] },
    ],
  },
  {
    id: 'electronics',
    name: 'Elektronik',
    icon: '📱',
    subcategories: [
      { id: ALL_SUBCATEGORY_ID, name: 'Tümü', keywords: [] },
      { id: 'telefon', name: 'Telefon', keywords: ['telefon', 'iphone', 'android'] },
      { id: 'bilgisayar', name: 'Bilgisayar', keywords: ['bilgisayar', 'laptop', 'notebook'] },
      { id: 'tablet', name: 'Tablet', keywords: ['tablet', 'ipad'] },
      { id: 'kulaklik', name: 'Kulaklık', keywords: ['kulaklık', 'headset'] },
      { id: 'akilli-saat', name: 'Akıllı Saat', keywords: ['akıllı saat', 'smartwatch'] },
      { id: 'kamera', name: 'Kamera', keywords: ['kamera'] },
      { id: 'oyun-konsolu', name: 'Oyun Konsolu', keywords: ['oyun konsolu', 'playstation', 'xbox'] },
      { id: 'elektronik-aksesuar', name: 'Elektronik Aksesuar', keywords: ['kılıf', 'şarj', 'kablo', 'aksesuar'] },
      { id: OTHER_SUBCATEGORY_ID, name: 'Diğer', keywords: [] },
    ],
  },
  {
    id: 'shoes-bags',
    name: 'Ayakkabı & Çanta',
    icon: '👜',
    subcategories: [
      { id: ALL_SUBCATEGORY_ID, name: 'Tümü', keywords: [] },
      { id: 'kadin-ayakkabi', name: 'Kadın Ayakkabı', keywords: ['kadın ayakkabı', 'topuklu', 'babet'] },
      { id: 'erkek-ayakkabi', name: 'Erkek Ayakkabı', keywords: ['erkek ayakkabı', 'loafer', 'klasik ayakkabı'] },
      { id: 'sneaker', name: 'Sneaker', keywords: ['sneaker'] },
      { id: 'bot-cizme', name: 'Bot & Çizme', keywords: ['bot', 'çizme'] },
      { id: 'terlik-sandalet', name: 'Terlik & Sandalet', keywords: ['terlik', 'sandalet'] },
      { id: 'el-cantasi', name: 'El Çantası', keywords: ['el çantası'] },
      { id: 'sirt-cantasi', name: 'Sırt Çantası', keywords: ['sırt çantası'] },
      { id: 'valiz-bavul', name: 'Valiz & Bavul', keywords: ['valiz', 'bavul'] },
      { id: 'cuzdan-kartlik', name: 'Cüzdan & Kartlık', keywords: ['cüzdan', 'kartlık'] },
      { id: OTHER_SUBCATEGORY_ID, name: 'Diğer', keywords: [] },
    ],
  },
  {
    id: 'cosmetics',
    name: 'Kozmetik',
    icon: '💄',
    subcategories: [
      { id: ALL_SUBCATEGORY_ID, name: 'Tümü', keywords: [] },
      { id: 'makyaj', name: 'Makyaj', keywords: ['makyaj', 'ruj', 'fondöten'] },
      { id: 'cilt-bakimi', name: 'Cilt Bakımı', keywords: ['cilt bakımı', 'serum', 'nemlendirici'] },
      { id: 'sac-bakimi', name: 'Saç Bakımı', keywords: ['saç bakımı', 'şampuan'] },
      { id: 'parfum', name: 'Parfüm', keywords: ['parfüm'] },
      { id: 'tirnak-urunleri', name: 'Tırnak Ürünleri', keywords: ['tırnak', 'oje'] },
      { id: 'kisisel-bakim', name: 'Kişisel Bakım', keywords: ['kişisel bakım'] },
      { id: OTHER_SUBCATEGORY_ID, name: 'Diğer', keywords: [] },
    ],
  },
  {
    id: 'watches',
    name: 'Saat & Aksesuar',
    icon: '⌚',
    subcategories: [
      { id: ALL_SUBCATEGORY_ID, name: 'Tümü', keywords: [] },
      { id: 'saat', name: 'Saat', keywords: ['saat', 'kol saati'] },
      { id: 'akilli-saat', name: 'Akıllı Saat', keywords: ['akıllı saat', 'smartwatch'] },
      { id: 'taki', name: 'Takı', keywords: ['takı', 'kolye', 'bileklik', 'yüzük'] },
      { id: 'gozluk', name: 'Gözlük', keywords: ['gözlük'] },
      { id: 'sapka', name: 'Şapka', keywords: ['şapka'] },
      { id: 'kemer', name: 'Kemer', keywords: ['kemer'] },
      { id: 'cuzdan', name: 'Cüzdan', keywords: ['cüzdan'] },
      { id: OTHER_SUBCATEGORY_ID, name: 'Diğer', keywords: [] },
    ],
  },
  {
    id: 'sports',
    name: 'Spor & Outdoor',
    icon: '⚽',
    subcategories: [
      { id: ALL_SUBCATEGORY_ID, name: 'Tümü', keywords: [] },
      { id: 'spor-giyim', name: 'Spor Giyim', keywords: ['spor giyim', 'forma'] },
      { id: 'fitness', name: 'Fitness', keywords: ['fitness', 'ağırlık'] },
      { id: 'kamp', name: 'Kamp', keywords: ['kamp', 'çadır'] },
      { id: 'outdoor', name: 'Outdoor', keywords: ['outdoor', 'trekking'] },
      { id: 'bisiklet', name: 'Bisiklet', keywords: ['bisiklet'] },
      { id: 'spor-ayakkabi', name: 'Spor Ayakkabı', keywords: ['spor ayakkabı', 'krampon'] },
      { id: 'spor-ekipmanlari', name: 'Spor Ekipmanları', keywords: ['spor ekipmanları', 'raket', 'top'] },
      { id: OTHER_SUBCATEGORY_ID, name: 'Diğer', keywords: [] },
    ],
  },
  {
    id: 'supermarket',
    name: 'Market',
    icon: '🛒',
    subcategories: [
      { id: ALL_SUBCATEGORY_ID, name: 'Tümü', keywords: [] },
      { id: 'gida', name: 'Gıda', keywords: ['gıda', 'bakliyat'] },
      { id: 'icecek', name: 'İçecek', keywords: ['içecek', 'su', 'meyve suyu'] },
      { id: 'temizlik', name: 'Temizlik', keywords: ['temizlik', 'deterjan'] },
      { id: 'kisisel-bakim', name: 'Kişisel Bakım', keywords: ['kişisel bakım'] },
      { id: 'ev-tuketim', name: 'Ev Tüketim', keywords: ['ev tüketim'] },
      { id: 'pet-urunleri', name: 'Pet Ürünleri', keywords: ['pet ürünleri', 'kedi maması', 'köpek maması'] },
      { id: OTHER_SUBCATEGORY_ID, name: 'Diğer', keywords: [] },
    ],
  },
  {
    id: 'books-hobby',
    name: 'Kitap & Hobi',
    icon: '📚',
    subcategories: [
      { id: ALL_SUBCATEGORY_ID, name: 'Tümü', keywords: [] },
      { id: 'kitap', name: 'Kitap', keywords: ['kitap', 'roman'] },
      { id: 'kirtasiye', name: 'Kırtasiye', keywords: ['kırtasiye', 'defter', 'kalem'] },
      { id: 'oyuncak', name: 'Oyuncak', keywords: ['oyuncak'] },
      { id: 'koleksiyon', name: 'Koleksiyon', keywords: ['koleksiyon', 'antika'] },
      { id: 'muzik-aleti', name: 'Müzik Aleti', keywords: ['müzik aleti', 'gitar', 'piyano'] },
      { id: 'el-sanatlari', name: 'El Sanatları', keywords: ['el sanatları', 'hobi'] },
      { id: OTHER_SUBCATEGORY_ID, name: 'Diğer', keywords: [] },
    ],
  },
  {
    id: 'automotive',
    name: 'Otomotiv',
    icon: '🚗',
    subcategories: [
      { id: ALL_SUBCATEGORY_ID, name: 'Tümü', keywords: [] },
      { id: 'oto-aksesuar', name: 'Oto Aksesuar', keywords: ['oto aksesuar'] },
      { id: 'motosiklet-aksesuar', name: 'Motosiklet Aksesuar', keywords: ['motosiklet aksesuar'] },
      { id: 'yedek-parca', name: 'Yedek Parça', keywords: ['yedek parça'] },
      { id: 'bakim-urunleri', name: 'Bakım Ürünleri', keywords: ['bakım ürünleri', 'motor yağı'] },
      { id: 'lastik-jant', name: 'Lastik & Jant', keywords: ['lastik', 'jant'] },
      { id: OTHER_SUBCATEGORY_ID, name: 'Diğer', keywords: [] },
    ],
  },
  {
    id: 'pet',
    name: 'Pet Shop',
    icon: '🐾',
    subcategories: [
      { id: ALL_SUBCATEGORY_ID, name: 'Tümü', keywords: [] },
      { id: 'kedi-urunleri', name: 'Kedi Ürünleri', keywords: ['kedi ürünleri', 'kedi maması'] },
      { id: 'kopek-urunleri', name: 'Köpek Ürünleri', keywords: ['köpek ürünleri', 'köpek maması'] },
      { id: 'kus-urunleri', name: 'Kuş Ürünleri', keywords: ['kuş ürünleri'] },
      { id: 'balik-akvaryum', name: 'Balık & Akvaryum', keywords: ['balık', 'akvaryum'] },
      { id: 'mama', name: 'Mama', keywords: ['mama'] },
      { id: 'aksesuar', name: 'Aksesuar', keywords: ['aksesuar'] },
      { id: OTHER_SUBCATEGORY_ID, name: 'Diğer', keywords: [] },
    ],
  },
];

export function getMarketplaceCategory(categoryId: string) {
  return MARKETPLACE_CATEGORIES.find((item) => item.id === categoryId) ?? MARKETPLACE_CATEGORIES[0];
}
