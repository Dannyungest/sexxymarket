import { IsString, Length } from 'class-validator';

export class SetPayoutAccountDto {
  @IsString()
  @Length(3, 10)
  bankCode!: string;

  @IsString()
  @Length(10, 10)
  accountNumber!: string;

  @IsString()
  @Length(2, 120)
  accountName!: string;
}
