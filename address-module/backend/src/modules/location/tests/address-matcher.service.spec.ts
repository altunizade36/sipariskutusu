import { AddressMatcherService } from '../services/address-matcher.service';
import { AddressNormalizationService } from '../services/address-normalization.service';
import { AddressParserService } from '../services/address-parser.service';

describe('AddressMatcherService', () => {
  const service = new AddressMatcherService(new AddressNormalizationService(), new AddressParserService());

  it('returns high confidence for close match', () => {
    const matches = service.matchCandidates('Istanbul Kadikoy Caferaga Moda Caddesi No 12 D 3', [
      {
        provinceId: 34,
        provinceName: 'Istanbul',
        districtId: 34016,
        districtName: 'Kadikoy',
        neighborhoodId: 1,
        neighborhoodName: 'Caferaga',
        neighborhoodType: 'mahalle',
        streetId: 55,
        streetName: 'Moda Caddesi',
        streetType: 'cadde',
      },
    ]);

    expect(matches[0].confidence).toBeGreaterThanOrEqual(0.9);
    expect(matches[0].matchedParts.province).toBe(true);
    expect(matches[0].matchedParts.street).toBe(true);
  });

  it('returns alternatives sorted by confidence', () => {
    const matches = service.matchCandidates('Ankara Cankaya Birlik', [
      {
        provinceId: 6,
        provinceName: 'Ankara',
        districtId: 6001,
        districtName: 'Cankaya',
        neighborhoodId: 1,
        neighborhoodName: 'Birlik',
        neighborhoodType: 'mahalle',
      },
      {
        provinceId: 35,
        provinceName: 'Izmir',
        districtId: 3501,
        districtName: 'Konak',
        neighborhoodId: 2,
        neighborhoodName: 'Alsancak',
        neighborhoodType: 'mahalle',
      },
    ]);

    expect(matches[0].candidate.provinceName).toBe('Ankara');
  });
});
