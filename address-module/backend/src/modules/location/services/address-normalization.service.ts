import { Injectable } from '@nestjs/common';
import {
  expandCommonAbbreviations,
  extractBuildingNo,
  extractUnitNo,
  normalizeAddressText,
  normalizeTurkishText,
  tokenizeAddress,
} from '../utils/normalize.util';

@Injectable()
export class AddressNormalizationService {
  normalizeTurkishText(input: string): string {
    return normalizeTurkishText(input);
  }

  normalizeAddressText(input: string): string {
    return normalizeAddressText(input);
  }

  expandCommonAbbreviations(input: string): string {
    return expandCommonAbbreviations(input);
  }

  extractBuildingNo(input: string): string | null {
    return extractBuildingNo(input);
  }

  extractUnitNo(input: string): string | null {
    return extractUnitNo(input);
  }

  tokenizeAddress(input: string): string[] {
    return tokenizeAddress(input);
  }
}
