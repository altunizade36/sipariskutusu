import React from 'react';
import { AddressFormValues, District, Neighborhood, Province, Street } from '../../types/address';

type Props = {
  values: AddressFormValues;
  province?: Province;
  district?: District;
  neighborhood?: Neighborhood;
  street?: Street;
};

export function AddressPreviewCard({ values, province, district, neighborhood, street }: Props) {
  const summary = [
    province?.name,
    district?.name,
    neighborhood ? `${neighborhood.name} ${neighborhood.type}` : undefined,
    street?.name,
    values.buildingNo ? `No ${values.buildingNo}` : undefined,
    values.unitNo ? `Daire ${values.unitNo}` : undefined,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="rounded-lg border bg-gray-50 p-3 text-sm">
      <div className="font-semibold mb-1">Adres Ozeti</div>
      <div>{summary || values.fullText || 'Adres secilmedi'}</div>
    </div>
  );
}
