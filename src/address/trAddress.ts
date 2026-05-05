export type Province = {
  code: string;
  name: string;
};

export type AddressSuggestion = {
  province: Province;
  district: string;
  confidence: number;
  normalizedAddress: string;
};

const TR_PROVINCES: Province[] = [
  { code: '01', name: 'Adana' },
  { code: '02', name: 'Adiyaman' },
  { code: '03', name: 'Afyonkarahisar' },
  { code: '04', name: 'Agri' },
  { code: '05', name: 'Amasya' },
  { code: '06', name: 'Ankara' },
  { code: '07', name: 'Antalya' },
  { code: '08', name: 'Artvin' },
  { code: '09', name: 'Aydin' },
  { code: '10', name: 'Balikesir' },
  { code: '11', name: 'Bilecik' },
  { code: '12', name: 'Bingol' },
  { code: '13', name: 'Bitlis' },
  { code: '14', name: 'Bolu' },
  { code: '15', name: 'Burdur' },
  { code: '16', name: 'Bursa' },
  { code: '17', name: 'Canakkale' },
  { code: '18', name: 'Cankiri' },
  { code: '19', name: 'Corum' },
  { code: '20', name: 'Denizli' },
  { code: '21', name: 'Diyarbakir' },
  { code: '22', name: 'Edirne' },
  { code: '23', name: 'Elazig' },
  { code: '24', name: 'Erzincan' },
  { code: '25', name: 'Erzurum' },
  { code: '26', name: 'Eskisehir' },
  { code: '27', name: 'Gaziantep' },
  { code: '28', name: 'Giresun' },
  { code: '29', name: 'Gumushane' },
  { code: '30', name: 'Hakkari' },
  { code: '31', name: 'Hatay' },
  { code: '32', name: 'Isparta' },
  { code: '33', name: 'Mersin' },
  { code: '34', name: 'Istanbul' },
  { code: '35', name: 'Izmir' },
  { code: '36', name: 'Kars' },
  { code: '37', name: 'Kastamonu' },
  { code: '38', name: 'Kayseri' },
  { code: '39', name: 'Kirklareli' },
  { code: '40', name: 'Kirsehir' },
  { code: '41', name: 'Kocaeli' },
  { code: '42', name: 'Konya' },
  { code: '43', name: 'Kutahya' },
  { code: '44', name: 'Malatya' },
  { code: '45', name: 'Manisa' },
  { code: '46', name: 'Kahramanmaras' },
  { code: '47', name: 'Mardin' },
  { code: '48', name: 'Mugla' },
  { code: '49', name: 'Mus' },
  { code: '50', name: 'Nevsehir' },
  { code: '51', name: 'Nigde' },
  { code: '52', name: 'Ordu' },
  { code: '53', name: 'Rize' },
  { code: '54', name: 'Sakarya' },
  { code: '55', name: 'Samsun' },
  { code: '56', name: 'Siirt' },
  { code: '57', name: 'Sinop' },
  { code: '58', name: 'Sivas' },
  { code: '59', name: 'Tekirdag' },
  { code: '60', name: 'Tokat' },
  { code: '61', name: 'Trabzon' },
  { code: '62', name: 'Tunceli' },
  { code: '63', name: 'Sanliurfa' },
  { code: '64', name: 'Usak' },
  { code: '65', name: 'Van' },
  { code: '66', name: 'Yozgat' },
  { code: '67', name: 'Zonguldak' },
  { code: '68', name: 'Aksaray' },
  { code: '69', name: 'Bayburt' },
  { code: '70', name: 'Karaman' },
  { code: '71', name: 'Kirikkale' },
  { code: '72', name: 'Batman' },
  { code: '73', name: 'Sirnak' },
  { code: '74', name: 'Bartin' },
  { code: '75', name: 'Ardahan' },
  { code: '76', name: 'Igdir' },
  { code: '77', name: 'Yalova' },
  { code: '78', name: 'Karabuk' },
  { code: '79', name: 'Kilis' },
  { code: '80', name: 'Osmaniye' },
  { code: '81', name: 'Duzce' },
];

const DISTRICT_OVERRIDES_BY_PROVINCE_CODE: Record<string, string[]> = {
  '34': ['Kadikoy', 'Besiktas', 'Sisli', 'Bakirkoy', 'Umraniye'],
  '06': ['Cankaya', 'Kecioren', 'Etimesgut', 'Yenimahalle', 'Mamak'],
  '35': ['Bornova', 'Karsiyaka', 'Buca', 'Konak', 'Bayrakli'],
  '16': ['Nilufer', 'Osmangazi', 'Yildirim', 'Mudanya', 'Inegol'],
  '07': ['Muratpasa', 'Kepez', 'Konyaalti', 'Alanya', 'Manavgat'],
};

const STOP_WORDS = new Set(['turkiye', 'mahalle', 'koy', 'cadde', 'sokak', 'bulvar', 'meydan', 'no', 'daire']);

function normalizeToken(input: string) {
  return input
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

export function normalizeTrAddress(input: string): string {
  return normalizeToken(input)
    .replace(/\bmah\.?\b/g, 'mahalle')
    .replace(/\bmh\.?\b/g, 'mahalle')
    .replace(/\bcd\.?\b/g, 'cadde')
    .replace(/\bcad\.?\b/g, 'cadde')
    .replace(/\bsk\.?\b/g, 'sokak')
    .replace(/\bsok\.?\b/g, 'sokak')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(input: string) {
  return normalizeTrAddress(input)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function formatDisplayName(normalizedName: string) {
  return normalizedName
    .split(' ')
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
}

function getDistrictsByProvinceCode(provinceCode: string) {
  const districts = DISTRICT_OVERRIDES_BY_PROVINCE_CODE[provinceCode] ?? ['Merkez'];
  const normalized = [...new Set([...districts, 'Diger'])];
  return normalized.map((district) => formatDisplayName(normalizeTrAddress(district)));
}

export function getProvinceOptions() {
  return TR_PROVINCES.map((province) => ({
    ...province,
    name: formatDisplayName(normalizeTrAddress(province.name)),
  }));
}

export function getProvinceNames() {
  return getProvinceOptions().map((province) => province.name);
}

export function getDistrictNamesByProvinceName(provinceName: string) {
  const normalizedProvinceName = normalizeTrAddress(provinceName);
  const province = TR_PROVINCES.find((item) => normalizeTrAddress(item.name) === normalizedProvinceName);

  if (!province) {
    return ['Merkez', 'Diğer'];
  }

  return getDistrictsByProvinceCode(province.code);
}

export function resolveAddressInput(query: string, limit = 5): AddressSuggestion[] {
  const tokens = tokenize(query);

  if (tokens.length === 0) {
    return [];
  }

  const suggestions: AddressSuggestion[] = [];

  for (const province of getProvinceOptions()) {
    const provinceNameNormalized = normalizeTrAddress(province.name);
    const provinceMatched = tokens.some((token) => provinceNameNormalized.startsWith(token) || provinceNameNormalized.includes(token));

    if (!provinceMatched) {
      continue;
    }

    const districts = getDistrictNamesByProvinceName(province.name);

    for (const district of districts) {
      const districtNameNormalized = normalizeTrAddress(district);
      const districtMatched = tokens.some((token) => districtNameNormalized.startsWith(token) || districtNameNormalized.includes(token));

      let score = 0;
      if (provinceMatched) score += 30;
      if (districtMatched) score += 25;

      const numericTokens = tokens.filter((token) => /^\d+$/.test(token));
      if (numericTokens.length > 0) {
        score += 10;
      }

      if (score < 40) {
        continue;
      }

      const normalizedAddress = `${province.name}, ${district}`;

      suggestions.push({
        province,
        district,
        confidence: Math.min(score / 100, 0.99),
        normalizedAddress,
      });
    }
  }

  suggestions.sort((a, b) => b.confidence - a.confidence || a.normalizedAddress.localeCompare(b.normalizedAddress, 'tr-TR'));

  return suggestions.slice(0, limit);
}
