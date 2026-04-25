import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMerchantStatusDto {
  @IsIn(['APPROVED', 'REJECTED', 'PAUSED', 'BLACKLISTED'])
  status!: 'APPROVED' | 'REJECTED' | 'PAUSED' | 'BLACKLISTED';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
