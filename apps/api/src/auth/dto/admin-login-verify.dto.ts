import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class AdminLoginVerifyDto {
  @IsString()
  challengeId!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsOptional()
  @IsBoolean()
  keepSignedIn?: boolean;
}
