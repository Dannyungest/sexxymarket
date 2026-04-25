import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentGateway } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateManualOrderDto } from './dto/create-manual-order.dto';
import { NotificationsService } from '../integrations/notifications.service';
import { BackgroundJobsService } from '../integrations/background-jobs.service';
import {
  buildReceiptViewUrl,
  orderIncludeForPaymentWebhook,
  orderReceiptInclude,
  type OrderForMerchantNotify,
  type OrderForReceiptEmail,
  storefrontBaseUrl,
  toReceiptLineRows,
} from './order-receipt.util';

const PLATFORM_COMMISSION_PERCENT = 5;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly notificationsService: NotificationsService,
    private readonly backgroundJobs: BackgroundJobsService,
  ) {}

  private async generateTrackingNumber() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `SM-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const existing = await this.prisma.order.findUnique({
        where: { trackingNumber: candidate },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
    }
    return `SM-${Date.now().toString(36).toUpperCase()}-${Math.floor(10000 + Math.random() * 90000)}`;
  }

  async createOrder(payload: CreateOrderDto, userId?: string) {
    const customer = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, role: true, emailVerifiedAt: true },
        })
      : null;
    if (
      customer &&
      customer.role === 'CUSTOMER' &&
      customer.emailVerifiedAt == null
    ) {
      throw new BadRequestException(
        'Please verify your email before placing an order',
      );
    }
    const checkoutEmail = payload.guestEmail ?? customer?.email;
    if (!checkoutEmail) {
      throw new BadRequestException(
        'Email is required to complete Flutterwave checkout',
      );
    }

    const productIds = payload.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isApproved: true, isHidden: false },
      include: { merchant: true, variants: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('Some items are not available');
    }

    let subtotalNgn = 0;
    const orderItems = payload.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        throw new BadRequestException('Invalid product');
      }
      const selectedVariant = item.variantId
        ? product.variants.find((variant) => variant.id === item.variantId)
        : undefined;
      if (item.variantId && !selectedVariant) {
        throw new BadRequestException(
          `Invalid variant selection for ${product.name}`,
        );
      }
      const availableStock = selectedVariant?.stock ?? product.stock;
      if (availableStock < item.quantity) {
        throw new BadRequestException(`Insufficient stock for ${product.name}`);
      }
      const unitPriceNgn =
        product.priceNgn + (selectedVariant?.extraPriceNgn ?? 0);
      const lineTotalNgn = unitPriceNgn * item.quantity;
      subtotalNgn += lineTotalNgn;
      return {
        productId: product.id,
        variantId: selectedVariant?.id,
        quantity: item.quantity,
        unitPriceNgn,
        lineTotalNgn,
        merchantId: product.merchantId,
        productCodeSnapshot: product.productCode,
        variantSkuSnapshot: selectedVariant?.sku ?? null,
        variantLabelSnapshot: selectedVariant?.label ?? null,
      };
    });

    const commissionNgn = Math.floor(
      (subtotalNgn * PLATFORM_COMMISSION_PERCENT) / 100,
    );
    const deliveryFeeNgn = 0;
    const totalNgn = subtotalNgn + deliveryFeeNgn;

    const order = await this.prisma.order.create({
      data: {
        userId,
        paymentGateway: PaymentGateway.FLUTTERWAVE,
        trackingNumber: await this.generateTrackingNumber(),
        subtotalNgn,
        deliveryFeeNgn,
        totalNgn,
        shippingAddress: payload.shippingAddress,
        shippingState: payload.shippingState,
        shippingCity: payload.shippingCity,
        recipientPhone: payload.recipientPhone,
        recipientName: payload.recipientName,
        guestEmail: payload.guestEmail,
        guestPhone: payload.guestPhone,
        commissionNgn,
        items: {
          create: orderItems,
        },
      },
      include: { items: true },
    });

    for (const item of orderItems) {
      if (item.variantId) {
        await this.prisma.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
      } else {
        await this.prisma.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
    }

    const payment = await this.paymentsService.createFlutterwavePaymentLink({
      orderId: order.id,
      amountNgn: order.totalNgn,
      customerName: payload.recipientName,
      customerEmail: checkoutEmail,
      customerPhone: payload.recipientPhone,
    });

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: payment,
    });

    // No "payment link" email here — the customer is sent to Flutterwave from checkout,
    // then receives a full receipt by email and on /order/complete after payment succeeds.

    return updated;
  }

  getPublicReceiptByTxRef(paymentRef: string) {
    return this.prisma.order
      .findFirst({
        where: { paymentReference: paymentRef.trim() },
        include: orderReceiptInclude,
      })
      .then((order) => {
        if (!order) {
          throw new NotFoundException('Order not found for this reference');
        }
        return {
          id: order.id,
          status: order.status,
          paymentReference: order.paymentReference,
          totalNgn: order.totalNgn,
          subtotalNgn: order.subtotalNgn,
          deliveryFeeNgn: order.deliveryFeeNgn,
          recipientName: order.recipientName,
          recipientPhone: order.recipientPhone,
          shippingAddress: order.shippingAddress,
          shippingState: order.shippingState,
          shippingCity: order.shippingCity,
          trackingNumber: order.trackingNumber,
          createdAt: order.createdAt,
          items: toReceiptLineRows(order as unknown as OrderForReceiptEmail),
        };
      });
  }

  listOrdersForUser(
    userId: string,
    options?: { cursor?: string; limit?: number },
  ) {
    const take = Math.min(100, Math.max(1, options?.limit ?? 30));
    return this.prisma.order
      .findMany({
        where: { userId },
        include: { items: { include: { product: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
        ...(options?.cursor
          ? {
              cursor: { id: options.cursor },
              skip: 1,
            }
          : {}),
      })
      .then((orders) => {
        const hasMore = orders.length > take;
        const items = hasMore ? orders.slice(0, take) : orders;
        return {
          items,
          nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
          hasMore,
        };
      });
  }

  listAllOrders(options?: { cursor?: string; limit?: number }) {
    const take = Math.min(200, Math.max(1, options?.limit ?? 50));
    return this.prisma.order
      .findMany({
        include: { items: { include: { product: true } }, customer: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
        ...(options?.cursor
          ? {
              cursor: { id: options.cursor },
              skip: 1,
            }
          : {}),
      })
      .then((orders) => {
        const hasMore = orders.length > take;
        const items = hasMore ? orders.slice(0, take) : orders;
        return {
          items,
          nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
          hasMore,
        };
      });
  }

  /**
   * Admin-recorded order (in-person / phone / reconciled payment). No Flutterwave.
   */
  async createManualOrderForAdmin(
    payload: CreateManualOrderDto,
    _actorId: string,
  ) {
    if (!payload.userId && !payload.guestEmail) {
      throw new BadRequestException(
        'Provide either a registered user (userId) or guest email',
      );
    }

    let accountEmail: string | undefined;
    if (payload.userId) {
      const u = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true },
      });
      if (!u) {
        throw new NotFoundException('User not found');
      }
      accountEmail = u.email;
    }

    const productIds = payload.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isApproved: true, isHidden: false },
      include: { merchant: true, variants: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('Some items are not available');
    }

    let subtotalNgn = 0;
    const orderItems = payload.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        throw new BadRequestException('Invalid product');
      }
      const selectedVariant = item.variantId
        ? product.variants.find((v) => v.id === item.variantId)
        : undefined;
      if (item.variantId && !selectedVariant) {
        throw new BadRequestException(
          `Invalid variant selection for ${product.name}`,
        );
      }
      const availableStock = selectedVariant?.stock ?? product.stock;
      if (availableStock < item.quantity) {
        throw new BadRequestException(`Insufficient stock for ${product.name}`);
      }
      const unitPriceNgn =
        product.priceNgn + (selectedVariant?.extraPriceNgn ?? 0);
      const lineTotalNgn = unitPriceNgn * item.quantity;
      subtotalNgn += lineTotalNgn;
      return {
        productId: product.id,
        variantId: selectedVariant?.id,
        quantity: item.quantity,
        unitPriceNgn,
        lineTotalNgn,
        merchantId: product.merchantId,
        productCodeSnapshot: product.productCode,
        variantSkuSnapshot: selectedVariant?.sku ?? null,
        variantLabelSnapshot: selectedVariant?.label ?? null,
      };
    });

    const commissionNgn = Math.floor(
      (subtotalNgn * PLATFORM_COMMISSION_PERCENT) / 100,
    );
    const deliveryFeeNgn = 0;
    const totalNgn = subtotalNgn + deliveryFeeNgn;
    const paymentGateway =
      payload.paymentMode === 'CASH'
        ? PaymentGateway.MANUAL_CASH
        : PaymentGateway.MANUAL_ONLINE;
    const resolvedGuestEmail = payload.guestEmail;
    const userId: string | null = payload.userId ?? null;
    const guestEmailStored = accountEmail ?? resolvedGuestEmail ?? null;

    const order = await this.prisma.order.create({
      data: {
        userId,
        status: 'PAID',
        paymentGateway,
        paymentReference: payload.paymentReference ?? null,
        cashAmountNgn:
          payload.paymentMode === 'CASH'
            ? (payload.cashAmountNgn ?? null)
            : null,
        cashCollectedBy:
          payload.paymentMode === 'CASH'
            ? (payload.cashCollectedBy?.trim() ?? null)
            : null,
        paymentLink: null,
        trackingNumber: await this.generateTrackingNumber(),
        subtotalNgn,
        deliveryFeeNgn,
        totalNgn,
        shippingAddress: payload.shippingAddress,
        shippingState: payload.shippingState,
        shippingCity: payload.shippingCity,
        recipientPhone: payload.recipientPhone,
        recipientName: payload.recipientName,
        guestEmail: guestEmailStored,
        guestPhone: payload.guestPhone ?? null,
        commissionNgn,
        items: { create: orderItems },
      },
      include: { items: { include: { product: true } }, customer: true },
    });

    for (const line of orderItems) {
      if (line.variantId) {
        await this.prisma.productVariant.update({
          where: { id: line.variantId },
          data: { stock: { decrement: line.quantity } },
        });
      } else {
        await this.prisma.product.update({
          where: { id: line.productId },
          data: { stock: { decrement: line.quantity } },
        });
      }
    }

    const emailForNotify =
      order.guestEmail ?? order.customer?.email ?? resolvedGuestEmail;
    const forReceipt = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: orderReceiptInclude,
    });
    if (forReceipt && emailForNotify) {
      const lines = toReceiptLineRows(
        forReceipt as unknown as OrderForReceiptEmail,
      );
      this.backgroundJobs.enqueue('manual-order-receipt-email', async () => {
        await this.notificationsService.sendOrderReceiptEmail({
          to: emailForNotify,
          recipientName: payload.recipientName,
          orderId: forReceipt.id,
          totalNgn: forReceipt.totalNgn,
          subtotalNgn: forReceipt.subtotalNgn,
          deliveryFeeNgn: forReceipt.deliveryFeeNgn,
          items: lines,
          shippingAddress: forReceipt.shippingAddress,
          shippingState: forReceipt.shippingState,
          shippingCity: forReceipt.shippingCity,
          recipientPhone: forReceipt.recipientPhone,
          receiptViewUrl: buildReceiptViewUrl(
            forReceipt.paymentReference,
            storefrontBaseUrl(),
          ),
        });
      });
    }

    const forMerchants = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: orderIncludeForPaymentWebhook,
    });
    if (forMerchants) {
      this.backgroundJobs.enqueue('manual-order-merchant-notify', async () => {
        this.notificationsService.notifyMerchantsOnPaidOrder(
          forMerchants as unknown as OrderForMerchantNotify,
        );
      });
    }

    return order;
  }
}
