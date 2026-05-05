export const ADDRESS_SCORE_WEIGHTS = {
  province: 0.3,
  district: 0.25,
  neighborhood: 0.2,
  street: 0.15,
  buildingNo: 0.07,
  unitNo: 0.03,
} as const;

export const ADDRESS_SEARCH_LIMIT_DEFAULT = 10;
export const ADDRESS_SEARCH_LIMIT_MAX = 20;
export const ADDRESS_QUERY_MIN_LENGTH = 3;
export const ADDRESS_QUERY_MAX_LENGTH = 180;

export const ADDRESS_CACHE_TTL_SECONDS = 120;
export const POPULAR_QUERY_CACHE_KEY = 'address:popular:queries';

export const LOCATION_RATE_LIMIT_PROVINCES_MAX = Number(process.env.LOCATION_RATE_LIMIT_PROVINCES_MAX ?? 120);
export const LOCATION_RATE_LIMIT_DISTRICTS_MAX = Number(process.env.LOCATION_RATE_LIMIT_DISTRICTS_MAX ?? 180);
export const LOCATION_RATE_LIMIT_NEIGHBORHOODS_MAX = Number(process.env.LOCATION_RATE_LIMIT_NEIGHBORHOODS_MAX ?? 200);
export const LOCATION_RATE_LIMIT_STREETS_MAX = Number(process.env.LOCATION_RATE_LIMIT_STREETS_MAX ?? 200);
export const LOCATION_RATE_LIMIT_SEARCH_MAX = Number(process.env.LOCATION_RATE_LIMIT_SEARCH_MAX ?? 150);
export const LOCATION_RATE_LIMIT_RESOLVE_MAX = Number(process.env.LOCATION_RATE_LIMIT_RESOLVE_MAX ?? 80);
export const LOCATION_RATE_LIMIT_VALIDATE_MAX = Number(process.env.LOCATION_RATE_LIMIT_VALIDATE_MAX ?? 90);
export const LOCATION_RATE_LIMIT_ADDRESS_CREATE_MAX = Number(process.env.LOCATION_RATE_LIMIT_ADDRESS_CREATE_MAX ?? 40);
export const LOCATION_RATE_LIMIT_ADDRESS_DETAIL_MAX = Number(process.env.LOCATION_RATE_LIMIT_ADDRESS_DETAIL_MAX ?? 100);
export const LOCATION_RATE_LIMIT_WINDOW_SECONDS = Number(process.env.LOCATION_RATE_LIMIT_WINDOW_SECONDS ?? 60);

export const COMMON_ABBREVIATIONS: Record<string, string> = {
  mah: 'mahalle',
  'mah.': 'mahalle',
  mh: 'mahalle',
  'mh.': 'mahalle',
  cd: 'cadde',
  'cd.': 'cadde',
  cad: 'cadde',
  'cad.': 'cadde',
  sk: 'sokak',
  'sk.': 'sokak',
  sok: 'sokak',
  'sok.': 'sokak',
  bulv: 'bulvar',
  'bulv.': 'bulvar',
  blv: 'bulvar',
  'blv.': 'bulvar',
  apt: 'apartmani',
  'apt.': 'apartmani',
  'no:': 'no',
  'd:': 'daire',
};
