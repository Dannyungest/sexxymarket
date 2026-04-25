import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSupportMessageDto {
  @IsIn(['ORDER', 'PRODUCT', 'TRANSACTION', 'ACCOUNT', 'GENERAL'] as const)
  category!: 'ORDER' | 'PRODUCT' | 'TRANSACTION' | 'ACCOUNT' | 'GENERAL';

  @IsString()
  @MinLength(3)
  @MaxLength(140)
  subject!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message!: string;

  @IsOptional()
  @IsString()
  orderId?: string;
}
