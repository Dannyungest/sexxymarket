import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RemoveAdminUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(250)
  reason?: string;
}
