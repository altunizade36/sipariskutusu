export type MatchedParts = {
  province: boolean;
  district: boolean;
  neighborhood: boolean;
  street: boolean;
  buildingNo: boolean;
  unitNo: boolean;
};

export type AddressCandidate = {
  provinceId: number;
  provinceName: string;
  districtId: number;
  districtName: string;
  neighborhoodId: number;
  neighborhoodName: string;
  neighborhoodType: 'mahalle' | 'koy';
  streetId?: number | null;
  streetName?: string | null;
  streetType?: string | null;
};

export type AddressMatchResult = {
  candidate: AddressCandidate;
  buildingNo?: string;
  unitNo?: string;
  confidence: number;
  matchedParts: MatchedParts;
  debug: {
    normalizedQuery: string;
    tokenCount: number;
    notes: string[];
  };
};
