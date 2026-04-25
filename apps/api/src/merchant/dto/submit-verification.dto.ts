import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class KycDocumentItemDto {
  @IsString()
  documentType!: string;

  @IsOptional()
  @IsString()
  fileKey?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;
}

export class SubmitVerificationDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsIn(['MALE', 'FEMALE', 'OTHER'])
  gender!: 'MALE' | 'FEMALE' | 'OTHER';

  @IsString()
  dateOfBirth!: string;

  @IsString()
  idNumber!: string;

  @IsString()
  residentialAddress!: string;

  @IsString()
  businessName!: string;

  @IsIn([true, false] as const)
  isPhysicalStore!: boolean;

  @IsOptional()
  @IsString()
  physicalStoreAddress?: string;

  @IsIn(['NIN', 'VOTERS_CARD', 'DRIVERS_LICENSE', 'PASSPORT'])
  identityType!: 'NIN' | 'VOTERS_CARD' | 'DRIVERS_LICENSE' | 'PASSPORT';

  @IsOptional()
  @IsString()
  cacNumber?: string;

  @IsOptional()
  @IsString()
  tinNumber?: string;

  @IsString()
  businessAddress!: string;

  @IsOptional()
  @IsBoolean()
  isRegisteredBusinessUpgrade?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KycDocumentItemDto)
  documents!: KycDocumentItemDto[];
}
