import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { MerchantStatus, Prisma, UserRole } from '@prisma/client';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMerchantProfileDto } from './dto/create-merchant-profile.dto';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { NotificationsService } from '../integrations/notifications.service';
import { StorageService } from '../integrations/storage.service';
import { PaymentsService } from '../payments/payments.service';
import { buildMerchantCode } from '../common/merchant-code';
import { buildNumericCode } from '../common/numeric-code';
import type { AuthUser } from '../common/types/auth-user';
import {
  KYC_DOCUMENT_TYPES,
  requiredDocumentSet,
  settlementNameMatchesPayout,
} from './merchant-kyc.constants';

@Injectable()
export class MerchantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly storageService: StorageService,
    private readonly paymentsService: PaymentsService,
  ) {}

  private async nextMerchantCode() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = buildMerchantCode();
      const taken = await this.prisma.merchantProfile.findUnique({
        where: { merchantCode: code },
        select: { id: true },
      });
      if (!taken) {
        return code;
      }
    }
    return buildNumericCode(10);
  }

  async apply(userId: string, payload: CreateMerchantProfileDto) {
    if (!payload.agreementAccepted) {
      throw new BadRequestException('Merchant agreement must be accepted');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { role: UserRole.MERCHANT },
      });

      const existing = await tx.merchantProfile.findUnique({
        where: { userId },
      });
      if (existing) {
        return tx.merchantProfile.update({
          where: { userId },
          data: {
            businessName: payload.businessName,
            businessType: payload.businessType ?? 'INDIVIDUAL',
            contactAddress: payload.businessAddress,
            businessAddress: payload.hasPhysicalLocation
              ? payload.businessAddress
              : '',
            hasPhysicalLocation: payload.hasPhysicalLocation,
            payoutAccountName: '',
            payoutAccountNo: '',
            payoutBankCode: '',
            agreementAccepted: payload.agreementAccepted,
            status: MerchantStatus.PENDING,
          },
        });
      }

      for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
          return await tx.merchantProfile.create({
            data: {
              merchantCode: await this.nextMerchantCode(),
              userId,
              businessName: payload.businessName,
              businessType: payload.businessType ?? 'INDIVIDUAL',
              contactAddress: payload.businessAddress,
              businessAddress: payload.hasPhysicalLocation
                ? payload.businessAddress
                : '',
              hasPhysicalLocation: payload.hasPhysicalLocation,
              payoutAccountName: '',
              payoutAccountNo: '',
              payoutBankCode: '',
              agreementAccepted: payload.agreementAccepted,
              status: MerchantStatus.PENDING,
            },
          });
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !String(error.message).includes('merchantCode')
          ) {
            throw error;
          }
        }
      }
      throw new BadRequestException(
        'Unable to generate merchant ID. Please retry.',
      );
    });
  }

  async getProfile(userId: string) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            emailVerifiedAt: true,
          },
        },
        verifications: {
          orderBy: { submittedAt: 'desc' },
          take: 3,
          include: { documents: true },
        },
      },
    });
    if (!profile) {
      throw new NotFoundException('Merchant profile not found');
    }
    const mask = (no: string) => {
      const t = no.replace(/\s/g, '');
      if (t.length < 4) {
        return '****';
      }
      return `****${t.slice(-4)}`;
    };
    return {
      id: profile.id,
      merchantCode: profile.merchantCode,
      businessName: profile.businessName,
      businessType: profile.businessType,
      contactAddress: profile.contactAddress,
      businessAddress: profile.businessAddress,
      hasPhysicalLocation: profile.hasPhysicalLocation,
      status: profile.status,
      merchantTier: profile.merchantTier,
      verificationStatus: profile.verificationStatus,
      verificationNote: profile.verificationNote,
      agreementAccepted: profile.agreementAccepted,
      payoutAccountName: profile.payoutAccountName,
      payoutAccountNoMasked: mask(profile.payoutAccountNo),
      payoutBankCode: profile.payoutBankCode,
      user: {
        email: profile.user.email,
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        phone: profile.user.phone,
        emailVerified: profile.user.emailVerifiedAt != null,
      },
      verifications: profile.verifications,
    };
  }

  listPending(options?: { cursor?: string; limit?: number }) {
    const take = Math.min(100, Math.max(1, options?.limit ?? 30));
    return this.prisma.merchantProfile
      .findMany({
        where: { verificationStatus: 'PENDING' },
        include: {
          user: true,
          verifications: { include: { documents: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
        ...(options?.cursor
          ? {
              cursor: { id: options.cursor },
              skip: 1,
            }
          : {}),
      })
      .then((merchants) => {
        const hasMore = merchants.length > take;
        const items = hasMore ? merchants.slice(0, take) : merchants;
        return {
          items,
          hasMore,
          nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
        };
      });
  }

  async approve(_merchantProfileId: string) {
    throw new BadRequestException(
      'Merchant activation is only done through the KYC verification review in the admin console.',
    );
  }

  async reject(_merchantProfileId: string) {
    throw new BadRequestException(
      'Use the admin merchant status and verification review flows instead of this endpoint.',
    );
  }

  async listOrders(
    userId: string,
    options?: { cursor?: string; limit?: number },
  ) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      return [];
    }

    const take = Math.min(150, Math.max(1, options?.limit ?? 40));
    const rows = await this.prisma.orderItem.findMany({
      where: {
        merchantId: profile.id,
        ...(options?.cursor ? { id: { lt: options.cursor } } : {}),
      },
      include: {
        order: true,
        product: true,
      },
      orderBy: { id: 'desc' },
      take: take + 1,
    });
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items,
      hasMore,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  private validateKycDocumentPayload(
    documents: Array<{
      documentType: string;
      fileKey?: string;
      fileUrl?: string;
    }>,
    businessType: import('@prisma/client').BusinessType,
  ) {
    if (!documents?.length) {
      throw new BadRequestException('At least one KYC document is required.');
    }
    const allow = new Set<string>(KYC_DOCUMENT_TYPES);
    for (const doc of documents) {
      if (!allow.has(doc.documentType)) {
        throw new BadRequestException(
          `Invalid or unsupported document type: ${doc.documentType}`,
        );
      }
      if (!doc.fileKey?.trim() || !doc.fileUrl?.trim()) {
        throw new BadRequestException(
          `Each document must include fileKey and fileUrl (${doc.documentType}).`,
        );
      }
    }
    const byType = new Set(documents.map((d) => d.documentType));
    for (const req of requiredDocumentSet(businessType)) {
      if (!byType.has(req)) {
        throw new BadRequestException(
          `Missing required document type: ${String(req).replace(/_/g, ' ')}`,
        );
      }
    }
  }

  async submitVerification(
    userId: string,
    payload: SubmitVerificationDto,
    documents: Array<{
      documentType: string;
      fileKey?: string;
      fileUrl?: string;
    }>,
  ) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!profile) {
      throw new BadRequestException('Merchant profile not found');
    }
    if (payload.isPhysicalStore && !payload.physicalStoreAddress?.trim()) {
      throw new BadRequestException(
        'Physical store address is required when physical store is enabled.',
      );
    }

    const isRegUpgrade = !!payload.isRegisteredBusinessUpgrade;
    if (isRegUpgrade) {
      if (profile.businessType !== 'INDIVIDUAL') {
        throw new BadRequestException(
          'Registered business upgrade is only for individual accounts.',
        );
      }
    }

    if (profile.businessType === 'REGISTERED_BUSINESS') {
      const cac = payload.cacNumber?.trim() ?? '';
      if (!cac) {
        throw new BadRequestException(
          'CAC registration number is required for registered businesses.',
        );
      }
      const tin = payload.tinNumber?.trim() ?? '';
      if (!tin) {
        throw new BadRequestException(
          'TIN is required for registered businesses.',
        );
      }
    }
    if (isRegUpgrade) {
      const cac = payload.cacNumber?.trim() ?? '';
      if (!cac) {
        throw new BadRequestException(
          'CAC registration number is required for a registered business upgrade.',
        );
      }
      const tin = payload.tinNumber?.trim() ?? '';
      if (!tin) {
        throw new BadRequestException(
          'TIN is required for a registered business upgrade.',
        );
      }
    }

    const effectiveDocBusinessType: import('@prisma/client').BusinessType =
      isRegUpgrade && profile.businessType === 'INDIVIDUAL'
        ? 'REGISTERED_BUSINESS'
        : profile.businessType;

    this.validateKycDocumentPayload(documents, effectiveDocBusinessType);

    const cac = payload.cacNumber?.trim() || null;
    const verData = {
      isRegisteredBusinessUpgrade: isRegUpgrade,
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      gender: payload.gender,
      dateOfBirth: payload.dateOfBirth.trim(),
      idNumber: payload.idNumber.trim(),
      residentialAddress: payload.residentialAddress.trim(),
      businessName: payload.businessName.trim(),
      isPhysicalStore: payload.isPhysicalStore,
      physicalStoreAddress: payload.physicalStoreAddress?.trim() || null,
      identityType: payload.identityType,
      cacNumber: cac,
      tinNumber: payload.tinNumber?.trim() || null,
      businessAddress: payload.businessAddress,
      status: 'PENDING' as const,
      reviewReason: null,
      reviewedAt: null,
    };

    const buildDocCreates = (verificationId: string) =>
      documents.map((doc) => {
        const objectRef = doc.fileKey
          ? {
              key: doc.fileKey,
              url:
                doc.fileUrl ??
                `${process.env.R2_PUBLIC_BASE_URL ?? 'https://files.sexxymarket.com'}/${doc.fileKey}`,
            }
          : this.storageService.buildObjectReference({
              merchantId: profile.id,
              documentType: doc.documentType,
              fileName: `${doc.documentType}.pdf`,
            });
        return {
          verificationId,
          documentType: doc.documentType,
          fileKey: objectRef.key,
          fileUrl: objectRef.url,
        };
      });

    const existing = await this.prisma.merchantVerification.findFirst({
      where: { merchantId: profile.id, status: 'PENDING' },
    });

    if (existing) {
      const out = await this.prisma.$transaction(async (tx) => {
        await tx.merchantDocument.deleteMany({
          where: { verificationId: existing.id },
        });
        const verification = await tx.merchantVerification.update({
          where: { id: existing.id },
          data: verData,
          include: { documents: true },
        });
        const creates = buildDocCreates(verification.id);
        for (const row of creates) {
          await tx.merchantDocument.create({ data: row });
        }
        return tx.merchantVerification.findUnique({
          where: { id: verification.id },
          include: { documents: true },
        });
      });
      await this.prisma.merchantProfile.update({
        where: { id: profile.id },
        data: {
          verificationStatus: 'PENDING',
          verificationNote: 'Verification submitted and under review.',
        },
      });
      return out;
    }

    const created = await this.prisma.merchantVerification.create({
      data: {
        merchantId: profile.id,
        ...verData,
        documents: {
          create: documents.map((doc) => {
            const objectRef = doc.fileKey
              ? {
                  key: doc.fileKey,
                  url:
                    doc.fileUrl ??
                    `${process.env.R2_PUBLIC_BASE_URL ?? 'https://files.sexxymarket.com'}/${doc.fileKey}`,
                }
              : this.storageService.buildObjectReference({
                  merchantId: profile.id,
                  documentType: doc.documentType,
                  fileName: `${doc.documentType}.pdf`,
                });
            return {
              documentType: doc.documentType,
              fileKey: objectRef.key,
              fileUrl: objectRef.url,
            };
          }),
        },
      },
      include: { documents: true },
    });

    await this.prisma.merchantProfile.update({
      where: { id: profile.id },
      data: {
        verificationStatus: 'PENDING',
        verificationNote: 'Verification submitted and under review.',
      },
    });

    return created;
  }

  async listSupportedBanks() {
    return this.paymentsService.listNigerianBanks();
  }

  async resolvePayoutAccount(payload: {
    bankCode: string;
    accountNumber: string;
  }) {
    return this.paymentsService.resolveNigerianBankAccount(
      payload.bankCode.trim(),
      payload.accountNumber.trim(),
    );
  }

  async setPayoutAccount(
    userId: string,
    payload: { bankCode: string; accountNumber: string; accountName: string },
  ) {
    throw new BadRequestException(
      'Use payout-account/start then payout-account/confirm to save settlement details.',
    );
  }

  private hashPayoutOtp(code: string) {
    const secret =
      process.env.MERCHANT_PAYOUT_OTP_SECRET ?? 'sexxymarket-payout-otp';
    return createHash('sha256').update(`${secret}:${code}`).digest('hex');
  }

  private maskAccountNo(no: string) {
    const trimmed = no.replace(/\s/g, '');
    if (trimmed.length <= 4) return '****';
    return `******${trimmed.slice(-4)}`;
  }

  async startPayoutAccountSetup(
    userId: string,
    payload: { bankCode: string; accountNumber: string },
  ) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!profile) {
      throw new BadRequestException('Merchant profile not found');
    }
    if (profile.verificationStatus !== 'APPROVED') {
      throw new BadRequestException(
        'Business verification must be approved before adding a settlement account.',
      );
    }

    const bankCode = payload.bankCode.trim();
    const accountNumber = payload.accountNumber.trim();
    const resolved = await this.paymentsService.resolveNigerianBankAccount(
      bankCode,
      accountNumber,
    );

    if (
      !settlementNameMatchesPayout(
        resolved.accountName,
        profile.businessName,
        profile.user.firstName,
        profile.user.lastName,
        profile.businessType,
      )
    ) {
      throw new BadRequestException(
        'Settlement account name must match business name or merchant legal names.',
      );
    }

    await this.prisma.merchantPayoutOtpChallenge.updateMany({
      where: {
        merchantId: profile.id,
        consumedAt: null,
        invalidatedAt: null,
      },
      data: { invalidatedAt: new Date() },
    });

    const code = String(randomInt(100000, 999999));
    const expiresInMinutes = Number(
      process.env.MERCHANT_PAYOUT_OTP_EXPIRES_MINUTES ?? '5',
    );
    const challenge = await this.prisma.merchantPayoutOtpChallenge.create({
      data: {
        merchantId: profile.id,
        bankCode,
        accountNo: accountNumber,
        accountName: resolved.accountName,
        codeHash: this.hashPayoutOtp(code),
        expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000),
      },
    });

    await this.notificationsService.sendMerchantPayoutVerificationCode({
      email: profile.user.email,
      firstName: profile.user.firstName,
      code,
      accountName: resolved.accountName,
      accountNumberMasked: this.maskAccountNo(accountNumber),
      bankCode,
      expiresInMinutes,
    });

    return {
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
      accountName: resolved.accountName,
      accountNumberMasked: this.maskAccountNo(accountNumber),
    };
  }

  async confirmPayoutAccountSetup(
    userId: string,
    payload: { challengeId: string; code: string },
  ) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!profile) {
      throw new BadRequestException('Merchant profile not found');
    }
    if (profile.verificationStatus !== 'APPROVED') {
      throw new BadRequestException(
        'Business verification must be approved before editing settlement account.',
      );
    }

    const challenge = await this.prisma.merchantPayoutOtpChallenge.findUnique({
      where: { id: payload.challengeId },
    });
    if (!challenge || challenge.merchantId !== profile.id) {
      throw new BadRequestException('Invalid payout verification challenge.');
    }
    if (challenge.invalidatedAt || challenge.consumedAt) {
      throw new BadRequestException('Challenge is no longer valid.');
    }
    if (challenge.expiresAt <= new Date()) {
      throw new BadRequestException('Verification code expired.');
    }
    const maxAttempts = Number(
      process.env.MERCHANT_PAYOUT_OTP_MAX_ATTEMPTS ?? '3',
    );
    if (challenge.attempts >= maxAttempts) {
      await this.prisma.merchantPayoutOtpChallenge.update({
        where: { id: challenge.id },
        data: { invalidatedAt: new Date() },
      });
      throw new BadRequestException('Too many invalid attempts.');
    }
    if (this.hashPayoutOtp(payload.code.trim()) !== challenge.codeHash) {
      const attempts = challenge.attempts + 1;
      await this.prisma.merchantPayoutOtpChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts,
          invalidatedAt: attempts >= maxAttempts ? new Date() : null,
        },
      });
      throw new BadRequestException('Invalid verification code.');
    }

    await this.prisma.$transaction([
      this.prisma.merchantProfile.update({
        where: { id: profile.id },
        data: {
          payoutBankCode: challenge.bankCode,
          payoutAccountNo: challenge.accountNo,
          payoutAccountName: challenge.accountName,
        },
      }),
      this.prisma.merchantPayoutOtpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      }),
    ]);

    return { success: true, accountName: challenge.accountName };
  }

  async removePayoutAccount(userId: string) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
      select: { id: true, verificationStatus: true },
    });
    if (!profile) {
      throw new BadRequestException('Merchant profile not found');
    }
    if (profile.verificationStatus !== 'APPROVED') {
      throw new BadRequestException(
        'Business verification must be approved before editing settlement account.',
      );
    }
    await this.prisma.merchantProfile.update({
      where: { id: profile.id },
      data: { payoutBankCode: '', payoutAccountNo: '', payoutAccountName: '' },
    });
    return { success: true };
  }

  async createSupportMessage(
    userId: string,
    payload: {
      category: 'ORDER' | 'PRODUCT' | 'TRANSACTION' | 'ACCOUNT' | 'GENERAL';
      subject: string;
      message: string;
      orderId?: string;
    },
  ) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!profile) {
      throw new BadRequestException('Merchant profile not found');
    }
    let created;
    try {
      created = await this.prisma.merchantSupportMessage.create({
        data: {
          merchantId: profile.id,
          category: payload.category,
          subject: payload.subject.trim(),
          message: payload.message.trim(),
          orderId: payload.orderId?.trim() || null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021'
      ) {
        throw new BadRequestException(
          'Support service is still initializing. Please retry shortly.',
        );
      }
      throw error;
    }
    await this.notificationsService.sendMerchantSupportAcknowledgement({
      email: profile.user.email,
      firstName: profile.user.firstName,
      subjectLine: created.subject,
      ticketId: created.id,
      category: created.category,
    });
    return created;
  }

  async listSupportMessages(userId: string) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new BadRequestException('Merchant profile not found');
    }
    try {
      return await this.prisma.merchantSupportMessage.findMany({
        where: { merchantId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021'
      ) {
        return [];
      }
      throw error;
    }
  }

  async reviewVerification(
    verificationId: string,
    payload: ReviewVerificationDto,
  ) {
    const before = await this.prisma.merchantVerification.findUnique({
      where: { id: verificationId },
      include: { documents: true, merchant: { include: { user: true } } },
    });
    if (!before) {
      throw new NotFoundException('Verification not found');
    }
    if (payload.decision === 'REJECTED' && !payload.reason?.trim()) {
      throw new BadRequestException('A rejection reason is required.');
    }
    if (payload.decision === 'APPROVED') {
      if (before.documents.length === 0) {
        throw new BadRequestException(
          'Cannot approve: upload at least one KYC document first.',
        );
      }
    }

    const verification = await this.prisma.merchantVerification.update({
      where: { id: verificationId },
      data: {
        status: payload.decision,
        reviewReason: payload.reason,
        reviewedAt: new Date(),
      },
      include: { merchant: true },
    });

    if (payload.decision === 'APPROVED') {
      const promoteRegistered =
        before.isRegisteredBusinessUpgrade &&
        before.merchant.businessType === 'INDIVIDUAL';
      const resolvedBusinessType =
        promoteRegistered ||
        before.merchant.businessType === 'REGISTERED_BUSINESS'
          ? 'REGISTERED_BUSINESS'
          : 'INDIVIDUAL';
      const resolvedTier =
        resolvedBusinessType === 'REGISTERED_BUSINESS' ? 'SUPER' : 'STANDARD';
      await this.prisma.merchantProfile.update({
        where: { id: verification.merchantId },
        data: {
          verificationStatus: 'APPROVED',
          status: 'APPROVED',
          verificationNote: payload.reason?.trim() ?? null,
          merchantTier: resolvedTier,
          ...(promoteRegistered ? { businessType: 'REGISTERED_BUSINESS' } : {}),
        },
        include: { user: true },
      });
    } else if (payload.decision === 'REJECTED') {
      await this.prisma.merchantProfile.update({
        where: { id: verification.merchantId },
        data: {
          verificationStatus: 'REJECTED',
          verificationNote: payload.reason ?? null,
        },
        include: { user: true },
      });
    }

    const merchantProfile = await this.prisma.merchantProfile.findUnique({
      where: { id: verification.merchantId },
      include: { user: true },
    });
    if (!merchantProfile) {
      return verification;
    }
    await this.notificationsService.sendMerchantVerificationStatus({
      email: merchantProfile.user.email,
      businessName: merchantProfile.businessName,
      status: payload.decision,
      reason: payload.reason,
    });

    return verification;
  }

  async createDocumentReference(
    userId: string,
    payload: { documentType: string; fileName: string },
  ) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new BadRequestException('Merchant profile not found');
    }
    return this.storageService.buildObjectReference({
      merchantId: profile.id,
      documentType: payload.documentType,
      fileName: payload.fileName,
    });
  }

  async uploadDocumentFile(
    userId: string,
    payload: { documentType: string },
    file: {
      originalname: string;
      buffer: Buffer;
      mimetype?: string;
      size?: number;
    },
  ) {
    if (
      !(KYC_DOCUMENT_TYPES as readonly string[]).includes(payload.documentType)
    ) {
      throw new BadRequestException(
        `Invalid document type: ${payload.documentType}`,
      );
    }
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new BadRequestException('Merchant profile not found');
    }
    return this.storageService.saveMerchantDocumentFile({
      merchantId: profile.id,
      documentType: payload.documentType,
      fileName: file.originalname,
      buffer: file.buffer,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });
  }

  /** Admin — presigned or key path for a merchant’s KYC upload. */
  async createDocumentReferenceByAdmin(
    merchantId: string,
    input: { documentType: string; fileName: string },
  ) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { id: merchantId },
    });
    if (!profile) {
      throw new NotFoundException('Merchant not found');
    }
    return this.storageService.buildObjectReference({
      merchantId: profile.id,
      documentType: input.documentType,
      fileName: input.fileName,
    });
  }

  private async ensureShellPendingVerification(merchantId: string) {
    const found = await this.prisma.merchantVerification.findFirst({
      where: { merchantId, status: 'PENDING' },
    });
    if (found) {
      return found;
    }
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { id: merchantId },
    });
    if (!profile) {
      throw new NotFoundException('Merchant not found');
    }
    return this.prisma.merchantVerification.create({
      data: {
        merchantId,
        isRegisteredBusinessUpgrade: false,
        identityType: 'NIN',
        cacNumber: null,
        businessAddress: profile.contactAddress,
        status: 'PENDING',
      },
    });
  }

  /**
   * Admin attaches a document file to a pending verification (or creates a shell first).
   */
  async appendVerificationDocumentByAdmin(
    merchantId: string,
    input: {
      verificationId?: string;
      documentType: string;
      fileKey: string;
      fileUrl: string;
    },
  ) {
    if (
      !(KYC_DOCUMENT_TYPES as readonly string[]).includes(input.documentType)
    ) {
      throw new BadRequestException(
        `Invalid documentType: ${input.documentType}`,
      );
    }
    let v;
    if (input.verificationId) {
      const found = await this.prisma.merchantVerification.findFirst({
        where: { id: input.verificationId, merchantId, status: 'PENDING' },
      });
      if (!found) {
        throw new NotFoundException(
          'Pending verification not found for this merchant.',
        );
      }
      v = found;
    } else {
      v = await this.ensureShellPendingVerification(merchantId);
    }
    if (v.status !== 'PENDING') {
      throw new BadRequestException(
        'Only PENDING verifications can receive documents.',
      );
    }
    return this.prisma.merchantDocument.create({
      data: {
        verificationId: v.id,
        documentType: input.documentType,
        fileKey: input.fileKey,
        fileUrl: input.fileUrl,
      },
    });
  }

  async streamKycDocumentFile(user: AuthUser, documentId: string) {
    const doc = await this.prisma.merchantDocument.findUnique({
      where: { id: documentId },
      include: { verification: { include: { merchant: true } } },
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    if (user.role === 'MERCHANT') {
      const profile = await this.prisma.merchantProfile.findUnique({
        where: { userId: user.sub },
        select: { id: true },
      });
      if (profile?.id !== doc.verification.merchantId) {
        throw new ForbiddenException('You cannot access this document.');
      }
    } else if (!isAdmin) {
      throw new ForbiddenException('You cannot access this document.');
    }
    const r = await fetch(doc.fileUrl);
    if (!r.ok) {
      throw new BadRequestException('Unable to load file from storage.');
    }
    const buf = Buffer.from(await r.arrayBuffer());
    const contentType =
      r.headers.get('content-type') ?? 'application/octet-stream';
    return new StreamableFile(buf, {
      type: contentType,
      disposition: `inline; filename="${doc.documentType}"`,
    });
  }
}
