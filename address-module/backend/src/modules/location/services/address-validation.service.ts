import { Injectable } from '@nestjs/common';
import { AddressMatchResult } from '../interfaces/address-match.interface';
import { confidenceBand } from '../utils/scoring.util';

@Injectable()
export class AddressValidationService {
  validateBestMatch(bestMatch: AddressMatchResult | null): {
    isValid: boolean;
    confidence: number;
    band: 'high' | 'medium' | 'low';
    requiresUserConfirmation: boolean;
  } {
    if (!bestMatch) {
      return {
        isValid: false,
        confidence: 0,
        band: 'low',
        requiresUserConfirmation: true,
      };
    }

    const band = confidenceBand(bestMatch.confidence);

    return {
      isValid: bestMatch.confidence >= 0.7,
      confidence: bestMatch.confidence,
      band,
      requiresUserConfirmation: bestMatch.confidence < 0.9,
    };
  }
}
