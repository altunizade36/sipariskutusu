import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_OPTIONS } from '../constants/performance.constants';
import type { RateLimitOptions } from '../interfaces/cache-options.interface';

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_OPTIONS, options);
