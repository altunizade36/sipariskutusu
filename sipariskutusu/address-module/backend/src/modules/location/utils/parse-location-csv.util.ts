import * as fs from 'node:fs';
import * as readline from 'node:readline';

export type LocationCsvRow = {
  provinceCode: string;
  provinceName: string;
  districtCode: string;
  districtName: string;
  neighborhoodCode: string;
  neighborhoodName: string;
  neighborhoodType: 'mahalle' | 'koy';
  streetCode?: string;
  streetName?: string;
  streetType?: string;
};

export async function parseLocationCsv(filePath: string): Promise<LocationCsvRow[]> {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const rows: LocationCsvRow[] = [];
  let isFirstLine = true;

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (isFirstLine) {
      isFirstLine = false;
      continue;
    }

    const [
      provinceCode,
      provinceName,
      districtCode,
      districtName,
      neighborhoodCode,
      neighborhoodName,
      neighborhoodType,
      streetCode,
      streetName,
      streetType,
    ] = line.split(',').map((x) => x.trim());

    rows.push({
      provinceCode,
      provinceName,
      districtCode,
      districtName,
      neighborhoodCode,
      neighborhoodName,
      neighborhoodType: neighborhoodType === 'koy' ? 'koy' : 'mahalle',
      streetCode: streetCode || undefined,
      streetName: streetName || undefined,
      streetType: streetType || undefined,
    });
  }

  return rows;
}
