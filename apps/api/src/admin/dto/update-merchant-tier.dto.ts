import { IsIn } from 'class-validator';

export class UpdateMerchantTierDto {
  @IsIn(['STANDARD', 'SUPER'])
  merchantTier!: 'STANDARD' | 'SUPER';
}
