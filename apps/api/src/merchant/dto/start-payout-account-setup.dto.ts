import { IsString, Length } from 'class-validator';

export class StartPayoutAccountSetupDto {
  @IsString()
  @Length(3, 10)
  bankCode!: string;

  @IsString()
  @Length(10, 10)
  accountNumber!: string;
}
