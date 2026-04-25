import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RemoveListingDto {
  @IsOptional()
  @IsString()
  @MaxLength(250)
  reason?: string;
}
