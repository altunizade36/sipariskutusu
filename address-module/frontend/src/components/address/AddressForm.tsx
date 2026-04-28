import React, { useMemo } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { AddressFormValues } from '../../types/address';
import { useAddressHierarchy } from '../../hooks/useAddressHierarchy';
import { AddressAutocompleteInput } from './AddressAutocompleteInput';
import { AddressPreviewCard } from './AddressPreviewCard';
import { DistrictSelect } from './DistrictSelect';
import { NeighborhoodSelect } from './NeighborhoodSelect';
import { ProvinceSelect } from './ProvinceSelect';
import { StreetSelect } from './StreetSelect';

const schema = z.object({
  mode: z.enum(['hierarchy', 'autocomplete']),
  provinceId: z.number().optional(),
  districtId: z.number().optional(),
  neighborhoodId: z.number().optional(),
  streetId: z.number().optional(),
  buildingNo: z.string().max(20).optional(),
  unitNo: z.string().max(20).optional(),
  fullText: z.string().max(180).optional(),
});

type Props = {
  onSubmit: (values: AddressFormValues) => void;
};

export function AddressForm({ onSubmit }: Props) {
  const form = useForm<AddressFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: 'hierarchy',
    },
  });

  const mode = form.watch('mode');
  const provinceId = form.watch('provinceId');
  const districtId = form.watch('districtId');
  const neighborhoodId = form.watch('neighborhoodId');
  const streetId = form.watch('streetId');

  const { provinces, districts, neighborhoods, streets } = useAddressHierarchy(provinceId, districtId, neighborhoodId);

  const selectedProvince = useMemo(() => provinces.find((x) => x.id === provinceId), [provinces, provinceId]);
  const selectedDistrict = useMemo(() => districts.find((x) => x.id === districtId), [districts, districtId]);
  const selectedNeighborhood = useMemo(() => neighborhoods.find((x) => x.id === neighborhoodId), [neighborhoods, neighborhoodId]);
  const selectedStreet = useMemo(() => streets.find((x) => x.id === streetId), [streets, streetId]);

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="flex gap-4">
        <label className="inline-flex items-center gap-2">
          <input type="radio" checked={mode === 'hierarchy'} onChange={() => form.setValue('mode', 'hierarchy')} />
          Kademeli Secim
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="radio" checked={mode === 'autocomplete'} onChange={() => form.setValue('mode', 'autocomplete')} />
          Otomatik Tamamlama
        </label>
      </div>

      {mode === 'hierarchy' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ProvinceSelect
            value={provinceId}
            options={provinces}
            onChange={(id) => {
              form.setValue('provinceId', id);
              form.setValue('districtId', undefined);
              form.setValue('neighborhoodId', undefined);
              form.setValue('streetId', undefined);
            }}
          />

          <DistrictSelect
            value={districtId}
            options={districts}
            disabled={!provinceId}
            onChange={(id) => {
              form.setValue('districtId', id);
              form.setValue('neighborhoodId', undefined);
              form.setValue('streetId', undefined);
            }}
          />

          <NeighborhoodSelect
            value={neighborhoodId}
            options={neighborhoods}
            disabled={!districtId}
            onChange={(id) => {
              form.setValue('neighborhoodId', id);
              form.setValue('streetId', undefined);
            }}
          />

          <StreetSelect
            value={streetId}
            options={streets}
            disabled={!neighborhoodId}
            onChange={(id) => form.setValue('streetId', id)}
          />

          <input
            placeholder="Bina no"
            className="rounded border px-3 py-2"
            value={form.watch('buildingNo') ?? ''}
            onChange={(e) => form.setValue('buildingNo', e.target.value)}
          />

          <input
            placeholder="Daire no"
            className="rounded border px-3 py-2"
            value={form.watch('unitNo') ?? ''}
            onChange={(e) => form.setValue('unitNo', e.target.value)}
          />
        </div>
      ) : (
        <AddressAutocompleteInput
          value={form.watch('fullText') ?? ''}
          onChange={(value) => form.setValue('fullText', value)}
          onSelect={(result) => {
            form.setValue('provinceId', result.province.id);
            form.setValue('districtId', result.district.id);
            form.setValue('neighborhoodId', result.neighborhood.id);
            form.setValue('streetId', result.street?.id);
            form.setValue('buildingNo', result.buildingNo);
            form.setValue('unitNo', result.unitNo);
          }}
        />
      )}

      <AddressPreviewCard
        values={form.getValues()}
        province={selectedProvince}
        district={selectedDistrict}
        neighborhood={selectedNeighborhood}
        street={selectedStreet}
      />

      <button type="submit" className="rounded bg-black text-white px-4 py-2">
        Adresi Kaydet
      </button>
    </form>
  );
}
