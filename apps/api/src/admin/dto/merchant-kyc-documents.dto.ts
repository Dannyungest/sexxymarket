import { IsOptional, IsString, MinLength } from 'class-validator';

export class MerchantKycDocumentRefDto {
  @IsString()
  @MinLength(2)
  documentType!: string;

  @IsString()
  @MinLength(1)
  fileName!: string;
}

export class MerchantKycDocumentAppendDto {
  @IsOptional()
  @IsString()
  verificationId?: string;

  @IsString()
  @MinLength(2)
  documentType!: string;

  @IsString()
  @MinLength(1)
  fileKey!: string;

  @IsString()
  @MinLength(1)
  fileUrl!: string;
}
