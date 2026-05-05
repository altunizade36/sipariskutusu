import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ValidateAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  query!: string;
}
