import { Injectable } from '@nestjs/common';
import { AddressCandidate, AddressMatchResult, MatchedParts } from '../interfaces/address-match.interface';
import { calculateAddressConfidence } from '../utils/scoring.util';
import { AddressNormalizationService } from './address-normalization.service';
import { AddressParserService } from './address-parser.service';

@Injectable()
export class AddressMatcherService {
  constructor(
    private readonly normalizationService: AddressNormalizationService,
    private readonly parserService: AddressParserService,
  ) {}

  matchCandidates(input: string, candidates: AddressCandidate[]): AddressMatchResult[] {
    const normalizedQuery = this.normalizationService.normalizeAddressText(input);
    const parsed = this.parserService.parse(input);

    const scored = candidates.map((candidate) => {
      const parts: MatchedParts = {
        province: this.includes(normalizedQuery, candidate.provinceName),
        district: this.includes(normalizedQuery, candidate.districtName),
        neighborhood: this.includes(normalizedQuery, candidate.neighborhoodName),
        street: candidate.streetName ? this.includes(normalizedQuery, candidate.streetName) : false,
        buildingNo: parsed.buildingNo ? normalizedQuery.includes(parsed.buildingNo.toLowerCase()) : false,
        unitNo: parsed.unitNo ? normalizedQuery.includes(parsed.unitNo.toLowerCase()) : false,
      };

      return {
        candidate,
        buildingNo: parsed.buildingNo,
        unitNo: parsed.unitNo,
        matchedParts: parts,
        confidence: calculateAddressConfidence(parts),
        debug: {
          normalizedQuery,
          tokenCount: parsed.tokens.length,
          notes: [
            parts.province ? 'province matched' : 'province not matched',
            parts.district ? 'district matched' : 'district not matched',
            parts.neighborhood ? 'neighborhood matched' : 'neighborhood not matched',
          ],
        },
      } satisfies AddressMatchResult;
    });

    return scored.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  }

  private includes(normalizedQuery: string, candidateText: string): boolean {
    const normalizedCandidate = this.normalizationService.normalizeAddressText(candidateText);
    return normalizedQuery.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedQuery);
  }
}
