import { SetMetadata } from '@nestjs/common';
import { INVALIDATE_PRODUCT_CACHE_OPTIONS } from '../constants/performance.constants';

export type InvalidateProductCacheOptions = {
  paramKey?: string;
  bodyKey?: string;
};

export const InvalidateProductCache = (options: InvalidateProductCacheOptions) =>
  SetMetadata(INVALIDATE_PRODUCT_CACHE_OPTIONS, options);
