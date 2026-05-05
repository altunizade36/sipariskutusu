import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import {
  CDN_CACHE_OPTIONS,
  DEFAULT_CDN_S_MAXAGE,
  DEFAULT_CDN_STALE_IF_ERROR,
  DEFAULT_CDN_STALE_WHILE_REVALIDATE,
} from '../constants/performance.constants';
import type { CdnCacheOptions } from '../interfaces/cache-options.interface';

@Injectable()
export class CdnCacheInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const options = this.reflector.getAllAndOverride<CdnCacheOptions | undefined>(CDN_CACHE_OPTIONS, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options || request.method !== 'GET') {
      return next.handle();
    }

    const isPublic = options.isPublic ?? true;
    const maxAge = options.maxAge ?? 0;
    const sMaxAge = options.sMaxAge ?? DEFAULT_CDN_S_MAXAGE;
    const staleWhileRevalidate = options.staleWhileRevalidate ?? DEFAULT_CDN_STALE_WHILE_REVALIDATE;
    const staleIfError = options.staleIfError ?? DEFAULT_CDN_STALE_IF_ERROR;

    const cacheControl = `${isPublic ? 'public' : 'private'}, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}, stale-if-error=${staleIfError}`;

    response.setHeader('Cache-Control', cacheControl);
    response.setHeader('CDN-Cache-Control', cacheControl);

    const varyBy = options.varyBy ?? ['Accept-Encoding'];
    if (varyBy.length > 0) {
      response.setHeader('Vary', varyBy.join(', '));
    }

    return next.handle();
  }
}
