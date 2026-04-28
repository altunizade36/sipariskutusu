export type Province = {
  id: number;
  code: string;
  name: string;
};

export type District = {
  id: number;
  provinceId: number;
  code: string;
  name: string;
};

export type Neighborhood = {
  id: number;
  provinceId: number;
  districtId: number;
  code: string;
  name: string;
  type: 'mahalle' | 'koy';
};

export type Street = {
  id: number;
  provinceId: number;
  districtId: number;
  neighborhoodId: number;
  code?: string | null;
  name: string;
  type: 'cadde' | 'sokak' | 'bulvar' | 'meydan' | 'kume evler' | 'diger';
};

export type AddressSearchResult = {
  id?: number;
  province: Province;
  district: District;
  neighborhood: Neighborhood;
  street?: Street | null;
  buildingNo?: string;
  unitNo?: string;
  confidence: number;
  matchedParts: {
    province: boolean;
    district: boolean;
    neighborhood: boolean;
    street: boolean;
    buildingNo: boolean;
    unitNo: boolean;
  };
};

export type AddressFormValues = {
  mode: 'hierarchy' | 'autocomplete';
  provinceId?: number;
  districtId?: number;
  neighborhoodId?: number;
  streetId?: number;
  buildingNo?: string;
  unitNo?: string;
  fullText?: string;
};
