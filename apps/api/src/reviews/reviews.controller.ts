import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('product/:productId')
  listForProduct(@Param('productId') productId: string) {
    return this.reviewsService.listForProduct(productId);
  }

  @Get('product/:productId/summary')
  summary(@Param('productId') productId: string) {
    return this.reviewsService.summary(productId);
  }

  @Get('eligibility/:productId')
  @UseGuards(JwtAuthGuard)
  eligibility(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
  ) {
    return this.reviewsService.reviewEligibility(productId, user.sub);
  }

  @Get('merchant/mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT')
  listMine(@CurrentUser() user: AuthUser) {
    return this.reviewsService.listForMerchant(user.sub);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() payload: CreateReviewDto) {
    return this.reviewsService.create(user.sub, payload);
  }
}
