import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsNumber,
  Matches,
  IsString,
  MaxLength,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class ProductMediaDto {
  @IsString()
  imageUrl!: string;

  @IsOptional()
  @IsString()
  storageKey?: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsString()
  variantId?: string;
}

class ProductOptionValueDto {
  @IsString()
  @MinLength(1)
  value!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  storageKey?: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

class ProductOptionDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsIn(['TEXT', 'SWATCH', 'SIZE', 'DIMENSION', 'PACK'])
  displayType?: 'TEXT' | 'SWATCH' | 'SIZE' | 'DIMENSION' | 'PACK';

  @IsOptional()
  @IsString()
  guideText?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductOptionValueDto)
  values!: ProductOptionValueDto[];
}

class ProductVariantSelectionDto {
  @IsString()
  @MinLength(1)
  optionName!: string;

  @IsString()
  @MinLength(1)
  value!: string;
}

class ProductVariantDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @IsOptional()
  @IsInt()
  extraPriceNgn?: number;

  @IsInt()
  @Min(0)
  stock!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantSelectionDto)
  selections?: ProductVariantSelectionDto[];
}

class VariationGuideTableRowDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsArray()
  @IsString({ each: true })
  cells!: string[];
}

class VariationGuideTableDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsArray()
  @IsString({ each: true })
  headers!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariationGuideTableRowDto)
  rows!: VariationGuideTableRowDto[];
}

class RichDescriptionBlockDto {
  /** Client-only block id (authoring UI); ignored by persistence logic */
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsIn(['heading', 'paragraph', 'bullets'])
  type!: 'heading' | 'paragraph' | 'bullets';

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  text?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  items?: string[];

  @IsOptional()
  @IsBoolean()
  bold?: boolean;

  @IsOptional()
  @IsBoolean()
  italic?: boolean;
}

class RichDescriptionDocDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RichDescriptionBlockDto)
  blocks!: RichDescriptionBlockDto[];
}

export class CreateProductDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{8,16}$/, {
    message: 'productCode must contain digits only (8-16 characters).',
  })
  productCode?: string;

  @IsString()
  @MaxLength(12000)
  description!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RichDescriptionDocDto)
  descriptionRich?: RichDescriptionDocDto;

  @IsInt()
  @Min(100)
  priceNgn!: number;

  @IsInt()
  @Min(0)
  stock!: number;

  @IsString()
  categoryId!: string;

  @IsOptional()
  @IsString()
  variationGuide?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => VariationGuideTableDto)
  variationGuideTable?: VariationGuideTableDto;

  @IsOptional()
  @IsIn(['SAVE_DRAFT', 'SUBMIT_REVIEW', 'PUBLISH', 'AUTOSAVE'])
  lifecycleAction?: 'SAVE_DRAFT' | 'SUBMIT_REVIEW' | 'PUBLISH' | 'AUTOSAVE';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  autosaveCheckpointId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  autosaveVersion?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductMediaDto)
  media?: ProductMediaDto[];

  @IsOptional()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsBoolean()
  requiresManualApproval?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductOptionDto)
  options?: ProductOptionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];
}
