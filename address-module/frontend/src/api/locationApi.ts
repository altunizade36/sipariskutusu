import { AddressSearchResult, District, Neighborhood, Province, Street } from '../types/address';

const BASE_URL = '/locations';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

export const locationApi = {
  getProvinces: (): Promise<Province[]> => request('/provinces'),
  getDistricts: (provinceId: number): Promise<District[]> => request(`/districts?provinceId=${provinceId}`),
  getNeighborhoods: (districtId: number): Promise<Neighborhood[]> => request(`/neighborhoods?districtId=${districtId}`),
  getStreets: (neighborhoodId: number): Promise<Street[]> => request(`/streets?neighborhoodId=${neighborhoodId}`),
  searchAddress: (q: string, limit = 10): Promise<{ query: string; normalizedQuery: string; results: AddressSearchResult[] }> =>
    request(`/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  resolveAddress: (query: string): Promise<{ bestMatch: AddressSearchResult | null; alternatives: AddressSearchResult[] }> =>
    request('/resolve', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
};
