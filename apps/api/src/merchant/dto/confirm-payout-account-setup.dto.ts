import { IsString, Length } from 'class-validator';

export class ConfirmPayoutAccountSetupDto {
  @IsString()
  challengeId!: string;

  @IsString()
  @Length(4, 8)
  code!: string;
}
