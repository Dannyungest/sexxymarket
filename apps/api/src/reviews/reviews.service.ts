import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  listForProduct(productId: string) {
    return this.prisma.review.findMany({
      where: { productId },
      include: {
        user: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async summary(productId: string) {
    const aggregate = await this.prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return {
      averageRating: aggregate._avg.rating ?? 0,
      totalReviews: aggregate._count._all,
    };
  }

  async reviewEligibility(productId: string, userId: string) {
    const orderItem = await this.prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId,
          status: 'DELIVERED',
        },
      },
      include: { order: true },
      orderBy: { order: { createdAt: 'desc' } },
    });

    if (!orderItem) {
      return { canReview: false };
    }

    const existingReview = await this.prisma.review.findFirst({
      where: {
        productId,
        userId,
        orderId: orderItem.orderId,
      },
    });

    if (existingReview) {
      return { canReview: false };
    }

    return { canReview: true, orderId: orderItem.orderId };
  }

  async listForMerchant(userId: string) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
    });
    if (!profile) return [];
    return this.prisma.review.findMany({
      where: {
        product: {
          merchantId: profile.id,
        },
      },
      include: {
        product: { select: { id: true, name: true, slug: true } },
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, payload: CreateReviewDto) {
    const paidOrderItem = await this.prisma.orderItem.findFirst({
      where: {
        orderId: payload.orderId,
        productId: payload.productId,
        order: {
          userId,
          status: 'DELIVERED',
        },
      },
    });

    if (!paidOrderItem) {
      throw new BadRequestException(
        'Only verified buyers can review delivered orders',
      );
    }

    return this.prisma.review.create({
      data: {
        userId,
        productId: payload.productId,
        orderId: payload.orderId,
        rating: payload.rating,
        comment: payload.comment,
      },
    });
  }
}
