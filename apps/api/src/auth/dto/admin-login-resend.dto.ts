import { IsString } from 'class-validator';

export class AdminLoginResendDto {
  @IsString()
  challengeId!: string;
}
