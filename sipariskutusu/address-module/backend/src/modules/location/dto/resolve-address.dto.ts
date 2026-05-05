import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  query!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  provinceCodeHint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  districtCodeHint?: string;
}
