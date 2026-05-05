import { SetMetadata } from '@nestjs/common';
import { CDN_CACHE_OPTIONS } from '../constants/performance.constants';
import type { CdnCacheOptions } from '../interfaces/cache-options.interface';

export const CdnCache = (options: CdnCacheOptions) => SetMetadata(CDN_CACHE_OPTIONS, options);
