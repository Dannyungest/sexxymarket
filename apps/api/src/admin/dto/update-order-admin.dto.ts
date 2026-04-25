import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOrderAdminDto {
  @IsOptional()
  @IsIn(['PENDING', 'PAID', 'PROCESSING', 'DELIVERED', 'CANCELLED', 'REFUNDED'])
  status?:
    | 'PENDING'
    | 'PAID'
    | 'PROCESSING'
    | 'DELIVERED'
    | 'CANCELLED'
    | 'REFUNDED';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  deliveryNote?: string;

  @IsOptional()
  @IsIn([
    'MONIEPOINT',
    'MONNIFY',
    'FLUTTERWAVE',
    'MANUAL_CASH',
    'MANUAL_ONLINE',
  ])
  paymentGateway?:
    | 'MONIEPOINT'
    | 'MONNIFY'
    | 'FLUTTERWAVE'
    | 'MANUAL_CASH'
    | 'MANUAL_ONLINE';

  @IsOptional()
  @IsString()
  @MaxLength(256)
  paymentReference?: string;
}
