import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import axios, { isAxiosError } from 'axios';
import crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly log = new Logger(PaymentsService.name);
  private readonly fallbackNigerianBanks = [
    { code: '044', name: 'Access Bank' },
    { code: '063', name: 'Access Bank (Diamond)' },
    { code: '014', name: 'Afribank (Legacy)' },
    { code: '023', name: 'Citibank Nigeria' },
    { code: '050', name: 'Ecobank Nigeria' },
    { code: '011', name: 'First Bank of Nigeria' },
    { code: '214', name: 'First City Monument Bank' },
    { code: '070', name: 'Fidelity Bank' },
    { code: '058', name: 'Guaranty Trust Bank' },
    { code: '030', name: 'Heritage Bank' },
    { code: '301', name: 'Jaiz Bank' },
    { code: '082', name: 'Keystone Bank' },
    { code: '526', name: 'Parallex Bank' },
    { code: '076', name: 'Polaris Bank' },
    { code: '101', name: 'Providus Bank' },
    { code: '221', name: 'Stanbic IBTC Bank' },
    { code: '068', name: 'Standard Chartered Bank Nigeria' },
    { code: '232', name: 'Sterling Bank' },
    { code: '100', name: 'Suntrust Bank Nigeria' },
    { code: '032', name: 'Union Bank of Nigeria' },
    { code: '033', name: 'United Bank For Africa' },
    { code: '215', name: 'Unity Bank' },
    { code: '035', name: 'Wema Bank' },
    { code: '057', name: 'Zenith Bank' },
    { code: '090110', name: 'VFD Microfinance Bank' },
    { code: '090267', name: 'Kuda Microfinance Bank' },
    { code: '999991', name: 'PalmPay' },
    { code: '999992', name: 'OPay' },
    { code: '999993', name: 'Moniepoint Microfinance Bank' },
  ];

  async listNigerianBanks() {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) return this.fallbackNigerianBanks;
    const apiBase =
      process.env.FLUTTERWAVE_API_BASE_URL ?? 'https://api.flutterwave.com';
    try {
      const response = await axios.get(`${apiBase}/v3/banks/NG`, {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      });
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      const remote = rows
        .map((row: { code?: string; name?: string }) => ({
          code: String(row.code ?? '').trim(),
          name: String(row.name ?? '').trim(),
        }))
        .filter((row: { code: string; name: string }) => row.code && row.name);
      const merged = [...remote, ...this.fallbackNigerianBanks];
      const dedup = new Map<string, { code: string; name: string }>();
      for (const bank of merged) {
        const key = `${bank.code}:${bank.name}`.toLowerCase();
        if (!dedup.has(key)) dedup.set(key, bank);
      }
      return [...dedup.values()].sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return this.fallbackNigerianBanks;
    }
  }

  async resolveNigerianBankAccount(bankCode: string, accountNumber: string) {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
      throw new BadGatewayException('Flutterwave secret key is missing');
    }
    const apiBase =
      process.env.FLUTTERWAVE_API_BASE_URL ?? 'https://api.flutterwave.com';
    try {
      const response = await axios.get(`${apiBase}/v3/accounts/resolve`, {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        params: {
          account_number: accountNumber,
          account_bank: bankCode,
        },
      });
      const accountName = String(
        response.data?.data?.account_name ?? '',
      ).trim();
      if (!accountName) {
        throw new BadGatewayException('Could not resolve account name');
      }
      return {
        accountName,
        accountNumber: String(
          response.data?.data?.account_number ?? accountNumber,
        ),
      };
    } catch {
      throw new BadGatewayException(
        'Unable to verify account details right now',
      );
    }
  }

  async createFlutterwavePaymentLink(args: {
    orderId: string;
    amountNgn: number;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
  }) {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
      throw new BadGatewayException('Flutterwave secret key is missing');
    }

    const reference = this.buildReference(args.orderId);
    const storeBase = (
      process.env.STOREFRONT_URL ||
      process.env.NEXT_PUBLIC_STOREFRONT_URL ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
    const redirectUrl =
      process.env.FLUTTERWAVE_REDIRECT_URL?.trim() ||
      `${storeBase}/order/complete`;
    const apiBase =
      process.env.FLUTTERWAVE_API_BASE_URL ?? 'https://api.flutterwave.com';
    const logoUrl = process.env.FLUTTERWAVE_LOGO_URL?.trim();
    const phone = args.customerPhone?.replace(/\s+/g, '') ?? '';
    /** Empty or very short values can make Flutterwave reject the request. */
    const body: Record<string, unknown> = {
      tx_ref: reference,
      amount: args.amountNgn,
      currency: 'NGN',
      redirect_url: redirectUrl,
      customer: {
        email: args.customerEmail,
        name: args.customerName,
        ...(phone.length >= 10 ? { phonenumber: phone } : {}),
      },
      customizations: {
        title: 'Sexxy Market',
        description: `Payment for order ${args.orderId}`,
        ...(logoUrl ? { logo: logoUrl } : {}),
      },
      meta: {
        orderId: args.orderId,
      },
    };

    try {
      const response = await axios.post(`${apiBase}/v3/payments`, body, {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      const data = response.data;
      if (String(data?.status).toLowerCase() !== 'success') {
        const msg =
          this.flutterwaveErrorMessageFromBody(data) ??
          'Flutterwave returned an error';
        this.log.warn(
          `Flutterwave payments non-success: ${JSON.stringify(data)}`,
        );
        throw new BadGatewayException(msg);
      }

      const paymentLink = data?.data?.link as string | undefined;
      if (!paymentLink) {
        this.log.warn(
          `Flutterwave missing link: ${JSON.stringify({ status: data?.status, data: data?.data })}`,
        );
        throw new BadGatewayException(
          'Flutterwave did not return a checkout link. Check that FLUTTERWAVE_SECRET_KEY is your secret key (starts with FLWSECK_) in the same mode (test vs live) as your app.',
        );
      }

      return { paymentReference: reference, paymentLink };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      if (isAxiosError(error)) {
        const fromApi = this.flutterwaveErrorMessageFromBody(
          error.response?.data,
        );
        const code = error.response?.status;
        this.log.warn(
          `Flutterwave /v3/payments failed${code != null ? ` (HTTP ${code})` : ''}: ${fromApi ?? error.message}`,
        );
        throw new BadGatewayException(
          fromApi ??
            `Unable to reach Flutterwave to start checkout (HTTP ${code ?? 'n/a'})`,
        );
      }
      this.log.error(
        'Flutterwave /v3/payments unexpected error',
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadGatewayException(
        'Unable to initialize Flutterwave checkout',
      );
    }
  }

  private flutterwaveErrorMessageFromBody(data: unknown): string | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const o = data as { message?: unknown; data?: unknown; errors?: unknown };
    if (typeof o.message === 'string' && o.message.trim()) {
      return o.message.trim();
    }
    if (o.data && typeof o.data === 'object') {
      const d = o.data as { message?: string };
      if (typeof d.message === 'string' && d.message.trim()) {
        return d.message.trim();
      }
    }
    if (Array.isArray(o.errors) && o.errors.length) {
      return o.errors
        .map((e) => (typeof e === 'string' ? e : JSON.stringify(e)))
        .join(' ');
    }
    return undefined;
  }

  isValidFlutterwaveWebhook(
    rawBody: string,
    signature?: string,
    fallbackHash?: string,
  ) {
    const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
    if (!secretHash) {
      return false;
    }

    const normalizedFallback = fallbackHash?.trim();
    if (
      normalizedFallback &&
      this.safeCompare(normalizedFallback, secretHash)
    ) {
      return true;
    }

    if (!signature) {
      return false;
    }

    const digest = crypto
      .createHmac('sha256', secretHash)
      .update(rawBody)
      .digest('base64');
    return this.safeCompare(digest, signature.trim());
  }

  private safeCompare(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  }

  private buildReference(orderId: string) {
    return `SM-${orderId}-${Date.now()}`;
  }
}
