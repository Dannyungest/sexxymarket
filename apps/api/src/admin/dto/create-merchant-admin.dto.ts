import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { BusinessType } from '@prisma/client';

export class CreateMerchantAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  businessName!: string;

  @IsOptional()
  @IsIn(['INDIVIDUAL', 'REGISTERED_BUSINESS'] as const)
  businessType?: BusinessType;

  @IsString()
  @MinLength(3)
  contactAddress!: string;

  @IsBoolean()
  hasPhysicalLocation!: boolean;

  @ValidateIf((o: CreateMerchantAdminDto) => o.hasPhysicalLocation === true)
  @IsString()
  @MinLength(3)
  businessAddress?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}
