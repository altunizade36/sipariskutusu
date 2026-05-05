import { DataSource } from 'typeorm';
import { DistrictEntity } from '../../modules/location/entities/district.entity';
import { ProvinceEntity } from '../../modules/location/entities/province.entity';
import { normalizeAddressText } from '../../modules/location/utils/normalize.util';

type SeedDistrict = { provinceCode: string; code: string; name: string };

const DISTRICTS: SeedDistrict[] = [
  { provinceCode: '34', code: '34016', name: 'Kadikoy' },
  { provinceCode: '34', code: '34019', name: 'Besiktas' },
  { provinceCode: '34', code: '34023', name: 'Sisli' },
  { provinceCode: '06', code: '06001', name: 'Cankaya' },
  { provinceCode: '06', code: '06002', name: 'Kecioren' },
  { provinceCode: '06', code: '06003', name: 'Yenimahalle' },
  { provinceCode: '35', code: '35001', name: 'Konak' },
  { provinceCode: '35', code: '35002', name: 'Karsiyaka' },
  { provinceCode: '35', code: '35003', name: 'Bornova' },
  { provinceCode: '16', code: '16001', name: 'Osmangazi' },
  { provinceCode: '16', code: '16002', name: 'Nilufer' },
  { provinceCode: '07', code: '07001', name: 'Muratpasa' },
  { provinceCode: '07', code: '07002', name: 'Kepez' },
  { provinceCode: '42', code: '42001', name: 'Selcuklu' },
  { provinceCode: '42', code: '42002', name: 'Meram' },
  { provinceCode: '27', code: '27001', name: 'Sehitkamil' },
  { provinceCode: '27', code: '27002', name: 'Sahinbey' },
  { provinceCode: '01', code: '01001', name: 'Seyhan' },
  { provinceCode: '01', code: '01002', name: 'Cukurova' },
  { provinceCode: '33', code: '33001', name: 'YeniSehir' },
  { provinceCode: '33', code: '33002', name: 'Mezitli' },
  { provinceCode: '21', code: '21001', name: 'Baglar' },
  { provinceCode: '21', code: '21002', name: 'Kayapinar' },
];

export async function seedDistricts(dataSource: DataSource): Promise<void> {
  const provinceRepo = dataSource.getRepository(ProvinceEntity);
  const districtRepo = dataSource.getRepository(DistrictEntity);

  for (const item of DISTRICTS) {
    const province = await provinceRepo.findOne({ where: { code: item.provinceCode } });
    if (!province) continue;

    const existing = await districtRepo.findOne({ where: { code: item.code } });
    if (existing) continue;

    await districtRepo.save(
      districtRepo.create({
        provinceId: province.id,
        code: item.code,
        name: item.name,
        normalizedName: normalizeAddressText(item.name),
      }),
    );
  }
}
