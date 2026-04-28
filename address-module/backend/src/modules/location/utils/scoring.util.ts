import { ADDRESS_SCORE_WEIGHTS } from '../constants/location.constants';
import { MatchedParts } from '../interfaces/address-match.interface';

export function calculateAddressConfidence(parts: MatchedParts): number {
  const raw =
    (parts.province ? ADDRESS_SCORE_WEIGHTS.province : 0) +
    (parts.district ? ADDRESS_SCORE_WEIGHTS.district : 0) +
    (parts.neighborhood ? ADDRESS_SCORE_WEIGHTS.neighborhood : 0) +
    (parts.street ? ADDRESS_SCORE_WEIGHTS.street : 0) +
    (parts.buildingNo ? ADDRESS_SCORE_WEIGHTS.buildingNo : 0) +
    (parts.unitNo ? ADDRESS_SCORE_WEIGHTS.unitNo : 0);

  return Number(raw.toFixed(4));
}

export function confidenceBand(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.7) return 'medium';
  return 'low';
}
