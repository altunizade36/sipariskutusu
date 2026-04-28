import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PerformanceModule } from '../performance/performance.module';
import { LocationController } from './controllers/location.controller';
import { AddressAliasEntity } from './entities/address-alias.entity';
import { AddressSearchLogEntity } from './entities/address-search-log.entity';
import { AddressValidationResultEntity } from './entities/address-validation-result.entity';
import { AddressEntity } from './entities/address.entity';
import { DistrictEntity } from './entities/district.entity';
import { ImportedLocationSourceEntity } from './entities/imported-location-source.entity';
import { NeighborhoodEntity } from './entities/neighborhood.entity';
import { ProvinceEntity } from './entities/province.entity';
import { StreetEntity } from './entities/street.entity';
import { AddressAutocompleteService } from './services/address-autocomplete.service';
import { AddressMatcherService } from './services/address-matcher.service';
import { AddressNormalizationService } from './services/address-normalization.service';
import { AddressParserService } from './services/address-parser.service';
import { AddressValidationService } from './services/address-validation.service';
import { LocationService } from './services/location.service';
import { LocationImportService } from './services/location-import.service';

@Module({
  imports: [
    CacheModule.register(),
    PerformanceModule,
    TypeOrmModule.forFeature([
      ProvinceEntity,
      DistrictEntity,
      NeighborhoodEntity,
      StreetEntity,
      AddressEntity,
      AddressAliasEntity,
      AddressSearchLogEntity,
      ImportedLocationSourceEntity,
      AddressValidationResultEntity,
    ]),
  ],
  controllers: [LocationController],
  providers: [
    LocationService,
    AddressParserService,
    AddressNormalizationService,
    AddressMatcherService,
    AddressAutocompleteService,
    AddressValidationService,
    LocationImportService,
  ],
  exports: [LocationService, LocationImportService],
})
export class LocationModule {}
