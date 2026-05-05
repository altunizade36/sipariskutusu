import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAddressDto } from '../dto/create-address.dto';
import { ResolveAddressDto } from '../dto/resolve-address.dto';
import { SearchAddressDto } from '../dto/search-address.dto';
import { DistrictEntity } from '../entities/district.entity';
import { NeighborhoodEntity } from '../entities/neighborhood.entity';
import { ProvinceEntity } from '../entities/province.entity';
import { StreetEntity } from '../entities/street.entity';
import { AddressEntity } from '../entities/address.entity';
import { AddressNormalizationService } from './address-normalization.service';
import { AddressMatcherService } from './address-matcher.service';
import { AddressAutocompleteService } from './address-autocomplete.service';
import { AddressValidationService } from './address-validation.service';

@Injectable()
export class LocationService {
  constructor(
    @InjectRepository(ProvinceEntity)
    private readonly provinceRepository: Repository<ProvinceEntity>,
    @InjectRepository(DistrictEntity)
    private readonly districtRepository: Repository<DistrictEntity>,
    @InjectRepository(NeighborhoodEntity)
    private readonly neighborhoodRepository: Repository<NeighborhoodEntity>,
    @InjectRepository(StreetEntity)
    private readonly streetRepository: Repository<StreetEntity>,
    @InjectRepository(AddressEntity)
    private readonly addressRepository: Repository<AddressEntity>,
    private readonly normalizationService: AddressNormalizationService,
    private readonly matcherService: AddressMatcherService,
    private readonly autocompleteService: AddressAutocompleteService,
    private readonly validationService: AddressValidationService,
  ) {}

  getProvinces(): Promise<ProvinceEntity[]> {
    return this.provinceRepository.find({ order: { name: 'ASC' } });
  }

  getDistricts(provinceId: number): Promise<DistrictEntity[]> {
    return this.districtRepository.find({ where: { provinceId }, order: { name: 'ASC' } });
  }

  getNeighborhoods(districtId: number): Promise<NeighborhoodEntity[]> {
    return this.neighborhoodRepository.find({ where: { districtId }, order: { name: 'ASC' } });
  }

  getStreets(neighborhoodId: number): Promise<StreetEntity[]> {
    return this.streetRepository.find({ where: { neighborhoodId }, order: { name: 'ASC' } });
  }

  async search(dto: SearchAddressDto) {
    const rows = await this.autocompleteService.search(dto.q, dto.limit);
    const normalizedQuery = this.normalizationService.normalizeAddressText(dto.q);

    return {
      query: dto.q,
      normalizedQuery,
      results: rows,
    };
  }

  async resolve(dto: ResolveAddressDto) {
    const normalizedQuery = this.normalizationService.normalizeAddressText(dto.query);
    const candidates = await this.getCandidatePool(dto);
    const matches = this.matcherService.matchCandidates(dto.query, candidates);
    const bestMatch = matches[0] ?? null;

    return {
      query: dto.query,
      normalizedQuery,
      bestMatch,
      alternatives: matches.slice(1, 6),
      validation: this.validationService.validateBestMatch(bestMatch),
    };
  }

  async validate(query: string) {
    const resolved = await this.resolve({ query });
    return resolved.validation;
  }

  async createAddress(dto: CreateAddressDto): Promise<AddressEntity> {
    const normalized = this.normalizationService.normalizeAddressText(dto.fullText);

    const entity = this.addressRepository.create({
      ...dto,
      normalizedFullText: normalized,
      confidenceScore: '1.0000',
      snapshotJson: {
        fullText: dto.fullText,
        normalized,
      },
    });

    return this.addressRepository.save(entity);
  }

  async getAddressById(id: number): Promise<AddressEntity> {
    const entity = await this.addressRepository.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Address not found');
    return entity;
  }

  private async getCandidatePool(dto: ResolveAddressDto) {
    const qb = this.neighborhoodRepository
      .createQueryBuilder('n')
      .innerJoin(ProvinceEntity, 'p', 'p.id = n.province_id')
      .innerJoin(DistrictEntity, 'd', 'd.id = n.district_id')
      .leftJoin(StreetEntity, 's', 's.neighborhood_id = n.id')
      .select([
        'p.id AS provinceId',
        'p.name AS provinceName',
        'd.id AS districtId',
        'd.name AS districtName',
        'n.id AS neighborhoodId',
        'n.name AS neighborhoodName',
        'n.type AS neighborhoodType',
        's.id AS streetId',
        's.name AS streetName',
        's.type AS streetType',
      ])
      .limit(500);

    if (dto.provinceCodeHint) {
      qb.andWhere('p.code = :provinceCodeHint', { provinceCodeHint: dto.provinceCodeHint });
    }

    if (dto.districtCodeHint) {
      qb.andWhere('d.code = :districtCodeHint', { districtCodeHint: dto.districtCodeHint });
    }

    return qb.getRawMany();
  }
}
