import {
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class ReviewVerificationDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @ValidateIf((o: ReviewVerificationDto) => o.decision === 'REJECTED')
  @IsString()
  @MinLength(2, { message: 'A rejection reason is required.' })
  reason?: string;

  @IsOptional()
  @ValidateIf((o: ReviewVerificationDto) => o.decision === 'APPROVED')
  @IsIn(['STANDARD', 'SUPER'])
  merchantTier?: 'STANDARD' | 'SUPER';
}
