import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AddressEntity } from '../entities/address.entity';
import { ADDRESS_CACHE_TTL_SECONDS, ADDRESS_QUERY_MIN_LENGTH, ADDRESS_SEARCH_LIMIT_MAX } from '../constants/location.constants';
import { AddressNormalizationService } from './address-normalization.service';

@Injectable()
export class AddressAutocompleteService {
  private readonly logger = new Logger(AddressAutocompleteService.name);

  constructor(
    @InjectRepository(AddressEntity)
    private readonly addressRepository: Repository<AddressEntity>,
    private readonly normalizationService: AddressNormalizationService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async search(query: string, limit = 10): Promise<AddressEntity[]> {
    const q = query.trim();
    if (q.length < ADDRESS_QUERY_MIN_LENGTH) {
      throw new BadRequestException(`query must be at least ${ADDRESS_QUERY_MIN_LENGTH} characters`);
    }

    const safeLimit = Math.max(1, Math.min(limit, ADDRESS_SEARCH_LIMIT_MAX));
    const normalized = this.normalizationService.normalizeAddressText(q);
    const cacheKey = `address:autocomplete:${normalized}:${safeLimit}`;

    const cached = await this.cacheManager.get<AddressEntity[]>(cacheKey);
    if (cached) return cached;

    const qb = this.addressRepository
      .createQueryBuilder('a')
      .where('a.normalized_full_text % :normalized', { normalized })
      .orderBy('similarity(a.normalized_full_text, :normalized)', 'DESC')
      .setParameter('normalized', normalized)
      .limit(safeLimit);

    qb.maxExecutionTime(400);

    const rows = await qb.getMany();
    await this.cacheManager.set(cacheKey, rows, ADDRESS_CACHE_TTL_SECONDS * 1000);
    return rows;
  }
}
