import {
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSavedRecipientDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  label?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  recipientName!: string;

  @IsPhoneNumber('NG')
  recipientPhone!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  houseNo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  street!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  landmark?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(64)
  shippingState!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  shippingLga!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  shippingCity!: string;
}
