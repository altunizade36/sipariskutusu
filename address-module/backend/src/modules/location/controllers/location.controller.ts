import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CdnCache } from '../../performance/decorators/cdn-cache.decorator';
import { RateLimit } from '../../performance/decorators/rate-limit.decorator';
import { RedisRateLimitGuard } from '../../performance/guards/redis-rate-limit.guard';
import { CdnCacheInterceptor } from '../../performance/interceptors/cdn-cache.interceptor';
import {
  LOCATION_RATE_LIMIT_ADDRESS_CREATE_MAX,
  LOCATION_RATE_LIMIT_ADDRESS_DETAIL_MAX,
  LOCATION_RATE_LIMIT_DISTRICTS_MAX,
  LOCATION_RATE_LIMIT_NEIGHBORHOODS_MAX,
  LOCATION_RATE_LIMIT_PROVINCES_MAX,
  LOCATION_RATE_LIMIT_RESOLVE_MAX,
  LOCATION_RATE_LIMIT_SEARCH_MAX,
  LOCATION_RATE_LIMIT_STREETS_MAX,
  LOCATION_RATE_LIMIT_VALIDATE_MAX,
  LOCATION_RATE_LIMIT_WINDOW_SECONDS,
} from '../constants/location.constants';
import { CreateAddressDto } from '../dto/create-address.dto';
import { ResolveAddressDto } from '../dto/resolve-address.dto';
import { SearchAddressDto } from '../dto/search-address.dto';
import { ValidateAddressDto } from '../dto/validate-address.dto';
import { LocationService } from '../services/location.service';

@Controller('locations')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get('provinces')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({
    maxRequests: LOCATION_RATE_LIMIT_PROVINCES_MAX,
    windowSeconds: LOCATION_RATE_LIMIT_WINDOW_SECONDS,
    keyPrefix: 'rate-limit:location-provinces',
  })
  @UseInterceptors(CdnCacheInterceptor)
  @CdnCache({ maxAge: 60, sMaxAge: 300, staleWhileRevalidate: 120, staleIfError: 900, isPublic: true })
  getProvinces() {
    return this.locationService.getProvinces();
  }

  @Get('districts')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({
    maxRequests: LOCATION_RATE_LIMIT_DISTRICTS_MAX,
    windowSeconds: LOCATION_RATE_LIMIT_WINDOW_SECONDS,
    keyPrefix: 'rate-limit:location-districts',
  })
  @UseInterceptors(CdnCacheInterceptor)
  @CdnCache({ maxAge: 45, sMaxAge: 240, staleWhileRevalidate: 120, staleIfError: 900, isPublic: true })
  getDistricts(@Query('provinceId', ParseIntPipe) provinceId: number) {
    return this.locationService.getDistricts(provinceId);
  }

  @Get('neighborhoods')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({
    maxRequests: LOCATION_RATE_LIMIT_NEIGHBORHOODS_MAX,
    windowSeconds: LOCATION_RATE_LIMIT_WINDOW_SECONDS,
    keyPrefix: 'rate-limit:location-neighborhoods',
  })
  @UseInterceptors(CdnCacheInterceptor)
  @CdnCache({ maxAge: 30, sMaxAge: 180, staleWhileRevalidate: 90, staleIfError: 900, isPublic: true })
  getNeighborhoods(@Query('districtId', ParseIntPipe) districtId: number) {
    return this.locationService.getNeighborhoods(districtId);
  }

  @Get('streets')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({
    maxRequests: LOCATION_RATE_LIMIT_STREETS_MAX,
    windowSeconds: LOCATION_RATE_LIMIT_WINDOW_SECONDS,
    keyPrefix: 'rate-limit:location-streets',
  })
  @UseInterceptors(CdnCacheInterceptor)
  @CdnCache({ maxAge: 30, sMaxAge: 180, staleWhileRevalidate: 90, staleIfError: 900, isPublic: true })
  getStreets(@Query('neighborhoodId', ParseIntPipe) neighborhoodId: number) {
    return this.locationService.getStreets(neighborhoodId);
  }

  @Get('search')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({
    maxRequests: LOCATION_RATE_LIMIT_SEARCH_MAX,
    windowSeconds: LOCATION_RATE_LIMIT_WINDOW_SECONDS,
    keyPrefix: 'rate-limit:location-search',
  })
  @UseInterceptors(CdnCacheInterceptor)
  @CdnCache({ maxAge: 15, sMaxAge: 60, staleWhileRevalidate: 60, staleIfError: 300, isPublic: true })
  search(@Query() dto: SearchAddressDto) {
    return this.locationService.search(dto);
  }

  @Post('resolve')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({
    maxRequests: LOCATION_RATE_LIMIT_RESOLVE_MAX,
    windowSeconds: LOCATION_RATE_LIMIT_WINDOW_SECONDS,
    keyPrefix: 'rate-limit:location-resolve',
  })
  resolve(@Body() dto: ResolveAddressDto) {
    return this.locationService.resolve(dto);
  }

  @Post('validate')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({
    maxRequests: LOCATION_RATE_LIMIT_VALIDATE_MAX,
    windowSeconds: LOCATION_RATE_LIMIT_WINDOW_SECONDS,
    keyPrefix: 'rate-limit:location-validate',
  })
  validate(@Body() dto: ValidateAddressDto) {
    return this.locationService.validate(dto.query);
  }

  @Post('address')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({
    maxRequests: LOCATION_RATE_LIMIT_ADDRESS_CREATE_MAX,
    windowSeconds: LOCATION_RATE_LIMIT_WINDOW_SECONDS,
    keyPrefix: 'rate-limit:location-address-create',
  })
  createAddress(@Body() dto: CreateAddressDto) {
    return this.locationService.createAddress(dto);
  }

  @Get('address/:id')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({
    maxRequests: LOCATION_RATE_LIMIT_ADDRESS_DETAIL_MAX,
    windowSeconds: LOCATION_RATE_LIMIT_WINDOW_SECONDS,
    keyPrefix: 'rate-limit:location-address-detail',
  })
  @UseInterceptors(CdnCacheInterceptor)
  @CdnCache({ maxAge: 15, sMaxAge: 90, staleWhileRevalidate: 60, staleIfError: 600, isPublic: false })
  getAddressById(@Param('id', ParseIntPipe) id: number) {
    return this.locationService.getAddressById(id);
  }
}
