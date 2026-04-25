import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { OrderForMerchantNotify } from '../orders/order-receipt.util';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly brandName = 'SexxyMarket';
  private readonly supportEmail =
    process.env.SUPPORT_EMAIL ?? 'support@sexxymarket.com';
  /** Email logo render size tuned for broad client compatibility. */
  private readonly emailLogoWidth = 168;
  private readonly emailLogoMaxWidth = 200;
  /** Receipt product thumbnail size for visual consistency in tables. */
  private readonly emailLineImageSize = 72;

  private escapeEmailHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Absolute URL for optional full logo in HTML emails (PNG/JPG recommended). */
  private emailBrandLogoUrl(): string {
    const explicit = process.env.BRAND_EMAIL_LOGO_URL?.trim();
    if (explicit) return explicit;
    const base = (
      process.env.STOREFRONT_URL ??
      process.env.NEXT_PUBLIC_STOREFRONT_URL ??
      'https://sexxymarket.com'
    ).replace(/\/$/, '');
    return `${base}/sexxymarketlogo.png`;
  }

  /** Single brand logo row (no monogram) — uses sexxymarketlogo.png via `emailBrandLogoUrl()`. */
  private emailBrandHeaderRow(): string {
    const logoUrl = this.emailBrandLogoUrl();
    const img = `<img src="${logoUrl}" alt="${this.brandName}" width="${this.emailLogoWidth}" style="display:block;width:100%;max-width:${this.emailLogoMaxWidth}px;height:auto;border-radius:4px;object-fit:contain;" onerror="this.style.display='none';" />`;
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="vertical-align:middle;padding:0 0 4px 0;">${img}</td></tr><tr><td style="vertical-align:middle;padding-top:4px;"><strong style="font-size:15px;letter-spacing:0.02em;">${this.brandName}</strong></td></tr></table>`;
  }

  private buildEmailShell(input: {
    preheader: string;
    eyebrow: string;
    title: string;
    introHtml: string;
    ctaLabel?: string;
    ctaUrl?: string;
    bodyHtml?: string;
    footerNote?: string;
  }) {
    const cta =
      input.ctaLabel && input.ctaUrl
        ? `<a href="${input.ctaUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600">${input.ctaLabel}</a>`
        : '';
    return `
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${input.preheader}</div>
      <div style="margin:0;padding:24px;background:#f3f4f6;font-family:Inter,Arial,sans-serif;color:#111827;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="padding:18px 22px;background:linear-gradient(120deg,#1b1229,#2a1f3f 38%,#c79a54);color:#ffffff;">
            ${this.emailBrandHeaderRow()}
            <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;opacity:.88;margin-top:8px;">${input.eyebrow}</div>
            <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;">${input.title}</h1>
          </div>
          <div style="padding:22px;">
            <div style="font-size:15px;line-height:1.7;color:#111827;">${input.introHtml}</div>
            ${
              cta
                ? `<div style="margin-top:18px;margin-bottom:18px;">${cta}</div>`
                : ''
            }
            ${input.bodyHtml ?? ''}
          </div>
          <div style="padding:14px 22px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.6;">
            <p style="margin:0 0 8px;">Need help? Contact <a href="mailto:${this.supportEmail}" style="color:#4b5563;">${this.supportEmail}</a>.</p>
            <p style="margin:0;">${input.footerNote ?? `This message was sent by ${this.brandName}. If you did not request this action, you can ignore this email.`}</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Full purchase receipt: line items with thumbnails (customer gets this only after
   * payment is confirmed, not on “generate payment” / pending checkout).
   */
  async sendOrderReceiptEmail(input: {
    to: string;
    recipientName: string;
    orderId: string;
    totalNgn: number;
    subtotalNgn: number;
    deliveryFeeNgn: number;
    items: {
      name: string;
      imageUrl: string;
      quantity: number;
      lineTotalNgn: number;
      variantLabel: string | null;
    }[];
    shippingAddress: string;
    shippingState: string;
    shippingCity: string;
    recipientPhone: string;
    receiptViewUrl: string;
  }) {
    const name = this.escapeEmailHtml(input.recipientName);
    const subject = `Your SexxyMarket receipt — order ${input.orderId.slice(0, 8)}… paid`;
    const lineRows = input.items
      .map((line) => {
        const title = this.escapeEmailHtml(line.name);
        const variant = line.variantLabel
          ? `<p style="margin:4px 0 0 0;font-size:13px;color:#6b7280;">${this.escapeEmailHtml(line.variantLabel)}</p>`
          : '';
        const thumb = this.emailLineImageSize;
        const thumbCell = thumb + 8;
        return `<tr>
<td style="padding:10px 8px 10px 0;vertical-align:top;width:${thumbCell}px;border-bottom:1px solid #e5e7eb;">
  <img src="${this.escapeEmailHtml(line.imageUrl)}" alt="" width="${thumb}" height="${thumb}" style="display:block;width:${thumb}px;height:${thumb}px;border-radius:8px;object-fit:cover;border:1px solid #e5e7eb;background:#fff;"/>
</td>
<td style="padding:10px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;">
  <p style="margin:0;font-weight:600;">${title}</p>${variant}
  <p style="margin:6px 0 0 0;font-size:14px;">Qty <strong>${line.quantity}</strong> &nbsp;·&nbsp; <strong>NGN ${line.lineTotalNgn.toLocaleString()}</strong></p>
</td>
</tr>`;
      })
      .join('');
    const itemsTable = `<table role="presentation" style="width:100%;border-collapse:collapse;" cellpadding="0" cellspacing="0">${lineRows}</table>`;
    const addressBlock = `<p style="margin:0;"><strong>Ship to</strong><br/>${this.escapeEmailHtml(
      input.recipientName,
    )} · ${this.escapeEmailHtml(input.recipientPhone)}</p>
<p style="margin:8px 0 0 0;">${this.escapeEmailHtml(
      [input.shippingAddress, input.shippingCity, input.shippingState]
        .filter(Boolean)
        .join(' · '),
    )}</p>`;
    const bodyHtml = `${itemsTable}
<p style="margin:12px 0 0 0;padding-top:10px;border-top:1px solid #e5e7eb;">
<strong>Subtotal</strong> NGN ${input.subtotalNgn.toLocaleString()}<br/>
<strong>Delivery</strong> NGN ${input.deliveryFeeNgn.toLocaleString()}<br/>
<strong>Total paid</strong> NGN ${input.totalNgn.toLocaleString()}
</p>
${addressBlock}`;
    const html = this.buildEmailShell({
      preheader: 'Your payment is confirmed — here is your order summary.',
      eyebrow: 'Purchase complete',
      title: 'Thanks for your order',
      introHtml: `<p style="margin:0;">Hello ${name},</p><p style="margin:8px 0 0 0;">Your payment was <strong>successful</strong>. A summary of your purchase is below (same as your online receipt).</p>`,
      ctaLabel: 'View receipt online',
      ctaUrl: input.receiptViewUrl,
      bodyHtml,
    });
    await this.sendEmail({ to: input.to, subject, html });
  }

  /**
   * Notifies a merchant that a paid order includes at least one of their products
   * (line items) plus the customer’s delivery / recipient details for fulfillment.
   */
  async sendMerchantOrderItemsPaid(input: {
    toEmail: string;
    businessName: string;
    orderId: string;
    lines: Array<{
      productName: string;
      quantity: number;
      lineTotalNgn: number;
    }>;
    orderTotalNgn: number;
    recipientName: string;
    recipientPhone: string;
    shippingAddress: string;
    shippingState: string;
    shippingCity: string;
  }) {
    const subj = `New paid order (your items) — ${input.orderId.slice(0, 8)}…`;
    const rows = input.lines
      .map(
        (l) =>
          `<tr><td style="padding:6px 0;border-bottom:1px solid #e5e7eb;">${this.escapeEmailHtml(l.productName)}</td><td style="text-align:center;padding:6px 8px;border-bottom:1px solid #e5e7eb;">${l.quantity}</td><td style="text-align:right;padding:6px 0;border-bottom:1px solid #e5e7eb;">NGN ${l.lineTotalNgn.toLocaleString()}</td></tr>`,
      )
      .join('');
    const table = `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0;"><thead><tr><th align="left" style="border-bottom:2px solid #e5e7eb;">Product</th><th style="border-bottom:2px solid #e5e7eb;">Qty</th><th align="right" style="border-bottom:2px solid #e5e7eb;">Line</th></tr></thead><tbody>${rows}</tbody></table>`;
    const addressLine = [
      input.shippingAddress,
      input.shippingCity,
      input.shippingState,
    ]
      .map((s) => String(s ?? '').trim())
      .filter(Boolean)
      .join(' · ');
    const delivery = `<p style="margin:14px 0 0 0;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;line-height:1.6;">
<strong>Ship to (delivery &amp; recipient)</strong><br/>
${this.escapeEmailHtml(String(input.recipientName ?? ''))} · ${this.escapeEmailHtml(String(input.recipientPhone ?? ''))}<br/>
${this.escapeEmailHtml(addressLine)}
</p>`;
    const bodyHtml = `${table}${delivery}<p style="margin:10px 0 0 0;font-size:13px;color:#4b5563;">Full order total (all items in the cart) was <strong>NGN ${input.orderTotalNgn.toLocaleString()}</strong>. Open your seller dashboard for the full order and next steps.</p>`;
    const html = this.buildEmailShell({
      preheader: 'A paid order includes products from your store.',
      eyebrow: 'New order (paid)',
      title: `New paid order for ${this.escapeEmailHtml(input.businessName)}`,
      introHtml: `<p style="margin:0;">Hello,</p><p style="margin:8px 0 0 0;">A customer’s payment <strong>completed</strong> for <strong>order ${input.orderId}</strong>. Below are the items from <strong>${this.escapeEmailHtml(input.businessName)}</strong> in that order, and where to send them.</p>`,
      bodyHtml,
    });
    await this.sendEmail({ to: input.toEmail, subject: subj, html });
  }

  /**
   * One email per distinct merchant in the order (only merchants with a user email;
   * lines are grouped by merchant). Fire-and-forget safe (uses void in callers).
   */
  notifyMerchantsOnPaidOrder(order: OrderForMerchantNotify): void {
    const byMerchant = new Map<
      string,
      {
        email: string;
        businessName: string;
        lines: {
          productName: string;
          quantity: number;
          lineTotalNgn: number;
        }[];
      }
    >();
    for (const line of order.items) {
      const m = line.product.merchant;
      if (!m || !m.user?.email) continue;
      const entry = {
        productName: line.product.name,
        quantity: line.quantity,
        lineTotalNgn: line.lineTotalNgn,
      };
      const existing = byMerchant.get(m.id);
      if (existing) {
        existing.lines.push(entry);
      } else {
        byMerchant.set(m.id, {
          email: m.user.email,
          businessName: m.businessName,
          lines: [entry],
        });
      }
    }
    for (const m of byMerchant.values()) {
      void this.sendMerchantOrderItemsPaid({
        toEmail: m.email,
        businessName: m.businessName,
        orderId: order.id,
        lines: m.lines,
        orderTotalNgn: order.totalNgn,
        recipientName: order.recipientName,
        recipientPhone: order.recipientPhone,
        shippingAddress: order.shippingAddress,
        shippingState: order.shippingState,
        shippingCity: order.shippingCity,
      });
    }
  }

  async sendMerchantVerificationStatus(input: {
    email: string;
    businessName: string;
    status: 'APPROVED' | 'REJECTED';
    reason?: string;
  }) {
    const approved = input.status === 'APPROVED';
    const subject = approved
      ? `You’re approved — ${input.businessName} on ${this.brandName}`
      : `Verification could not be approved — ${this.brandName}`;
    const bodyHtml = approved
      ? `<p style="margin:10px 0 0 0;">Your KYC and documents are approved. You can sign in to the merchant portal, publish in line with your tier, and use all approved tools in your account.</p>`
      : input.reason
        ? `<p style="margin:10px 0 0 0;"><strong>Reason</strong><br/>${this.escapeEmailHtml(String(input.reason))}</p><p style="margin:10px 0 0 0;">You can submit an updated application from the verification flow when you’re ready.</p>`
        : undefined;
    const html = this.buildEmailShell({
      preheader: approved
        ? 'Your merchant verification was approved.'
        : 'We could not approve your verification submission.',
      eyebrow: 'Merchant compliance',
      title: approved ? 'Verification approved' : 'Verification not approved',
      introHtml: approved
        ? `<p style="margin:0;">Hi,</p><p style="margin:10px 0 0 0;">Good news: <strong>${input.businessName}</strong> has been <strong>approved</strong> for verification.</p>`
        : `<p style="margin:0;">Hi,</p><p style="margin:10px 0 0 0;">We reviewed <strong>${input.businessName}</strong> and could <strong>not</strong> approve the verification at this time.</p>`,
      bodyHtml,
    });
    await this.sendEmail({
      to: input.email,
      subject,
      html,
      from: process.env.ADMIN_AUTH_FROM_EMAIL ?? 'support@sexxymarket.com',
    });
  }

  async sendMerchantAccountStatus(input: {
    email: string;
    businessName: string;
    status: 'APPROVED' | 'REJECTED' | 'PAUSED' | 'BLACKLISTED';
    reason?: string;
  }) {
    const s = input.status;
    const subject =
      s === 'APPROVED'
        ? `Account active — ${input.businessName}`
        : s === 'REJECTED'
          ? `Account application not approved — ${input.businessName}`
          : `Account ${s.toLowerCase().replace('blacklisted', 'access restricted')}`;
    const preheader = `Update for ${input.businessName} on ${this.brandName}.`;
    const title =
      s === 'APPROVED'
        ? 'Your account is active'
        : s === 'REJECTED'
          ? 'Account not approved'
          : 'Account status changed';
    const introBase = `<p style="margin:0;">Business: <strong>${input.businessName}</strong></p><p style="margin:6px 0 0 0;">Status: <strong>${input.status}</strong></p>`;
    const bodyHtml = input.reason
      ? `<p style="margin:10px 0 0 0;"><strong>Details</strong><br/>${this.escapeEmailHtml(String(input.reason))}</p>`
      : undefined;
    const html = this.buildEmailShell({
      preheader,
      eyebrow: 'Merchant account',
      title,
      introHtml: introBase,
      bodyHtml,
    });
    await this.sendEmail({ to: input.email, subject, html });
  }

  async sendStorefrontEmailVerification(input: {
    email: string;
    firstName: string;
    token: string;
  }) {
    const base =
      process.env.STOREFRONT_URL ??
      process.env.NEXT_PUBLIC_STOREFRONT_URL ??
      'http://localhost:3000';
    const link = `${base.replace(/\/$/, '')}/account/verify-email?token=${encodeURIComponent(input.token)}`;
    const subject = 'Verify your SexxyMarket customer email';
    const html = this.buildEmailShell({
      preheader: 'Confirm your email to secure your account and checkout.',
      eyebrow: 'Customer account verification',
      title: `Hi ${input.firstName}, verify your email`,
      introHtml:
        '<p style="margin:0;">Confirm your email address to activate secure checkout, order updates, and account recovery.</p>',
      ctaLabel: 'Verify Email',
      ctaUrl: link,
      bodyHtml: `<p style="margin:0;">If the button does not open, copy and paste this link into your browser:</p><p style="margin:8px 0 0;word-break:break-all;color:#374151;">${link}</p>`,
      footerNote:
        'For security, this link is one-time and should only be used by you.',
    });
    await this.sendEmail({ to: input.email, subject, html });
  }

  async sendMerchantEmailVerification(input: {
    email: string;
    firstName: string;
    token: string;
  }) {
    const base =
      process.env.MERCHANT_PORTAL_URL ??
      process.env.NEXT_PUBLIC_MERCHANT_PORTAL_URL ??
      'http://localhost:3001';
    const link = `${base.replace(/\/$/, '')}/account/verify-email?token=${encodeURIComponent(input.token)}`;
    const subject = 'Verify your SexxyMarket merchant email';
    const html = this.buildEmailShell({
      preheader: 'Verify your merchant email to unlock portal actions.',
      eyebrow: 'Merchant account verification',
      title: `Welcome ${input.firstName}, verify your merchant email`,
      introHtml:
        '<p style="margin:0;">Complete email verification to continue merchant onboarding, product submission, and settlement setup.</p>',
      ctaLabel: 'Verify Merchant Email',
      ctaUrl: link,
      bodyHtml: `<p style="margin:0;">If the button does not open, use this direct link:</p><p style="margin:8px 0 0;word-break:break-all;color:#374151;">${link}</p>`,
      footerNote:
        'Never share your verification link. SexxyMarket staff will never ask for it.',
    });
    await this.sendEmail({ to: input.email, subject, html });
  }

  async sendAdminLoginVerificationCode(input: {
    email: string;
    firstName: string;
    code: string;
    expiresInMinutes: number;
  }) {
    const subject = 'Your admin login verification code';
    const html = this.buildEmailShell({
      preheader: 'Use this one-time code to complete secure admin sign-in.',
      eyebrow: 'Admin security check',
      title: `Hi ${input.firstName}, confirm this sign-in`,
      introHtml:
        '<p style="margin:0;">A fresh admin login was initiated for your account. Use the one-time code below to continue.</p>',
      bodyHtml: `
        <div style="margin:14px 0 16px;padding:14px;border:1px dashed #9ca3af;border-radius:10px;background:#f9fafb;text-align:center;">
          <div style="font-size:30px;letter-spacing:6px;font-weight:700;color:#111827;">${input.code}</div>
        </div>
        <p style="margin:0;color:#374151;">This code expires in <strong>${input.expiresInMinutes} minutes</strong> and can be used only once.</p>
      `,
      footerNote:
        'If this was not you, reset your password immediately and notify security.',
    });
    const from =
      process.env.ADMIN_AUTH_FROM_EMAIL ??
      process.env.RESEND_FROM_EMAIL ??
      'support@sexxymarket.com';
    const sent = await this.sendEmail({
      to: input.email,
      subject,
      html,
      from,
    });
    if (!sent) {
      throw new ServiceUnavailableException(
        'Verification email could not be sent. Confirm RESEND_API_KEY and a verified sender (RESEND_FROM_EMAIL or ADMIN_AUTH_FROM_EMAIL), then check API logs and your Resend dashboard.',
      );
    }
  }

  async sendPasswordResetOtp(input: {
    email: string;
    firstName: string;
    code: string;
    expiresInMinutes: number;
  }) {
    const subject = 'Your password reset verification code';
    const html = this.buildEmailShell({
      preheader: 'Use this one-time code to reset your password.',
      eyebrow: 'Password recovery',
      title: `Hi ${input.firstName}, reset your password`,
      introHtml:
        '<p style="margin:0;">Use the one-time code below to finish resetting your password. Never share this code with anyone.</p>',
      bodyHtml: `
        <div style="margin:14px 0 16px;padding:14px;border:1px dashed #9ca3af;border-radius:10px;background:#f9fafb;text-align:center;">
          <div style="font-size:30px;letter-spacing:6px;font-weight:700;color:#111827;">${input.code}</div>
        </div>
        <p style="margin:0;color:#374151;">This code expires in <strong>${input.expiresInMinutes} minutes</strong> and can be used only once.</p>
      `,
      footerNote:
        'If you did not request this reset, ignore this email and review account security.',
    });
    await this.sendEmail({ to: input.email, subject, html });
  }

  async sendMerchantPayoutVerificationCode(input: {
    email: string;
    firstName: string;
    code: string;
    accountName: string;
    accountNumberMasked: string;
    bankCode: string;
    expiresInMinutes: number;
  }) {
    const subject = 'Confirm your settlement account update';
    const html = this.buildEmailShell({
      preheader: 'Use this code to confirm your payout account.',
      eyebrow: 'Merchant payout security',
      title: `Hi ${input.firstName}, confirm payout account`,
      introHtml:
        '<p style="margin:0;">A payout account update was started on your merchant profile. Use this one-time code to approve the change.</p>',
      bodyHtml: `
        <p style="margin:0 0 8px;"><strong>Bank code:</strong> ${input.bankCode}</p>
        <p style="margin:0 0 8px;"><strong>Account number:</strong> ${input.accountNumberMasked}</p>
        <p style="margin:0 0 8px;"><strong>Account name:</strong> ${input.accountName}</p>
        <div style="margin:14px 0 16px;padding:14px;border:1px dashed #9ca3af;border-radius:10px;background:#f9fafb;text-align:center;">
          <div style="font-size:30px;letter-spacing:6px;font-weight:700;color:#111827;">${input.code}</div>
        </div>
        <p style="margin:0;color:#374151;">This code expires in <strong>${input.expiresInMinutes} minutes</strong> and can be used only once.</p>
      `,
      footerNote:
        'If you did not initiate this request, ignore this email and review your account security settings.',
    });
    await this.sendEmail({ to: input.email, subject, html });
  }

  async sendMerchantSupportAcknowledgement(input: {
    email: string;
    firstName: string;
    subjectLine: string;
    ticketId: string;
    category: string;
  }) {
    const subject = `Support ticket received: ${input.subjectLine}`;
    const html = this.buildEmailShell({
      preheader: 'Your support message has been received.',
      eyebrow: 'Merchant support',
      title: `Hi ${input.firstName}, we received your message`,
      introHtml: `<p style="margin:0;">Our admin and operations team will review your request and get back to you as soon as possible.</p>`,
      bodyHtml: `
        <p style="margin:0 0 8px;"><strong>Ticket ID:</strong> ${input.ticketId}</p>
        <p style="margin:0 0 8px;"><strong>Category:</strong> ${input.category}</p>
        <p style="margin:0;"><strong>Subject:</strong> ${input.subjectLine}</p>
      `,
    });
    await this.sendEmail({ to: input.email, subject, html });
  }

  async sendMerchantCredentials(input: {
    email: string;
    businessName: string;
    merchantCode: string;
    password: string;
    firstName: string;
    emailVerificationToken: string;
  }) {
    const portalBase =
      process.env.MERCHANT_PORTAL_URL ?? 'http://localhost:3001';
    const loginUrl = `${portalBase.replace(/\/$/, '')}/login`;
    const verifyUrl = `${portalBase.replace(/\/$/, '')}/account/verify-email?token=${encodeURIComponent(input.emailVerificationToken)}`;
    const subject = `Your merchant account: ${input.merchantCode}`;
    const html = this.buildEmailShell({
      preheader: 'Your merchant account credentials and next steps.',
      eyebrow: 'Merchant onboarding',
      title: `Welcome ${input.businessName}`,
      introHtml: `<p style="margin:0;">Hi ${input.firstName}, sign in with the details below, set a new password, then verify your email to activate merchant operations.</p>`,
      ctaLabel: 'Open merchant portal',
      ctaUrl: loginUrl,
      bodyHtml: `<p style="margin:0;"><strong>Merchant ID:</strong> ${input.merchantCode}</p><p style="margin:6px 0 0;"><strong>Email:</strong> ${input.email}</p><p style="margin:6px 0 0;"><strong>Temporary password:</strong> ${input.password}</p><p style="margin:10px 0 0;">After password change, verify your merchant email:</p><p style="margin:6px 0 0;word-break:break-all;color:#374151;">${verifyUrl}</p>`,
    });
    await this.sendEmail({ to: input.email, subject, html });
    await this.sendMerchantEmailVerification({
      email: input.email,
      firstName: input.firstName,
      token: input.emailVerificationToken,
    });
  }

  async sendAdminCreatedCustomerWelcome(input: {
    email: string;
    firstName: string;
    token: string;
  }) {
    const base =
      process.env.STOREFRONT_URL ??
      process.env.NEXT_PUBLIC_STOREFRONT_URL ??
      'http://localhost:3000';
    const link = `${base.replace(/\/$/, '')}/account/verify-email?token=${encodeURIComponent(input.token)}`;
    const subject = 'Your SexxyMarket customer account';
    const html = this.buildEmailShell({
      preheader: 'Your account has been created by the operations team.',
      eyebrow: 'Customer account created',
      title: `Welcome ${input.firstName}`,
      introHtml:
        '<p style="margin:0;">An account has been created for you on SexxyMarket. Sign in with your assigned credentials, set a new password, then verify your email.</p>',
      ctaLabel: 'Verify email',
      ctaUrl: link,
      bodyHtml: `<p style="margin:0;word-break:break-all;color:#374151;">${link}</p>`,
    });
    await this.sendEmail({ to: input.email, subject, html });
  }

  async sendMerchantProductModeration(input: {
    email: string;
    businessName: string;
    productName: string;
    action: 'UPDATED' | 'HIDDEN' | 'UNHIDDEN' | 'REMOVED';
    reason?: string;
  }) {
    const subject = `Product moderation: ${input.productName}`;
    const html = this.buildEmailShell({
      preheader: 'A moderation action has been recorded on your listing.',
      eyebrow: 'Catalog governance',
      title: 'Product moderation update',
      introHtml: `<p style="margin:0;">Business: <strong>${input.businessName}</strong></p><p style="margin:6px 0 0;">Product: <strong>${input.productName}</strong></p><p style="margin:6px 0 0;">Action: <strong>${input.action}</strong></p>`,
      bodyHtml: input.reason
        ? `<p style="margin:10px 0 0;">Reason: ${input.reason}</p>`
        : undefined,
    });
    await this.sendEmail({ to: input.email, subject, html });
  }

  /** @returns true if Resend accepted the message, false if skipped or rejected */
  private async sendEmail(input: {
    to: string;
    subject: string;
    html: string;
    from?: string;
  }): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    const requestedFrom = input.from?.trim() ?? '';
    const primaryFrom =
      requestedFrom ||
      process.env.RESEND_FROM_EMAIL?.trim() ||
      process.env.ADMIN_AUTH_FROM_EMAIL?.trim() ||
      'support@sexxymarket.com';
    const fallbackFrom = process.env.RESEND_FROM_EMAIL?.trim() || '';
    if (!apiKey) {
      this.logger.warn(`RESEND_API_KEY missing. Skipping email to ${input.to}`);
      return false;
    }

    const sendWithFrom = async (from: string) =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
        }),
      });

    let response = await sendWithFrom(primaryFrom);
    if (
      !response.ok &&
      fallbackFrom &&
      fallbackFrom.toLowerCase() !== primaryFrom.toLowerCase()
    ) {
      const initialBody = await response.text();
      this.logger.warn(
        `Email send failed with from=${primaryFrom}. Retrying with RESEND_FROM_EMAIL. Error: ${initialBody}`,
      );
      response = await sendWithFrom(fallbackFrom);
    }

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Failed sending email: ${body}`);
      return false;
    }
    return true;
  }
}
