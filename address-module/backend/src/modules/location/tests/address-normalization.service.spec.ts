import { AddressNormalizationService } from '../services/address-normalization.service';

describe('AddressNormalizationService', () => {
  const service = new AddressNormalizationService();

  it('normalizes Turkish chars and abbreviations', () => {
    const result = service.normalizeAddressText('İstanbul Kadıköy Caferağa Mah. Moda Cd. No:12 D:3');
    expect(result).toContain('istanbul');
    expect(result).toContain('mahalle');
    expect(result).toContain('cadde');
  });

  it('extracts building and unit numbers', () => {
    expect(service.extractBuildingNo('No:12 D:3')).toBe('12');
    expect(service.extractUnitNo('No:12 D:3')).toBe('3');
    expect(service.extractBuildingNo('12/7')).toBe('12');
    expect(service.extractUnitNo('12/7')).toBe('7');
  });

  it('tokenizes normalized address', () => {
    const tokens = service.tokenizeAddress('ank cankya mah. 145 sk no 7');
    expect(tokens.length).toBeGreaterThan(3);
  });
});
