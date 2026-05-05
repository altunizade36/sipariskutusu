import { Injectable } from '@nestjs/common';
import { extractBuildingNo, extractUnitNo, tokenizeAddress } from '../utils/normalize.util';

export type ParsedAddressInput = {
  tokens: string[];
  buildingNo?: string;
  unitNo?: string;
};

@Injectable()
export class AddressParserService {
  parse(input: string): ParsedAddressInput {
    const tokens = tokenizeAddress(input);
    const buildingNo = extractBuildingNo(input) ?? undefined;
    const unitNo = extractUnitNo(input) ?? undefined;

    return {
      tokens,
      buildingNo,
      unitNo,
    };
  }
}
