import { DataSource } from 'typeorm';
import { DistrictEntity } from '../../modules/location/entities/district.entity';
import { NeighborhoodEntity } from '../../modules/location/entities/neighborhood.entity';
import { StreetEntity } from '../../modules/location/entities/street.entity';
import { normalizeAddressText } from '../../modules/location/utils/normalize.util';

type SeedStreet = {
  neighborhoodCode: string;
  districtCode: string;
  code: string;
  name: string;
  type: StreetEntity['type'];
};

const STREETS: SeedStreet[] = [
  { neighborhoodCode: '34016001', districtCode: '34016', code: '3401600101', name: 'Moda Caddesi', type: 'cadde' },
  { neighborhoodCode: '34016001', districtCode: '34016', code: '3401600102', name: 'Muvakkithane Sokak', type: 'sokak' },
  { neighborhoodCode: '35002001', districtCode: '35002', code: '3500200101', name: '1810 Sokak', type: 'sokak' },
  { neighborhoodCode: '06001002', districtCode: '06001', code: '0600100201', name: 'Ataturk Bulvari', type: 'bulvar' },
  { neighborhoodCode: '16001001', districtCode: '16001', code: '1600100101', name: 'Altiparmak Caddesi', type: 'cadde' },
  { neighborhoodCode: '07001001', districtCode: '07001', code: '0700100101', name: 'Tekelioglu Caddesi', type: 'cadde' },
  { neighborhoodCode: '42001001', districtCode: '42001', code: '4200100101', name: 'Sille Meydan', type: 'meydan' },
  { neighborhoodCode: '27002001', districtCode: '27002', code: '2700200101', name: 'Karatas Sokak', type: 'sokak' },
  { neighborhoodCode: '01001001', districtCode: '01001', code: '0100100101', name: 'Inonu Caddesi', type: 'cadde' },
  { neighborhoodCode: '21002001', districtCode: '21002', code: '2100200101', name: '75. Sokak', type: 'sokak' },
];

export async function seedStreets(dataSource: DataSource): Promise<void> {
  const neighborhoodRepo = dataSource.getRepository(NeighborhoodEntity);
  const districtRepo = dataSource.getRepository(DistrictEntity);
  const streetRepo = dataSource.getRepository(StreetEntity);

  for (const item of STREETS) {
    const neighborhood = await neighborhoodRepo.findOne({ where: { code: item.neighborhoodCode } });
    if (!neighborhood) continue;

    const district = await districtRepo.findOne({ where: { code: item.districtCode } });
    if (!district) continue;

    const existing = await streetRepo.findOne({ where: { code: item.code } });
    if (existing) continue;

    await streetRepo.save(
      streetRepo.create({
        provinceId: neighborhood.provinceId,
        districtId: district.id,
        neighborhoodId: neighborhood.id,
        code: item.code,
        name: item.name,
        normalizedName: normalizeAddressText(item.name),
        type: item.type,
      }),
    );
  }
}
