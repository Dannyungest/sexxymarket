import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class ProductImageUploadCompleteDto {
  @IsString()
  @MinLength(1)
  key!: string;

  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  altText?: string;
}
