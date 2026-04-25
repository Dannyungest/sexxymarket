import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { NotificationsService } from '../integrations/notifications.service';
import {
  buildReceiptViewUrl,
  orderIncludeForPaymentWebhook,
  type OrderForMerchantNotify,
  type OrderForReceiptEmail,
  storefrontBaseUrl,
  toReceiptLineRows,
} from '../orders/order-receipt.util';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

interface FlutterwaveWebhookPayload {
  type?: string;
  data?: {
    id?: string | number;
    tx_ref?: string;
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
  };
}

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post('webhooks/flutterwave')
  @HttpCode(200)
  async handleFlutterwaveWebhook(
    @Req() req: { rawBody?: Buffer },
    @Body() payload: FlutterwaveWebhookPayload,
    @Headers('flutterwave-signature') signature?: string,
    @Headers('verif-hash') legacySignature?: string,
  ) {
    const rawBody = req.rawBody?.toString('utf8') ?? '';
    const valid = this.paymentsService.isValidFlutterwaveWebhook(
      rawBody,
      signature,
      legacySignature,
    );
    if (!valid) {
      return { ok: false };
    }

    if (payload.type !== 'charge.completed') {
      return { ok: true };
    }

    const paymentStatus = payload.data?.status?.toLowerCase();
    const txRef = payload.data?.tx_ref ?? payload.data?.reference;
    const amount = payload.data?.amount;
    const currency = payload.data?.currency?.toUpperCase();

    if (!txRef || paymentStatus !== 'succeeded') {
      return { ok: true };
    }

    const order = await this.prisma.order.findFirst({
      where: { paymentReference: txRef },
      include: orderIncludeForPaymentWebhook,
    });
    if (!order) {
      return { ok: true };
    }

    const expectedAmount = Number(order.totalNgn);
    const paidAmount = Number(amount);
    const amountOk =
      Number.isFinite(paidAmount) &&
      Number.isFinite(expectedAmount) &&
      Math.abs(paidAmount - expectedAmount) < 0.01;
    if (!amountOk || currency !== 'NGN') {
      return { ok: false };
    }

    if (order.status === 'PAID') {
      return { ok: true };
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'PAID' },
    });

    const buyerEmail =
      (order.guestEmail && order.guestEmail.trim()) ||
      order.customer?.email ||
      '';
    const storeBase = storefrontBaseUrl();
    const receiptViewUrl = buildReceiptViewUrl(
      order.paymentReference,
      storeBase,
    );
    const lineRows = toReceiptLineRows(
      order as unknown as OrderForReceiptEmail,
    );
    if (buyerEmail) {
      void this.notificationsService.sendOrderReceiptEmail({
        to: buyerEmail,
        recipientName: order.recipientName,
        orderId: order.id,
        totalNgn: order.totalNgn,
        subtotalNgn: order.subtotalNgn,
        deliveryFeeNgn: order.deliveryFeeNgn,
        items: lineRows,
        shippingAddress: order.shippingAddress,
        shippingState: order.shippingState,
        shippingCity: order.shippingCity,
        recipientPhone: order.recipientPhone,
        receiptViewUrl,
      });
    }

    this.notificationsService.notifyMerchantsOnPaidOrder(
      order as unknown as OrderForMerchantNotify,
    );

    return { ok: true };
  }
}
