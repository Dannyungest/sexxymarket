import { IsString, MinLength } from 'class-validator';

export class ProductImageUploadDto {
  @IsString()
  @MinLength(1)
  fileName!: string;
}
