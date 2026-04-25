import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsInt,
  Min,
  MinLength,
  IsPhoneNumber,
  ValidateNested,
  ValidateIf,
} from 'class-validator';

class ManualOrderLineDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateManualOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ManualOrderLineDto)
  items!: ManualOrderLineDto[];

  @IsString()
  shippingAddress!: string;

  @IsString()
  shippingState!: string;

  @IsString()
  shippingCity!: string;

  @IsString()
  recipientName!: string;

  @IsPhoneNumber('NG')
  recipientPhone!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEmail()
  guestEmail?: string;

  @IsOptional()
  @IsPhoneNumber('NG')
  guestPhone?: string;

  @IsIn(['CASH', 'ONLINE_RECONCILED'])
  paymentMode!: 'CASH' | 'ONLINE_RECONCILED';

  @ValidateIf(
    (o: CreateManualOrderDto) => o.paymentMode === 'ONLINE_RECONCILED',
  )
  @IsString()
  @MinLength(1)
  paymentReference?: string;

  @ValidateIf((o: CreateManualOrderDto) => o.paymentMode === 'CASH')
  @IsInt()
  @Min(1)
  cashAmountNgn?: number;

  @ValidateIf((o: CreateManualOrderDto) => o.paymentMode === 'CASH')
  @IsString()
  @MinLength(1)
  cashCollectedBy?: string;
}
