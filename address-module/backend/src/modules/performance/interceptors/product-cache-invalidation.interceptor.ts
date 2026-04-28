import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { INVALIDATE_PRODUCT_CACHE_OPTIONS } from '../constants/performance.constants';
import type { InvalidateProductCacheOptions } from '../decorators/invalidate-product-cache.decorator';
import { ProductCacheService } from '../services/product-cache.service';

@Injectable()
export class ProductCacheInvalidationInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly productCacheService: ProductCacheService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<InvalidateProductCacheOptions | undefined>(
      INVALIDATE_PRODUCT_CACHE_OPTIONS,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const productId =
      (options.paramKey ? request.params?.[options.paramKey] : undefined) ??
      (options.bodyKey ? request.body?.[options.bodyKey] : undefined);

    return next.handle().pipe(
      tap(async () => {
        if (typeof productId === 'string' && productId.trim().length > 0) {
          await this.productCacheService.invalidateProduct(productId).catch(() => {
            // Best-effort cache invalidation: do not fail mutation response path.
          });
        }
      }),
    );
  }
}
