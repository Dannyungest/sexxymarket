import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { BusinessType } from '@prisma/client';

export class CreateMerchantProfileDto {
  @IsString()
  businessName!: string;

  @IsOptional()
  @IsIn(['INDIVIDUAL', 'REGISTERED_BUSINESS'] as const)
  businessType?: BusinessType;

  @IsString()
  businessAddress!: string;

  @IsBoolean()
  hasPhysicalLocation!: boolean;

  @IsBoolean()
  agreementAccepted!: boolean;
}
