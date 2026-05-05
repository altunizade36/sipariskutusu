import { IsInt, IsNotEmpty, IsNumberString, IsOptional, IsString, Length, MaxLength, Min } from 'class-validator';

export class CreateAddressDto {
  @IsInt()
  @Min(1)
  provinceId!: number;

  @IsInt()
  @Min(1)
  districtId!: number;

  @IsInt()
  @Min(1)
  neighborhoodId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  streetId?: number;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  buildingNo?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  unitNo?: string;

  @IsOptional()
  @IsString()
  @Length(3, 10)
  postalCode?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fullText!: string;

  @IsOptional()
  @IsNumberString()
  lat?: string;

  @IsOptional()
  @IsNumberString()
  lng?: string;
}
