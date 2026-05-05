import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ADDRESS_QUERY_MAX_LENGTH, ADDRESS_QUERY_MIN_LENGTH, ADDRESS_SEARCH_LIMIT_DEFAULT, ADDRESS_SEARCH_LIMIT_MAX } from '../constants/location.constants';

export class SearchAddressDto {
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim())
  @MaxLength(ADDRESS_QUERY_MAX_LENGTH)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ADDRESS_SEARCH_LIMIT_MAX)
  limit: number = ADDRESS_SEARCH_LIMIT_DEFAULT;

  static ensureMinLength(query: string): boolean {
    return query.trim().length >= ADDRESS_QUERY_MIN_LENGTH;
  }
}
