import { COMMON_ABBREVIATIONS } from '../constants/location.constants';

export function simplifyTurkishChars(input: string): string {
  return input
    .replace(/\u0130/g, 'i')
    .replace(/\u0131/g, 'i')
    .replace(/\u00e7/g, 'c')
    .replace(/\u00c7/g, 'c')
    .replace(/\u011f/g, 'g')
    .replace(/\u011e/g, 'g')
    .replace(/\u00f6/g, 'o')
    .replace(/\u00d6/g, 'o')
    .replace(/\u015f/g, 's')
    .replace(/\u015e/g, 's')
    .replace(/\u00fc/g, 'u')
    .replace(/\u00dc/g, 'u');
}

export function normalizeTurkishText(input: string): string {
  return simplifyTurkishChars(input)
    .toLowerCase()
    .replace(/[.,;:!?()\[\]{}"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function expandCommonAbbreviations(input: string): string {
  const tokens = normalizeTurkishText(input).split(' ').filter(Boolean);
  return tokens.map((token) => COMMON_ABBREVIATIONS[token] ?? token).join(' ');
}

export function normalizeAddressText(input: string): string {
  return expandCommonAbbreviations(input)
    .replace(/\bmahallesi\b/g, 'mahalle')
    .replace(/\bkoyu\b/g, 'koy')
    .replace(/\bapt\b/g, 'apartmani')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractBuildingNo(input: string): string | null {
  const normalized = normalizeAddressText(input);
  const byNo = normalized.match(/\bno\s*(\d+[a-z]?)/i);
  if (byNo?.[1]) return byNo[1].toUpperCase();

  const slash = normalized.match(/\b(\d+[a-z]?)\s*\/(\d+[a-z]?)\b/i);
  if (slash?.[1]) return slash[1].toUpperCase();

  const plain = normalized.match(/\b(\d+[a-z]?)\b/);
  return plain?.[1]?.toUpperCase() ?? null;
}

export function extractUnitNo(input: string): string | null {
  const normalized = normalizeAddressText(input);
  const byDaire = normalized.match(/\bdaire\s*(\d+[a-z]?)/i);
  if (byDaire?.[1]) return byDaire[1].toUpperCase();

  const byD = normalized.match(/\bd\s*(\d+[a-z]?)/i);
  if (byD?.[1]) return byD[1].toUpperCase();

  const slash = normalized.match(/\b(\d+[a-z]?)\s*\/(\d+[a-z]?)\b/i);
  return slash?.[2]?.toUpperCase() ?? null;
}

export function tokenizeAddress(input: string): string[] {
  return normalizeAddressText(input)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}
