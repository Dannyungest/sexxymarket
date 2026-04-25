import { IsIn } from 'class-validator';

export class UpdateMerchantBusinessTypeDto {
  @IsIn(['INDIVIDUAL', 'REGISTERED_BUSINESS'])
  businessType!: 'INDIVIDUAL' | 'REGISTERED_BUSINESS';
}
