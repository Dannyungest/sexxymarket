import { IsInt, IsString, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @IsString()
  productId!: string;

  @IsString()
  orderId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  comment!: string;
}
