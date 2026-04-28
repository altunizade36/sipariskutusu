import { DataSource } from 'typeorm';
import { DistrictEntity } from '../../modules/location/entities/district.entity';
import { NeighborhoodEntity } from '../../modules/location/entities/neighborhood.entity';
import { normalizeAddressText } from '../../modules/location/utils/normalize.util';

type SeedNeighborhood = {
  districtCode: string;
  code: string;
  name: string;
  type: 'mahalle' | 'koy';
};

const NEIGHBORHOODS: SeedNeighborhood[] = [
  { districtCode: '34016', code: '34016001', name: 'Caferaga', type: 'mahalle' },
  { districtCode: '34016', code: '34016002', name: 'Moda', type: 'mahalle' },
  { districtCode: '34019', code: '34019001', name: 'Levent', type: 'mahalle' },
  { districtCode: '06001', code: '06001001', name: 'Birlik', type: 'mahalle' },
  { districtCode: '06001', code: '06001002', name: 'Kizilay', type: 'mahalle' },
  { districtCode: '35002', code: '35002001', name: 'Bostanli', type: 'mahalle' },
  { districtCode: '35001', code: '35001001', name: 'Alsancak', type: 'mahalle' },
  { districtCode: '16001', code: '16001001', name: 'Altiparmak', type: 'mahalle' },
  { districtCode: '07001', code: '07001001', name: 'Fener', type: 'mahalle' },
  { districtCode: '42001', code: '42001001', name: 'Sille', type: 'koy' },
  { districtCode: '27002', code: '27002001', name: 'Karatas', type: 'mahalle' },
  { districtCode: '01001', code: '01001001', name: 'Reşatbey', type: 'mahalle' },
  { districtCode: '33002', code: '33002001', name: 'Tece', type: 'mahalle' },
  { districtCode: '21002', code: '21002001', name: 'Diclekent', type: 'mahalle' },
];

export async function seedNeighborhoods(dataSource: DataSource): Promise<void> {
  const districtRepo = dataSource.getRepository(DistrictEntity);
  const neighborhoodRepo = dataSource.getRepository(NeighborhoodEntity);

  for (const item of NEIGHBORHOODS) {
    const district = await districtRepo.findOne({ where: { code: item.districtCode } });
    if (!district) continue;

    const existing = await neighborhoodRepo.findOne({ where: { code: item.code } });
    if (existing) continue;

    await neighborhoodRepo.save(
      neighborhoodRepo.create({
        provinceId: district.provinceId,
        districtId: district.id,
        code: item.code,
        name: item.name,
        normalizedName: normalizeAddressText(item.name),
        type: item.type,
      }),
    );
  }
}
