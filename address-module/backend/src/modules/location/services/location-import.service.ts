import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ImportedLocationSourceEntity } from '../entities/imported-location-source.entity';
import { DistrictEntity } from '../entities/district.entity';
import { NeighborhoodEntity } from '../entities/neighborhood.entity';
import { ProvinceEntity } from '../entities/province.entity';
import { StreetEntity } from '../entities/street.entity';
import { parseLocationCsv } from '../utils/parse-location-csv.util';
import { AddressNormalizationService } from './address-normalization.service';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';

@Injectable()
export class LocationImportService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly normalizationService: AddressNormalizationService,
    @InjectRepository(ImportedLocationSourceEntity)
    private readonly importSourceRepository: Repository<ImportedLocationSourceEntity>,
  ) {}

  async importCsv(sourceName: string, filePath: string): Promise<ImportedLocationSourceEntity> {
    const fileBuffer = fs.readFileSync(filePath);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const existing = await this.importSourceRepository.findOne({ where: { sourceName, fileHash } });
    if (existing) return existing;

    const log = await this.importSourceRepository.save(
      this.importSourceRepository.create({
        sourceName,
        fileName: filePath.split(/[\\/]/).pop() ?? 'unknown',
        fileHash,
        status: 'running',
      }),
    );

    const rows = await parseLocationCsv(filePath);
    log.totalRows = rows.length;

    const failures: Array<{ rowIndex: number; reason: string }> = [];
    let inserted = 0;

    await this.dataSource.transaction(async (trx) => {
      const provinceRepo = trx.getRepository(ProvinceEntity);
      const districtRepo = trx.getRepository(DistrictEntity);
      const neighborhoodRepo = trx.getRepository(NeighborhoodEntity);
      const streetRepo = trx.getRepository(StreetEntity);

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];

        try {
          const province = await upsertProvince(provinceRepo, row.provinceCode, row.provinceName, this.normalizationService);
          const district = await upsertDistrict(districtRepo, province.id, row.districtCode, row.districtName, this.normalizationService);
          const neighborhood = await upsertNeighborhood(
            neighborhoodRepo,
            province.id,
            district.id,
            row.neighborhoodCode,
            row.neighborhoodName,
            row.neighborhoodType,
            this.normalizationService,
          );

          if (row.streetName) {
            await upsertStreet(
              streetRepo,
              province.id,
              district.id,
              neighborhood.id,
              row.streetCode,
              row.streetName,
              row.streetType,
              this.normalizationService,
            );
          }

          inserted += 1;
        } catch (error) {
          failures.push({ rowIndex: i + 1, reason: error instanceof Error ? error.message : 'unknown' });
        }
      }
    });

    log.insertedRows = inserted;
    log.failedRows = failures.length;
    log.failureReportJson = failures;
    log.status = failures.length > 0 ? 'completed' : 'completed';

    return this.importSourceRepository.save(log);
  }
}

async function upsertProvince(
  repo: Repository<ProvinceEntity>,
  code: string,
  name: string,
  normalizationService: AddressNormalizationService,
): Promise<ProvinceEntity> {
  const normalizedName = normalizationService.normalizeAddressText(name);
  const existing = await repo.findOne({ where: [{ code }, { normalizedName }] });
  if (existing) return existing;
  return repo.save(repo.create({ code, name, normalizedName }));
}

async function upsertDistrict(
  repo: Repository<DistrictEntity>,
  provinceId: number,
  code: string,
  name: string,
  normalizationService: AddressNormalizationService,
): Promise<DistrictEntity> {
  const normalizedName = normalizationService.normalizeAddressText(name);
  const existing = await repo.findOne({ where: [{ code }, { provinceId, normalizedName }] });
  if (existing) return existing;
  return repo.save(repo.create({ provinceId, code, name, normalizedName }));
}

async function upsertNeighborhood(
  repo: Repository<NeighborhoodEntity>,
  provinceId: number,
  districtId: number,
  code: string,
  name: string,
  type: 'mahalle' | 'koy',
  normalizationService: AddressNormalizationService,
): Promise<NeighborhoodEntity> {
  const normalizedName = normalizationService.normalizeAddressText(name);
  const existing = await repo.findOne({ where: [{ code }, { districtId, normalizedName, type }] });
  if (existing) return existing;
  return repo.save(repo.create({ provinceId, districtId, code, name, normalizedName, type }));
}

async function upsertStreet(
  repo: Repository<StreetEntity>,
  provinceId: number,
  districtId: number,
  neighborhoodId: number,
  code: string | undefined,
  name: string,
  type: string | undefined,
  normalizationService: AddressNormalizationService,
): Promise<StreetEntity> {
  const normalizedName = normalizationService.normalizeAddressText(name);
  const existing = await repo.findOne({
    where: code ? [{ code }, { neighborhoodId, normalizedName }] : [{ neighborhoodId, normalizedName }],
  });
  if (existing) return existing;
  return repo.save(
    repo.create({
      provinceId,
      districtId,
      neighborhoodId,
      code: code ?? null,
      name,
      normalizedName,
      type: (type as StreetEntity['type']) ?? 'sokak',
    }),
  );
}
