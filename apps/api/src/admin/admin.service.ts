import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessType,
  MerchantStatus,
  MerchantTier,
  OrderStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { CreateCustomerAdminDto } from './dto/create-customer-admin.dto';
import { CreateManualOrderDto } from '../orders/dto/create-manual-order.dto';
import { CreateMerchantAdminDto } from './dto/create-merchant-admin.dto';
import { buildMerchantCode } from '../common/merchant-code';
import { NotificationsService } from '../integrations/notifications.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../integrations/storage.service';
import { UpdateMerchantStatusDto } from './dto/update-merchant-status.dto';
import { UpdateProductAdminDto } from './dto/update-product-admin.dto';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';
import { UpdateOrderAdminDto } from './dto/update-order-admin.dto';
import { buildNumericCode } from '../common/numeric-code';
import { MerchantService } from '../merchant/merchant.service';
import { UpdateMerchantTierDto } from './dto/update-merchant-tier.dto';
import {
  MerchantKycDocumentAppendDto,
  MerchantKycDocumentRefDto,
} from './dto/merchant-kyc-documents.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
    private readonly merchantService: MerchantService,
  ) {}

  private readonly listingInclude = {
    merchant: {
      include: { user: { select: { email: true } } },
    },
    images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
    variants: {
      include: {
        optionValues: {
          include: { optionValue: { include: { option: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    },
    options: {
      include: {
        values: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { sortOrder: 'asc' },
    },
    category: true,
  } satisfies Prisma.ProductInclude;

  getProductImageUploadRef(fileName: string) {
    return this.storageService.buildProductImageReference(fileName);
  }

  initProductImageUpload(
    fileName: string,
    mimeType?: string,
    sizeBytes?: number,
  ) {
    return this.storageService.buildProductImageUploadInit({
      fileName,
      mimeType,
      sizeBytes,
    });
  }

  completeProductImageUpload(payload: {
    key: string;
    fileName: string;
    mimeType?: string;
    sizeBytes?: number;
    altText?: string;
  }) {
    return this.storageService.completeProductImageUpload(payload);
  }

  private normalizeProductMedia<
    T extends {
      images?: Array<{ imageUrl: string }>;
      options?: Array<{ values: Array<{ imageUrl?: string | null }> }>;
    },
  >(product: T): T {
    if (!product) return product;
    const images =
      product.images?.map((image) => ({
        ...image,
        imageUrl:
          this.storageService.toAbsoluteMediaUrl(image.imageUrl) ??
          image.imageUrl,
      })) ?? [];
    const options =
      product.options?.map((option) => ({
        ...option,
        values: option.values.map((value) => ({
          ...value,
          imageUrl: this.storageService.toAbsoluteMediaUrl(value.imageUrl),
        })),
      })) ?? [];
    return {
      ...product,
      images,
      options,
    };
  }

  uploadProductImageFile(file: {
    originalname: string;
    buffer: Buffer;
    mimetype?: string;
    size?: number;
  }) {
    return this.storageService.saveProductImageFile({
      fileName: file.originalname,
      buffer: file.buffer,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });
  }

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

  listAdmins() {
    return this.prisma.user.findMany({
      where: { role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignRole(
    actorId: string,
    actorRole: UserRole,
    userId: string,
    role: 'ADMIN' | 'SUPER_ADMIN',
  ) {
    if (actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can assign admin roles');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: role },
      select: { id: true, email: true, role: true },
    });
    await this.logAction(actorId, 'ADMIN_ROLE_UPDATED', 'USER', userId, {
      role,
    });
    return updated;
  }

  async createAdmin(actorId: string, payload: CreateAdminUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: payload.email },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }
    const passwordHash = await argon2.hash(payload.password);
    const created = await this.prisma.user.create({
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        passwordHash,
        role: payload.role,
        emailVerifiedAt: new Date(),
        mustChangePassword: false,
        passwordSetAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
      },
    });
    await this.logAction(actorId, 'ADMIN_CREATED', 'USER', created.id, {
      role: created.role,
      email: created.email,
    });
    return created;
  }

  async removeAdmin(
    actorId: string,
    actorRole: UserRole,
    userId: string,
    reason?: string,
  ) {
    if (actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can remove admin users');
    }
    if (actorId === userId) {
      throw new BadRequestException('You cannot remove your own account');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (
      !user ||
      (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN)
    ) {
      throw new NotFoundException('Admin user not found');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false, isBlocked: true },
      select: { id: true, email: true, role: true, isActive: true },
    });
    await this.logAction(actorId, 'ADMIN_REMOVED', 'USER', userId, {
      reason: reason ?? null,
    });
    return updated;
  }

  listMerchants() {
    return this.prisma.merchantProfile.findMany({
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMerchantAdminDetail(merchantId: string) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { id: merchantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        verifications: {
          include: { documents: true },
          orderBy: { submittedAt: 'desc' },
        },
        products: {
          take: 100,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            productCode: true,
            stock: true,
            priceNgn: true,
            approvalStatus: true,
            authoringStatus: true,
            slug: true,
            isHidden: true,
          },
        },
      },
    });
    if (!profile) {
      throw new NotFoundException('Merchant not found');
    }
    const [salesSum, lineItemCount, orderIdRows] = await Promise.all([
      this.prisma.orderItem.aggregate({
        where: { merchantId },
        _sum: { lineTotalNgn: true },
      }),
      this.prisma.orderItem.count({ where: { merchantId } }),
      this.prisma.orderItem.findMany({
        where: { merchantId },
        select: { orderId: true },
        distinct: ['orderId'],
      }),
    ]);
    return {
      ...profile,
      analytics: {
        lineItems: lineItemCount,
        orders: orderIdRows.length,
        revenueNgn: salesSum._sum.lineTotalNgn ?? 0,
      },
    };
  }

  async updateMerchantStatus(
    actorId: string,
    merchantId: string,
    payload: UpdateMerchantStatusDto,
  ) {
    const merchant = await this.prisma.merchantProfile.update({
      where: { id: merchantId },
      data: {
        status: payload.status,
        verificationNote: payload.reason ?? null,
      },
      include: { user: true },
    });
    await this.notificationsService.sendMerchantAccountStatus({
      email: merchant.user.email,
      businessName: merchant.businessName,
      status: payload.status,
      reason: payload.reason,
    });
    await this.logAction(
      actorId,
      'MERCHANT_STATUS_UPDATED',
      'MERCHANT',
      merchantId,
      payload as unknown as Prisma.InputJsonValue,
    );
    return merchant;
  }

  async listListings(filters: {
    query?: string;
    categoryId?: string;
    status?: string;
    stockState?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
  }) {
    const andParts: Prisma.ProductWhereInput[] = [];
    if (filters.query?.trim()) {
      const q = filters.query.trim();
      andParts.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
          { productCode: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (filters.categoryId) {
      andParts.push({ categoryId: filters.categoryId });
    }
    if (filters.status === 'HIDDEN') {
      andParts.push({ isHidden: true });
    } else if (filters.status === 'VISIBLE') {
      andParts.push({ isHidden: false });
    } else if (filters.status === 'PENDING') {
      andParts.push({ approvalStatus: 'PENDING' });
    } else if (filters.status === 'APPROVED') {
      andParts.push({ approvalStatus: 'APPROVED', isHidden: false });
    } else if (filters.status === 'REJECTED') {
      andParts.push({ approvalStatus: 'REJECTED' });
    }
    if (filters.stockState === 'OUT') {
      andParts.push({ stock: { lte: 0 } });
    } else if (filters.stockState === 'LOW') {
      andParts.push({ stock: { gt: 0, lte: 5 } });
    } else if (filters.stockState === 'IN') {
      andParts.push({ stock: { gt: 5 } });
    }
    const where: Prisma.ProductWhereInput =
      andParts.length > 0 ? { AND: andParts } : {};
    const page = Math.max(
      0,
      Number.isFinite(Number(filters.page)) ? Number(filters.page) : 0,
    );
    const pageSize = Math.min(
      100,
      Math.max(
        1,
        Number.isFinite(Number(filters.pageSize))
          ? Number(filters.pageSize)
          : 20,
      ),
    );
    const skip = page * pageSize;
    const sort = filters.sort ?? 'newest';
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sort === 'price_asc'
        ? { priceNgn: 'asc' }
        : sort === 'price_desc'
          ? { priceNgn: 'desc' }
          : sort === 'stock_asc'
            ? { stock: 'asc' }
            : sort === 'stock_desc'
              ? { stock: 'desc' }
              : { createdAt: 'desc' };

    const [total, items, outOfStock, lowStock] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: this.listingInclude,
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.product.count({ where: { ...where, stock: { lte: 0 } } }),
      this.prisma.product.count({
        where: { ...where, stock: { gt: 0, lte: 5 } },
      }),
    ]);
    return {
      items: items.map((item) => this.normalizeProductMedia(item)),
      total,
      page,
      pageSize,
      analytics: {
        lowStock,
        outOfStock,
      },
    };
  }

  async getListingById(productId: string) {
    const listing = await this.prisma.product.findUnique({
      where: { id: productId },
      include: this.listingInclude,
    });
    if (!listing) {
      throw new NotFoundException('Product not found');
    }
    return this.normalizeProductMedia(listing);
  }

  async updateListing(
    actorId: string,
    productId: string,
    payload: UpdateProductAdminDto,
  ) {
    const previous = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        isHidden: true,
        stock: true,
        priceNgn: true,
        approvalStatus: true,
        isApproved: true,
      },
    });
    if (!previous) {
      throw new NotFoundException('Product not found');
    }

    const product = await this.prisma.product.update({
      where: { id: productId },
      data: {
        isHidden: payload.isHidden,
        hiddenReason: payload.hiddenReason,
        hiddenAt:
          payload.isHidden === true
            ? new Date()
            : payload.isHidden === false
              ? null
              : undefined,
        approvalStatus: payload.approvalStatus,
        isApproved: payload.isApproved,
        stock: payload.stock,
        priceNgn: payload.priceNgn,
      },
      include: {
        merchant: { include: { user: { select: { email: true } } } },
      },
    });

    const hasOtherEdits =
      (payload.stock !== undefined && payload.stock !== previous.stock) ||
      (payload.priceNgn !== undefined &&
        payload.priceNgn !== previous.priceNgn) ||
      (payload.approvalStatus !== undefined &&
        payload.approvalStatus !== previous.approvalStatus) ||
      (payload.isApproved !== undefined &&
        payload.isApproved !== previous.isApproved) ||
      (payload.hiddenReason !== undefined && payload.hiddenReason !== null);

    let action: 'UPDATED' | 'HIDDEN' | 'UNHIDDEN' = 'UPDATED';
    if (payload.isHidden === true) {
      action = 'HIDDEN';
    } else if (payload.isHidden === false) {
      action = 'UNHIDDEN';
    } else if (hasOtherEdits) {
      action = 'UPDATED';
    }

    if (
      product.merchant?.user?.email &&
      (payload.isHidden !== undefined || hasOtherEdits)
    ) {
      await this.notificationsService.sendMerchantProductModeration({
        email: product.merchant.user.email,
        businessName: product.merchant.businessName,
        productName: product.name,
        action,
        reason: payload.hiddenReason,
      });
    }
    await this.logAction(actorId, 'PRODUCT_UPDATED', 'PRODUCT', productId, {
      before: previous,
      after: {
        isHidden: product.isHidden,
        stock: product.stock,
        priceNgn: product.priceNgn,
        approvalStatus: product.approvalStatus,
        isApproved: product.isApproved,
      },
      requested: payload,
    } as unknown as Prisma.InputJsonValue);
    return product;
  }

  async removeListing(actorId: string, productId: string, reason?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        merchant: { include: { user: { select: { email: true } } } },
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    await this.prisma.product.delete({ where: { id: productId } });
    if (product.merchant?.user?.email) {
      await this.notificationsService.sendMerchantProductModeration({
        email: product.merchant.user.email,
        businessName: product.merchant.businessName,
        productName: product.name,
        action: 'REMOVED',
        reason,
      });
    }
    await this.logAction(actorId, 'PRODUCT_REMOVED', 'PRODUCT', productId, {
      reason: reason ?? null,
    });
    return { success: true };
  }

  async getOrderById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: { images: true, variants: true, category: true },
            },
          },
        },
        customer: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async createManualOrder(actorId: string, payload: CreateManualOrderDto) {
    const order = await this.ordersService.createManualOrderForAdmin(
      payload,
      actorId,
    );
    await this.logAction(actorId, 'ORDER_MANUAL_CREATED', 'ORDER', order.id, {
      paymentMode: payload.paymentMode,
    });
    return order;
  }

  async createMerchantByAdmin(
    actorId: string,
    payload: CreateMerchantAdminDto,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }
    const passwordHash = await argon2.hash(payload.password);
    const merchantCode = await this.nextMerchantCode();
    const nameParts = payload.businessName.trim().split(/\s+/);
    const firstName = payload.firstName ?? nameParts[0] ?? 'Merchant';
    const lastName =
      payload.lastName ??
      (nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'User');
    const emailVerificationToken = randomBytes(32).toString('hex');
    const user = await this.prisma.user.create({
      data: {
        email: payload.email,
        passwordHash,
        firstName,
        lastName,
        role: UserRole.MERCHANT,
        mustChangePassword: true,
        emailVerifiedAt: null,
        emailVerificationToken,
        passwordSetAt: new Date(),
      },
    });
    let profile;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        profile = await this.prisma.merchantProfile.create({
          data: {
            merchantCode:
              attempt === 0 ? merchantCode : await this.nextMerchantCode(),
            userId: user.id,
            businessName: payload.businessName,
            contactAddress: payload.contactAddress.trim(),
            businessAddress: payload.hasPhysicalLocation
              ? (payload.businessAddress?.trim() ?? '')
              : '',
            hasPhysicalLocation: payload.hasPhysicalLocation,
            businessType: payload.businessType ?? 'INDIVIDUAL',
            payoutAccountName: '',
            payoutAccountNo: '',
            payoutBankCode: '',
            agreementAccepted: true,
            status: MerchantStatus.APPROVED,
            verificationStatus: 'PENDING',
            verificationNote:
              'Complete KYC in the merchant portal. Listing requires verification.',
          },
        });
        break;
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !String(error.message).includes('merchantCode')
        ) {
          throw error;
        }
      }
    }
    if (!profile) {
      throw new BadRequestException(
        'Unable to generate merchant ID. Please retry.',
      );
    }
    await this.notificationsService.sendMerchantCredentials({
      email: user.email,
      businessName: profile.businessName,
      merchantCode: profile.merchantCode,
      password: payload.password,
      firstName: user.firstName,
      emailVerificationToken,
    });
    await this.logAction(
      actorId,
      'MERCHANT_PROVISIONED',
      'MERCHANT',
      profile.id,
      { email: user.email, merchantCode: profile.merchantCode },
    );
    return { user, profile };
  }

  async updateMerchantTier(
    actorId: string,
    merchantId: string,
    payload: UpdateMerchantTierDto,
  ) {
    const merchant = await this.prisma.merchantProfile.update({
      where: { id: merchantId },
      data: { merchantTier: payload.merchantTier },
    });
    await this.logAction(
      actorId,
      'MERCHANT_TIER_UPDATED',
      'MERCHANT',
      merchantId,
      { merchantTier: payload.merchantTier },
    );
    return merchant;
  }

  createMerchantKycDocumentReference(
    _actorId: string,
    merchantId: string,
    body: MerchantKycDocumentRefDto,
  ) {
    return this.merchantService.createDocumentReferenceByAdmin(merchantId, {
      documentType: body.documentType,
      fileName: body.fileName,
    });
  }

  async appendMerchantKycDocument(
    actorId: string,
    merchantId: string,
    body: MerchantKycDocumentAppendDto,
  ) {
    const created =
      await this.merchantService.appendVerificationDocumentByAdmin(merchantId, {
        verificationId: body.verificationId,
        documentType: body.documentType,
        fileKey: body.fileKey,
        fileUrl: body.fileUrl,
      });
    await this.logAction(
      actorId,
      'MERCHANT_KYC_DOCUMENT_ADDED',
      'MERCHANT',
      merchantId,
      {
        documentType: body.documentType,
        verificationId: body.verificationId,
      },
    );
    return created;
  }

  async createCustomerByAdmin(
    actorId: string,
    payload: CreateCustomerAdminDto,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }
    const passwordHash = await argon2.hash(payload.password);
    const emailVerificationToken = randomBytes(32).toString('hex');
    const user = await this.prisma.user.create({
      data: {
        email: payload.email,
        passwordHash,
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone,
        role: UserRole.CUSTOMER,
        mustChangePassword: true,
        emailVerifiedAt: null,
        emailVerificationToken,
        passwordSetAt: new Date(),
      },
    });
    await this.notificationsService.sendAdminCreatedCustomerWelcome({
      email: user.email,
      firstName: user.firstName,
      token: emailVerificationToken,
    });
    await this.logAction(actorId, 'USER_ADMIN_CREATED', 'USER', user.id, {
      email: user.email,
    });
    return {
      success: true,
      message:
        'User created. They should sign in, set a new password, then confirm their email from the link sent to their inbox.',
      userId: user.id,
    };
  }

  async listOrders(filters: {
    status?: string;
    query?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  }) {
    const andParts: Prisma.OrderWhereInput[] = [];
    if (filters.dateFrom) {
      andParts.push({ createdAt: { gte: new Date(filters.dateFrom) } });
    }
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      andParts.push({ createdAt: { lte: end } });
    }
    if (filters.status && filters.status !== 'ALL') {
      andParts.push({ status: filters.status as OrderStatus });
    }
    if (filters.query) {
      const q = filters.query;
      andParts.push({
        OR: [
          { id: { contains: q, mode: 'insensitive' } },
          { trackingNumber: { contains: q, mode: 'insensitive' } },
          { recipientName: { contains: q, mode: 'insensitive' } },
          { recipientPhone: { contains: q, mode: 'insensitive' } },
          { guestEmail: { contains: q, mode: 'insensitive' } },
          { paymentReference: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.OrderWhereInput =
      andParts.length > 0 ? { AND: andParts } : {};

    const hasPage = filters.page !== undefined && !isNaN(Number(filters.page));
    const hasPageSize =
      filters.pageSize !== undefined && !isNaN(Number(filters.pageSize));
    const usePagination = hasPage || hasPageSize;
    const page = Math.max(0, hasPage ? Number(filters.page) : 0);
    const take = Math.min(
      Math.max(1, hasPageSize ? Number(filters.pageSize) : 50),
      200,
    );
    const skip = usePagination ? page * take : 0;

    const [aggregate, pendingCount, deliveredCount, orderTotal, orders] =
      await Promise.all([
        this.prisma.order.aggregate({
          where,
          _sum: { totalNgn: true },
          _count: { _all: true },
        }),
        this.prisma.order.count({
          where: { ...where, status: 'PENDING' },
        }),
        this.prisma.order.count({
          where: { ...where, status: 'DELIVERED' },
        }),
        this.prisma.order.count({ where }),
        this.prisma.order.findMany({
          where,
          include: {
            items: {
              include: {
                product: {
                  include: { images: true, variants: true, category: true },
                },
              },
            },
            customer: true,
          },
          orderBy: { createdAt: 'desc' },
          ...(!usePagination
            ? {}
            : {
                take,
                skip,
              }),
        }),
      ]);

    const analytics = {
      totalOrders: aggregate._count._all,
      totalRevenueNgn: aggregate._sum.totalNgn ?? 0,
      pendingOrders: pendingCount,
      deliveredOrders: deliveredCount,
    };

    return {
      analytics,
      orders,
      orderTotal,
      page: usePagination ? page : 0,
      pageSize: usePagination ? take : orders.length,
    };
  }

  async updateOrder(
    actorId: string,
    orderId: string,
    payload: UpdateOrderAdminDto,
  ) {
    const data: Prisma.OrderUpdateInput = {
      deliveryUpdatedAt: new Date(),
    };
    if (payload.status !== undefined) {
      data.status = payload.status;
    }
    if (payload.trackingNumber !== undefined) {
      data.trackingNumber = payload.trackingNumber;
    }
    if (payload.deliveryNote !== undefined) {
      data.deliveryNote = payload.deliveryNote;
    }
    if (payload.paymentReference !== undefined) {
      data.paymentReference = payload.paymentReference;
    }
    if (payload.paymentGateway !== undefined) {
      data.paymentGateway = payload.paymentGateway;
    }
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data,
      include: {
        items: {
          include: { product: { include: { images: true, variants: true } } },
        },
        customer: true,
      },
    });
    await this.logAction(
      actorId,
      'ORDER_UPDATED',
      'ORDER',
      orderId,
      payload as unknown as Prisma.InputJsonValue,
    );
    return order;
  }

  listCustomers() {
    return this.prisma.user.findMany({
      where: { role: UserRole.CUSTOMER },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isBlocked: true,
        isBlacklisted: true,
        walletCreditNgn: true,
        couponCode: true,
        discountPercent: true,
        createdAt: true,
        emailVerifiedAt: true,
        mustChangePassword: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateUser(
    actorId: string,
    userId: string,
    payload: UpdateUserAdminDto,
  ) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBlocked: payload.isBlocked,
        isBlacklisted: payload.isBlacklisted,
        walletCreditNgn: payload.walletCreditNgn,
        couponCode: payload.couponCode,
        discountPercent: payload.discountPercent,
      },
      select: {
        id: true,
        email: true,
        isBlocked: true,
        isBlacklisted: true,
        walletCreditNgn: true,
        couponCode: true,
        discountPercent: true,
      },
    });
    await this.logAction(
      actorId,
      'USER_UPDATED',
      'USER',
      userId,
      payload as unknown as Prisma.InputJsonValue,
    );
    return updated;
  }

  listMerchantSupportMessages() {
    return this.prisma.merchantSupportMessage.findMany({
      include: {
        merchant: {
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  getOverviewStats() {
    return Promise.all([
      this.prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
      this.prisma.merchantProfile.count(),
      this.prisma.product.count(),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.prisma.order.count({
        where: { status: { in: ['PAID', 'PROCESSING'] } },
      }),
      this.prisma.order.count({ where: { status: 'DELIVERED' } }),
      this.prisma.order.count({
        where: {
          status: { in: ['PAID', 'PROCESSING', 'DELIVERED', 'REFUNDED'] },
        },
      }),
    ]).then(
      ([
        totalUsers,
        totalMerchants,
        totalProducts,
        totalOrders,
        ordersPendingPayment,
        ordersPendingDelivery,
        ordersDelivered,
        ordersCompleted,
      ]) => ({
        totalUsers,
        totalMerchants,
        totalProducts,
        totalOrders,
        ordersPendingPayment,
        ordersPendingDelivery,
        ordersDelivered,
        /** Orders with payment success line (excludes checkout-pending; includes refunds as terminal). */
        ordersCompleted,
      }),
    );
  }

  async updateMerchantBusinessType(
    actorId: string,
    merchantId: string,
    businessType: 'INDIVIDUAL' | 'REGISTERED_BUSINESS',
  ) {
    const m = await this.prisma.merchantProfile.findUnique({
      where: { id: merchantId },
    });
    if (!m) {
      throw new NotFoundException('Merchant not found');
    }
    const updated = await this.prisma.merchantProfile.update({
      where: { id: merchantId },
      data: { businessType: businessType },
      include: { user: { select: { email: true } } },
    });
    await this.logAction(
      actorId,
      'MERCHANT_BUSINESS_TYPE_UPDATED',
      'MERCHANT',
      merchantId,
      { businessType },
    );
    return updated;
  }

  private async logAction(
    actorId: string | undefined,
    action: string,
    targetType: string,
    targetId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    try {
      await this.auditService.log({
        actorId,
        action,
        targetType,
        targetId,
        metadata,
      });
    } catch {
      // Best effort logging. Admin mutation should still succeed.
    }
  }
}
