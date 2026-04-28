import { DataSource } from 'typeorm';
import { ProvinceEntity } from '../../modules/location/entities/province.entity';
import { normalizeAddressText } from '../../modules/location/utils/normalize.util';

const PROVINCES: Array<{ code: string; name: string }> = [
  { code: '01', name: 'Adana' }, { code: '02', name: 'Adiyaman' }, { code: '03', name: 'Afyonkarahisar' },
  { code: '04', name: 'Agri' }, { code: '05', name: 'Amasya' }, { code: '06', name: 'Ankara' },
  { code: '07', name: 'Antalya' }, { code: '08', name: 'Artvin' }, { code: '09', name: 'Aydin' },
  { code: '10', name: 'Balikesir' }, { code: '11', name: 'Bilecik' }, { code: '12', name: 'Bingol' },
  { code: '13', name: 'Bitlis' }, { code: '14', name: 'Bolu' }, { code: '15', name: 'Burdur' },
  { code: '16', name: 'Bursa' }, { code: '17', name: 'Canakkale' }, { code: '18', name: 'Cankiri' },
  { code: '19', name: 'Corum' }, { code: '20', name: 'Denizli' }, { code: '21', name: 'Diyarbakir' },
  { code: '22', name: 'Edirne' }, { code: '23', name: 'Elazig' }, { code: '24', name: 'Erzincan' },
  { code: '25', name: 'Erzurum' }, { code: '26', name: 'Eskisehir' }, { code: '27', name: 'Gaziantep' },
  { code: '28', name: 'Giresun' }, { code: '29', name: 'Gumushane' }, { code: '30', name: 'Hakkari' },
  { code: '31', name: 'Hatay' }, { code: '32', name: 'Isparta' }, { code: '33', name: 'Mersin' },
  { code: '34', name: 'Istanbul' }, { code: '35', name: 'Izmir' }, { code: '36', name: 'Kars' },
  { code: '37', name: 'Kastamonu' }, { code: '38', name: 'Kayseri' }, { code: '39', name: 'Kirklareli' },
  { code: '40', name: 'Kirsehir' }, { code: '41', name: 'Kocaeli' }, { code: '42', name: 'Konya' },
  { code: '43', name: 'Kutahya' }, { code: '44', name: 'Malatya' }, { code: '45', name: 'Manisa' },
  { code: '46', name: 'Kahramanmaras' }, { code: '47', name: 'Mardin' }, { code: '48', name: 'Mugla' },
  { code: '49', name: 'Mus' }, { code: '50', name: 'Nevsehir' }, { code: '51', name: 'Nigde' },
  { code: '52', name: 'Ordu' }, { code: '53', name: 'Rize' }, { code: '54', name: 'Sakarya' },
  { code: '55', name: 'Samsun' }, { code: '56', name: 'Siirt' }, { code: '57', name: 'Sinop' },
  { code: '58', name: 'Sivas' }, { code: '59', name: 'Tekirdag' }, { code: '60', name: 'Tokat' },
  { code: '61', name: 'Trabzon' }, { code: '62', name: 'Tunceli' }, { code: '63', name: 'Sanliurfa' },
  { code: '64', name: 'Usak' }, { code: '65', name: 'Van' }, { code: '66', name: 'Yozgat' },
  { code: '67', name: 'Zonguldak' }, { code: '68', name: 'Aksaray' }, { code: '69', name: 'Bayburt' },
  { code: '70', name: 'Karaman' }, { code: '71', name: 'Kirikkale' }, { code: '72', name: 'Batman' },
  { code: '73', name: 'Sirnak' }, { code: '74', name: 'Bartin' }, { code: '75', name: 'Ardahan' },
  { code: '76', name: 'Igdir' }, { code: '77', name: 'Yalova' }, { code: '78', name: 'Karabuk' },
  { code: '79', name: 'Kilis' }, { code: '80', name: 'Osmaniye' }, { code: '81', name: 'Duzce' },
];

export async function seedProvinces(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(ProvinceEntity);

  for (const item of PROVINCES) {
    const existing = await repo.findOne({ where: { code: item.code } });
    if (existing) continue;

    await repo.save(
      repo.create({
        code: item.code,
        name: item.name,
        normalizedName: normalizeAddressText(item.name),
      }),
    );
  }
}
