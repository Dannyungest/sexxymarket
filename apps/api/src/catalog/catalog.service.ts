import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ListingApproval,
  MerchantStatus,
  MerchantProfile,
  Prisma,
  ProductAuthoringStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { StorageService } from '../integrations/storage.service';
import { buildNumericCode, normalizeNumericCode } from '../common/numeric-code';
import type { AuthUser } from '../common/types/auth-user';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

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

  private assertMerchantAccountUsable(merchant: MerchantProfile | null) {
    if (merchant && merchant.status !== MerchantStatus.APPROVED) {
      throw new ForbiddenException(
        'Merchant account is not approved for listings',
      );
    }
  }

  private async assertMerchantCanPublish(
    merchantUserId: string,
    merchant: MerchantProfile | null,
  ) {
    this.assertMerchantAccountUsable(merchant);
    if (!merchant) {
      throw new ForbiddenException('Merchant profile not found');
    }
    if (merchant.verificationStatus !== 'APPROVED') {
      throw new ForbiddenException(
        'Complete verification before publishing products',
      );
    }
    const user = await this.prisma.user.findUnique({
      where: { id: merchantUserId },
      select: { emailVerifiedAt: true },
    });
    if (!user?.emailVerifiedAt) {
      throw new ForbiddenException('Verify your email before publishing');
    }
  }

  private readonly productInclude = {
    images: {
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    },
    category: true,
    options: {
      orderBy: { sortOrder: 'asc' },
      include: {
        values: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    },
    variants: {
      where: { isActive: true },
      include: {
        optionValues: {
          include: {
            optionValue: {
              include: { option: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    },
  } satisfies Prisma.ProductInclude;

  private readonly productRevisionInclude = {
    images: {
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    },
    options: {
      orderBy: { sortOrder: 'asc' },
      include: { values: { orderBy: { sortOrder: 'asc' } } },
    },
    variants: {
      include: {
        optionValues: {
          include: {
            optionValue: {
              include: { option: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    },
  } satisfies Prisma.ProductInclude;

  private normalizeKey(value: string) {
    return value.trim().toLowerCase();
  }

  private parseValidationErrors(error: unknown) {
    if (
      error instanceof BadRequestException &&
      typeof error.getResponse === 'function'
    ) {
      const response = error.getResponse();
      if (
        typeof response === 'object' &&
        response &&
        'errors' in response &&
        Array.isArray((response as { errors?: unknown }).errors)
      ) {
        return (
          (response as { errors: Array<{ message?: string }> }).errors ?? []
        )
          .map((entry) => entry.message ?? '')
          .filter(Boolean);
      }
      if (
        typeof response === 'object' &&
        response &&
        'message' in response &&
        Array.isArray((response as { message?: unknown }).message)
      ) {
        return ((response as { message: unknown[] }).message ?? [])
          .map((entry) => String(entry))
          .filter(Boolean);
      }
      if (
        typeof response === 'object' &&
        response &&
        'message' in response &&
        typeof (response as { message?: unknown }).message === 'string'
      ) {
        return [String(response.message)];
      }
    }
    return ['Validation failed.'];
  }

  private evaluateReadiness(args: {
    payload: CreateProductDto | UpdateProductDto;
    mediaRecords: Array<{
      imageUrl: string;
      storageKey: string | null;
      altText: string | null;
      sortOrder: number;
      isPrimary: boolean;
    }>;
    optionsInput: NonNullable<CreateProductDto['options']>;
    variantsInput: NonNullable<CreateProductDto['variants']>;
    currentStatus?: ProductAuthoringStatus;
  }) {
    const {
      payload,
      mediaRecords,
      optionsInput,
      variantsInput,
      currentStatus,
    } = args;
    const sectionBlockers: Record<
      'basics' | 'media' | 'options' | 'variants' | 'review',
      string[]
    > = {
      basics: [],
      media: [],
      options: [],
      variants: [],
      review: [],
    };

    if (!payload.name?.trim()) sectionBlockers.basics.push('Name is required.');
    if (!payload.categoryId?.trim())
      sectionBlockers.basics.push('Category is required.');
    if (!payload.description?.trim())
      sectionBlockers.basics.push('Description is required.');
    if ((payload.description?.trim().length ?? 0) < 24) {
      sectionBlockers.basics.push(
        'Description must be at least 24 characters.',
      );
    }
    if ((payload.priceNgn ?? 0) < 100)
      sectionBlockers.basics.push('Base price must be at least 100 NGN.');

    if (mediaRecords.length < 1) {
      sectionBlockers.media.push('At least one image is required.');
    }
    const primary = mediaRecords.find((entry) => entry.isPrimary);
    if (!primary) sectionBlockers.media.push('A primary image is required.');
    if (!primary?.altText?.trim()) {
      sectionBlockers.media.push('Primary image alt text is required.');
    }

    const publishValidationPayload: CreateProductDto = {
      ...(payload as CreateProductDto),
      lifecycleAction: 'PUBLISH',
      media: mediaRecords.map((entry) => ({
        imageUrl: entry.imageUrl,
        storageKey: entry.storageKey ?? undefined,
        altText: entry.altText ?? undefined,
        sortOrder: entry.sortOrder,
        isPrimary: entry.isPrimary,
      })),
      options: optionsInput,
      variants: variantsInput,
    };

    try {
      this.validatePayloadSemantics(
        publishValidationPayload,
        optionsInput,
        variantsInput,
      );
    } catch (error) {
      const messages = this.parseValidationErrors(error);
      messages.forEach((message) => {
        const lower = message.toLowerCase();
        if (lower.includes('option')) sectionBlockers.options.push(message);
        else if (lower.includes('variant') || lower.includes('sku'))
          sectionBlockers.variants.push(message);
        else if (lower.includes('description'))
          sectionBlockers.basics.push(message);
        else sectionBlockers.review.push(message);
      });
    }

    try {
      this.ensurePublishGates({
        payload: publishValidationPayload,
        mediaRecords,
        optionsInput,
        variantsInput,
      });
    } catch (error) {
      const messages = this.parseValidationErrors(error);
      messages.forEach((message) => {
        const lower = message.toLowerCase();
        if (lower.includes('image') || lower.includes('media'))
          sectionBlockers.media.push(message);
        else if (lower.includes('option'))
          sectionBlockers.options.push(message);
        else if (lower.includes('variant'))
          sectionBlockers.variants.push(message);
        else sectionBlockers.review.push(message);
      });
    }

    const dedupe = (messages: string[]) => Array.from(new Set(messages));
    const sectionErrors = {
      basics: dedupe(sectionBlockers.basics),
      media: dedupe(sectionBlockers.media),
      options: dedupe(sectionBlockers.options),
      variants: dedupe(sectionBlockers.variants),
      review: dedupe(sectionBlockers.review),
    };

    const statuses = {
      basics: sectionErrors.basics.length === 0,
      media: sectionErrors.media.length === 0,
      options: sectionErrors.options.length === 0,
      variants: sectionErrors.variants.length === 0,
      review:
        sectionErrors.basics.length === 0 &&
        sectionErrors.media.length === 0 &&
        sectionErrors.options.length === 0 &&
        sectionErrors.variants.length === 0 &&
        sectionErrors.review.length === 0,
    };

    const canSubmitReview =
      statuses.basics &&
      statuses.media &&
      statuses.options &&
      statuses.variants;
    const canPublish = canSubmitReview && statuses.review;
    const lifecycle =
      currentStatus === 'PUBLISHED'
        ? currentStatus
        : canPublish
          ? 'PUBLISHED'
          : canSubmitReview
            ? 'READY_FOR_REVIEW'
            : 'DRAFT';

    return {
      statuses,
      errors: sectionErrors,
      canSubmitReview,
      canPublish,
      suggestedStatus: lifecycle,
    };
  }

  private throwValidationErrors(
    errors: Array<{ field: string; message: string }>,
  ): never {
    throw new BadRequestException({
      message: 'Validation failed for product payload.',
      errors,
    });
  }

  private validatePayloadSemantics(
    payload: CreateProductDto | UpdateProductDto,
    optionsInput: NonNullable<CreateProductDto['options']>,
    variantsInput: NonNullable<CreateProductDto['variants']>,
  ) {
    const errors: Array<{ field: string; message: string }> = [];

    const optionNames = new Set<string>();
    optionsInput.forEach((option, optionIndex) => {
      const optionName = option.name.trim();
      const optionKey = this.normalizeKey(optionName);
      if (optionNames.has(optionKey)) {
        errors.push({
          field: `options.${optionIndex}.name`,
          message: `Duplicate option name "${optionName}".`,
        });
      }
      optionNames.add(optionKey);

      const optionValues = new Set<string>();
      option.values.forEach((value, valueIndex) => {
        const normalized = this.normalizeKey(value.value);
        if (optionValues.has(normalized)) {
          errors.push({
            field: `options.${optionIndex}.values.${valueIndex}.value`,
            message: `Duplicate value "${value.value}" in option "${optionName}".`,
          });
        }
        optionValues.add(normalized);
      });
    });

    const seenVariantCombos = new Set<string>();
    const seenSku = new Set<string>();
    variantsInput.forEach((variant, variantIndex) => {
      const sku = variant.sku?.trim();
      if (sku) {
        if (!/^[a-z0-9][a-z0-9._-]{2,79}$/i.test(sku)) {
          errors.push({
            field: `variants.${variantIndex}.sku`,
            message:
              'SKU must be 3-80 characters using letters, numbers, dot, underscore, or dash.',
          });
        }
        const skuKey = this.normalizeKey(sku);
        if (seenSku.has(skuKey)) {
          errors.push({
            field: `variants.${variantIndex}.sku`,
            message: `Duplicate SKU "${sku}".`,
          });
        }
        seenSku.add(skuKey);
      }

      const combo = (variant.selections ?? [])
        .map(
          (selection) =>
            `${this.normalizeKey(selection.optionName)}:${this.normalizeKey(selection.value)}`,
        )
        .sort()
        .join('|');
      if (combo) {
        if (seenVariantCombos.has(combo)) {
          errors.push({
            field: `variants.${variantIndex}.selections`,
            message: 'Duplicate variant combination detected.',
          });
        }
        seenVariantCombos.add(combo);
      }
    });

    const table = payload.variationGuideTable;
    if (table) {
      if (!Array.isArray(table.headers) || table.headers.length < 1) {
        errors.push({
          field: 'variationGuideTable.headers',
          message: 'Variation guide table needs at least one header.',
        });
      }
      if (!Array.isArray(table.rows) || table.rows.length < 1) {
        errors.push({
          field: 'variationGuideTable.rows',
          message: 'Variation guide table needs at least one row.',
        });
      }
      table.rows?.forEach((row, rowIndex) => {
        if ((row.cells?.length ?? 0) !== (table.headers?.length ?? 0)) {
          errors.push({
            field: `variationGuideTable.rows.${rowIndex}.cells`,
            message: 'Each row must match the number of headers.',
          });
        }
      });
    }

    const rich = payload.descriptionRich;
    const blocks = Array.isArray(
      (rich as { blocks?: unknown[] } | undefined)?.blocks,
    )
      ? ((
          rich as {
            blocks: Array<{ type?: string; text?: string; items?: string[] }>;
          }
        ).blocks ?? [])
      : [];
    if (rich && blocks.length === 0) {
      errors.push({
        field: 'descriptionRich.blocks',
        message:
          'Rich description must contain at least one block when provided.',
      });
    }
    if (blocks.length > 40) {
      errors.push({
        field: 'descriptionRich.blocks',
        message: 'Rich description can contain up to 40 blocks.',
      });
    }
    blocks.forEach((block, index) => {
      if (!['heading', 'paragraph', 'bullets'].includes(block.type ?? '')) {
        errors.push({
          field: `descriptionRich.blocks.${index}.type`,
          message: 'Invalid rich description block type.',
        });
      }
    });

    if (errors.length > 0) {
      this.throwValidationErrors(errors);
    }
  }

  private resolveLifecycle(
    payload: CreateProductDto | UpdateProductDto,
    currentStatus?: ProductAuthoringStatus,
  ) {
    if (!payload.lifecycleAction) {
      if (currentStatus) {
        return {
          action: 'KEEP' as const,
          status: currentStatus,
          explicitTransition: false,
        };
      }
      return {
        action: 'SAVE_DRAFT' as const,
        status: 'DRAFT' as ProductAuthoringStatus,
        explicitTransition: false,
      };
    }
    const action = payload.lifecycleAction;
    if (currentStatus) {
      if (action === 'PUBLISH' && currentStatus === 'DRAFT') {
        throw new BadRequestException({
          message: 'Validation failed for product payload.',
          errors: [
            {
              field: 'lifecycleAction',
              message:
                'Submit product for review before publishing from draft state.',
            },
          ],
        });
      }
      if (action === 'SUBMIT_REVIEW' && currentStatus === 'PUBLISHED') {
        throw new BadRequestException({
          message: 'Validation failed for product payload.',
          errors: [
            {
              field: 'lifecycleAction',
              message:
                'Published product cannot be submitted for review directly.',
            },
          ],
        });
      }
    }
    const status: ProductAuthoringStatus =
      action === 'PUBLISH'
        ? 'PUBLISHED'
        : action === 'SUBMIT_REVIEW'
          ? 'READY_FOR_REVIEW'
          : 'DRAFT';
    return { action, status, explicitTransition: true };
  }

  private ensurePublishGates(args: {
    payload: CreateProductDto | UpdateProductDto;
    mediaRecords: Array<{
      imageUrl: string;
      storageKey: string | null;
      altText: string | null;
      sortOrder: number;
      isPrimary: boolean;
    }>;
    optionsInput: NonNullable<CreateProductDto['options']>;
    variantsInput: NonNullable<CreateProductDto['variants']>;
  }) {
    const errors: Array<{ field: string; message: string }> = [];
    if (!args.payload.name?.trim()) {
      errors.push({ field: 'name', message: 'Name is required.' });
    }
    if (!args.payload.categoryId?.trim()) {
      errors.push({ field: 'categoryId', message: 'Category is required.' });
    }
    if (
      !args.payload.description?.trim() ||
      args.payload.description.trim().length < 24
    ) {
      errors.push({
        field: 'description',
        message: 'Description must be at least 24 characters before publish.',
      });
    }
    if (args.mediaRecords.length < 1) {
      errors.push({
        field: 'media',
        message: 'At least one image is required before publish.',
      });
    }
    const primary = args.mediaRecords.find((item) => item.isPrimary);
    if (!primary) {
      errors.push({
        field: 'media',
        message: 'A primary image is required before publish.',
      });
    }
    if (!primary?.altText?.trim()) {
      errors.push({
        field: 'media.0.altText',
        message: 'Primary image alt text is required before publish.',
      });
    }
    if (args.variantsInput.length > 0 && args.optionsInput.length === 0) {
      errors.push({
        field: 'options',
        message: 'Variants require option groups.',
      });
    }
    if (args.variantsInput.length > 0) {
      const invalidVariant = args.variantsInput.find(
        (variant) => !variant.selections || variant.selections.length === 0,
      );
      if (invalidVariant) {
        errors.push({
          field: 'variants',
          message:
            'Every variant must include at least one option selection before publish.',
        });
      }
    }
    if (errors.length > 0) {
      this.throwValidationErrors(errors);
    }
  }

  private async nextProductCode() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = buildNumericCode(10);
      const taken = await this.prisma.product.findUnique({
        where: { productCode: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    return buildNumericCode(12);
  }

  private normalizeProductCode(input?: string | null) {
    return normalizeNumericCode(input);
  }

  private normalizeMediaPrimary(
    mediaRecords: Array<{
      imageUrl: string;
      storageKey: string | null;
      altText: string | null;
      sortOrder: number;
      isPrimary: boolean;
    }>,
  ) {
    if (mediaRecords.length === 0) return mediaRecords;
    const preferredIndex =
      mediaRecords.findIndex((entry) => entry.isPrimary) >= 0
        ? mediaRecords.findIndex((entry) => entry.isPrimary)
        : 0;
    return mediaRecords
      .map((entry, index) => ({
        ...entry,
        isPrimary: index === preferredIndex,
      }))
      .sort((a, b) => {
        if (a.isPrimary === b.isPrimary) return a.sortOrder - b.sortOrder;
        return a.isPrimary ? -1 : 1;
      })
      .map((entry, index) => ({
        ...entry,
        sortOrder: index,
      }));
  }

  private buildVariantLabel(input: {
    fallbackLabel?: string;
    selections?: Array<{ optionName: string; value: string }>;
  }) {
    if (input.fallbackLabel?.trim()) return input.fallbackLabel.trim();
    const parts =
      input.selections
        ?.map((selection) => `${selection.optionName}: ${selection.value}`)
        .filter(Boolean) ?? [];
    return parts.length > 0 ? parts.join(' / ') : 'Default';
  }

  private buildMediaRecords(payload: CreateProductDto | UpdateProductDto) {
    if (payload.media && payload.media.length > 0) {
      return this.normalizeMediaPrimary(
        payload.media.map((media, index) => ({
          imageUrl: media.imageUrl,
          storageKey: media.storageKey ?? null,
          altText: media.altText ?? null,
          sortOrder: media.sortOrder ?? index,
          isPrimary: media.isPrimary ?? index === 0,
        })),
      );
    }
    return this.normalizeMediaPrimary(
      payload.imageUrls?.map((imageUrl, index) => ({
        imageUrl,
        storageKey: null,
        altText: null,
        sortOrder: index,
        isPrimary: index === 0,
      })) ?? [],
    );
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

  private async captureRevision(
    tx: Prisma.TransactionClient,
    productId: string,
    action: string,
    actorId?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    const current = await tx.product.findUnique({
      where: { id: productId },
      include: this.productRevisionInclude,
    });
    if (!current) return;

    const nextRevisionNumber =
      (
        await tx.productRevision.aggregate({
          where: { productId },
          _max: { revisionNumber: true },
        })
      )._max.revisionNumber ?? 0;

    const snapshot = {
      name: current.name,
      slug: current.slug,
      productCode: current.productCode,
      description: current.description,
      descriptionRich: current.descriptionRich,
      priceNgn: current.priceNgn,
      stock: current.stock,
      categoryId: current.categoryId,
      variationGuide: current.variationGuide,
      variationGuideTable: current.variationGuideTable,
      requiresManualApproval: current.requiresManualApproval,
      approvalStatus: current.approvalStatus,
      isApproved: current.isApproved,
      authoringStatus: current.authoringStatus,
      media: current.images.map((image) => ({
        imageUrl: image.imageUrl,
        storageKey: image.storageKey,
        altText: image.altText,
        sortOrder: image.sortOrder,
        isPrimary: image.isPrimary,
        variantId: image.variantId,
      })),
      options: current.options.map((option) => ({
        name: option.name,
        displayType: option.displayType,
        guideText: option.guideText,
        sortOrder: option.sortOrder,
        values: option.values.map((value) => ({
          value: value.value,
          code: value.code,
          imageUrl: value.imageUrl,
          storageKey: value.storageKey,
          altText: value.altText,
          sortOrder: value.sortOrder,
        })),
      })),
      variants: current.variants.map((variant) => ({
        label: variant.label,
        sku: variant.sku,
        extraPriceNgn: variant.extraPriceNgn,
        stock: variant.stock,
        isActive: variant.isActive,
        selections: variant.optionValues.map((entry) => ({
          optionName: entry.optionValue.option.name,
          value: entry.optionValue.value,
        })),
      })),
    };

    await tx.productRevision.create({
      data: {
        productId,
        revisionNumber: nextRevisionNumber + 1,
        action,
        snapshot: snapshot,
        metadata,
        createdByUserId: actorId,
      },
    });
  }

  private async replaceGraphInTransaction(args: {
    tx: Prisma.TransactionClient;
    productId: string;
    payload: CreateProductDto | UpdateProductDto;
    mediaRecords: Array<{
      imageUrl: string;
      storageKey: string | null;
      altText: string | null;
      sortOrder: number;
      isPrimary: boolean;
    }>;
    optionsInput: NonNullable<CreateProductDto['options']>;
    variantsInput: NonNullable<CreateProductDto['variants']>;
  }) {
    const {
      tx,
      productId,
      payload,
      mediaRecords,
      optionsInput,
      variantsInput,
    } = args;

    await tx.productImage.deleteMany({ where: { productId } });
    await tx.productVariantValue.deleteMany({
      where: { variant: { productId } },
    });
    await tx.productVariant.deleteMany({ where: { productId } });
    await tx.productOptionValue.deleteMany({
      where: { option: { productId } },
    });
    await tx.productOption.deleteMany({ where: { productId } });

    if (mediaRecords.length > 0) {
      await tx.productImage.createMany({
        data: mediaRecords.map((media) => ({
          productId,
          ...media,
        })),
      });
    }

    const optionValueMap = new Map<string, string>();
    for (const [optionIndex, option] of optionsInput.entries()) {
      const createdOption = await tx.productOption.create({
        data: {
          productId,
          name: option.name,
          displayType: option.displayType ?? 'TEXT',
          guideText: option.guideText ?? null,
          sortOrder: option.sortOrder ?? optionIndex,
        },
      });
      for (const [valueIndex, value] of option.values.entries()) {
        const createdValue = await tx.productOptionValue.create({
          data: {
            optionId: createdOption.id,
            value: value.value,
            code: value.code ?? null,
            imageUrl: value.imageUrl ?? null,
            storageKey: value.storageKey ?? null,
            altText: value.altText ?? null,
            sortOrder: value.sortOrder ?? valueIndex,
          },
        });
        optionValueMap.set(
          `${this.normalizeKey(createdOption.name)}::${this.normalizeKey(createdValue.value)}`,
          createdValue.id,
        );
      }
    }

    for (const variant of variantsInput) {
      const createdVariant = await tx.productVariant.create({
        data: {
          productId,
          label: this.buildVariantLabel({
            fallbackLabel: variant.label,
            selections: variant.selections,
          }),
          sku: variant.sku?.trim() || null,
          extraPriceNgn: variant.extraPriceNgn ?? 0,
          stock: variant.stock,
          isActive: variant.isActive ?? true,
        },
      });
      const selections = variant.selections ?? [];
      if (selections.length > 0) {
        const resolved = selections.map((selection) => {
          const optionValueId =
            optionValueMap.get(
              `${this.normalizeKey(selection.optionName)}::${this.normalizeKey(selection.value)}`,
            ) ?? null;
          return {
            optionName: selection.optionName,
            value: selection.value,
            optionValueId,
          };
        });
        const unresolved = resolved.find((entry) => !entry.optionValueId);
        if (unresolved) {
          throw new BadRequestException({
            message: 'Validation failed for product payload.',
            errors: [
              {
                field: 'variants.selections',
                message: `Selection "${unresolved.optionName}: ${unresolved.value}" does not resolve to an option value.`,
              },
            ],
          });
        }
        await tx.productVariantValue.createMany({
          data: resolved.map((entry) => ({
            variantId: createdVariant.id,
            optionValueId: entry.optionValueId as string,
          })),
        });
      }
    }

    if (payload.media || payload.imageUrls) {
      await tx.product.update({
        where: { id: productId },
        data: {
          autosaveVersion: (payload.autosaveVersion ?? 0) + 1,
        },
      });
    }
  }

  listProducts() {
    return this.prisma.product
      .findMany({
        where: {
          isApproved: true,
          isHidden: false,
          authoringStatus: 'PUBLISHED',
        },
        include: this.productInclude,
        orderBy: { createdAt: 'desc' },
      })
      .then((products) =>
        products.map((product) => this.normalizeProductMedia(product)),
      );
  }

  async searchProducts(filters: {
    query?: string;
    categoryId?: string;
    page?: string | number;
    pageSize?: string | number;
  }) {
    const pageRaw = Number(filters.page);
    const pageSizeRaw = Number(filters.pageSize);
    const page = Number.isFinite(pageRaw) ? Math.max(0, pageRaw) : 0;
    const pageSize = Number.isFinite(pageSizeRaw)
      ? Math.min(80, Math.max(1, pageSizeRaw))
      : 40;
    const skip = page * pageSize;

    const andParts: Prisma.ProductWhereInput[] = [
      { isApproved: true },
      { isHidden: false },
      { authoringStatus: 'PUBLISHED' },
    ];
    if (filters.categoryId) {
      andParts.push({ categoryId: filters.categoryId });
    }
    const q = filters.query?.trim();
    if (q) {
      andParts.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { productCode: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
          {
            variants: {
              some: {
                OR: [
                  { label: { contains: q, mode: 'insensitive' } },
                  { sku: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      });
    }
    const where: Prisma.ProductWhereInput = { AND: andParts };

    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: this.productInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      items: items.map((item) => this.normalizeProductMedia(item)),
      total,
      page,
      pageSize,
    };
  }

  getProductByIdOrSlug(idOrSlug: string) {
    return this.prisma.product
      .findFirst({
        where: {
          isApproved: true,
          isHidden: false,
          authoringStatus: 'PUBLISHED',
          OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        },
        include: this.productInclude,
      })
      .then((product) =>
        product ? this.normalizeProductMedia(product) : product,
      );
  }

  listCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async listMerchantProducts(userId: string) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
    });
    if (!profile) return [];
    return this.prisma.product
      .findMany({
        where: { merchantId: profile.id },
        include: this.productInclude,
        orderBy: { createdAt: 'desc' },
      })
      .then((products) =>
        products.map((product) => this.normalizeProductMedia(product)),
      );
  }

  async createProduct(payload: CreateProductDto, merchantUserId?: string) {
    const merchantProfile = merchantUserId
      ? await this.prisma.merchantProfile.findUnique({
          where: { userId: merchantUserId },
        })
      : null;
    this.assertMerchantAccountUsable(merchantProfile);
    const lifecycle = this.resolveLifecycle(payload);
    const mediaRecords = this.buildMediaRecords(payload);
    const optionsInput = payload.options ?? [];
    const variantsInput = payload.variants ?? [];
    this.validatePayloadSemantics(payload, optionsInput, variantsInput);
    if (lifecycle.action === 'PUBLISH') {
      if (merchantUserId) {
        await this.assertMerchantCanPublish(merchantUserId, merchantProfile);
      }
      this.ensurePublishGates({
        payload,
        mediaRecords,
        optionsInput,
        variantsInput,
      });
    }
    const autoPublish = merchantProfile?.merchantTier === 'SUPER';

    const isPublish = lifecycle.action === 'PUBLISH';
    const requiresManualApproval = merchantProfile
      ? (payload.requiresManualApproval ?? !autoPublish)
      : false;
    const approvalStatus: ListingApproval = !isPublish
      ? 'PENDING'
      : merchantProfile
        ? autoPublish && !requiresManualApproval
          ? 'APPROVED'
          : 'PENDING'
        : 'APPROVED';
    const isApproved = isPublish
      ? merchantProfile
        ? autoPublish && !requiresManualApproval
        : true
      : false;

    const productCode =
      this.normalizeProductCode(payload.productCode) ??
      (await this.nextProductCode());

    const created = await this.prisma.$transaction(async (tx) => {
      try {
        const product = await tx.product.create({
          data: {
            name: payload.name,
            slug: payload.slug,
            productCode,
            description: payload.description,
            descriptionRich:
              (payload.descriptionRich as Prisma.InputJsonValue | undefined) ??
              undefined,
            priceNgn: payload.priceNgn,
            stock: payload.stock,
            variationGuide: payload.variationGuide,
            variationGuideTable:
              (payload.variationGuideTable as
                | Prisma.InputJsonValue
                | undefined) ?? undefined,
            categoryId: payload.categoryId,
            merchantId: merchantProfile?.id,
            requiresManualApproval,
            approvalStatus,
            isApproved,
            authoringStatus: lifecycle.status,
            publishedAt: lifecycle.status === 'PUBLISHED' ? new Date() : null,
            lastSavedAt: new Date(),
            autosaveVersion: payload.autosaveVersion ?? 0,
          },
        });
        await this.replaceGraphInTransaction({
          tx,
          productId: product.id,
          payload,
          mediaRecords,
          optionsInput,
          variantsInput,
        });
        await this.captureRevision(
          tx,
          product.id,
          `CREATE_${lifecycle.action}`,
          merchantUserId,
          {
            autosaveCheckpointId: payload.autosaveCheckpointId ?? null,
          },
        );
        return product;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            'Product code or slug already exists. Please retry.',
          );
        }
        throw error;
      }
    });

    return this.prisma.product
      .findUnique({
        where: { id: created.id },
        include: this.productInclude,
      })
      .then((product) =>
        product ? this.normalizeProductMedia(product) : product,
      );
  }

  previewReadiness(
    payload: CreateProductDto | UpdateProductDto,
    currentStatus?: ProductAuthoringStatus,
  ) {
    const mediaRecords = this.buildMediaRecords(payload);
    const optionsInput = payload.options ?? [];
    const variantsInput = payload.variants ?? [];
    return this.evaluateReadiness({
      payload,
      mediaRecords,
      optionsInput,
      variantsInput,
      currentStatus,
    });
  }

  async updateProduct(
    id: string,
    payload: UpdateProductDto,
    merchantUserId?: string,
  ) {
    let merchantProfile: MerchantProfile | null = null;
    if (merchantUserId) {
      merchantProfile = await this.prisma.merchantProfile.findUnique({
        where: { userId: merchantUserId },
      });
      this.assertMerchantAccountUsable(merchantProfile);
      const product = await this.prisma.product.findUnique({ where: { id } });
      if (
        !product ||
        !merchantProfile ||
        product.merchantId !== merchantProfile.id
      ) {
        throw new ForbiddenException('You cannot edit this product');
      }
    }

    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const mergedPayload = {
      ...existing,
      ...payload,
      media:
        (payload.media ?? payload.imageUrls)
          ? this.buildMediaRecords(payload)
          : undefined,
      options: payload.options ?? [],
      variants: payload.variants ?? [],
    };

    const lifecycle = this.resolveLifecycle(payload, existing.authoringStatus);
    const mediaRecords =
      payload.media || payload.imageUrls ? this.buildMediaRecords(payload) : [];
    const optionsInput = payload.options ?? [];
    const variantsInput = payload.variants ?? [];
    this.validatePayloadSemantics(
      {
        ...(mergedPayload as unknown as CreateProductDto),
      },
      optionsInput,
      variantsInput,
    );
    if (lifecycle.action === 'PUBLISH') {
      if (merchantUserId) {
        await this.assertMerchantCanPublish(merchantUserId, merchantProfile);
      }
      this.ensurePublishGates({
        payload: mergedPayload as unknown as CreateProductDto,
        mediaRecords:
          mediaRecords.length > 0
            ? mediaRecords
            : this.normalizeMediaPrimary(
                (
                  await this.prisma.productImage.findMany({
                    where: { productId: id },
                    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                  })
                ).map((image) => ({
                  imageUrl: image.imageUrl,
                  storageKey: image.storageKey,
                  altText: image.altText,
                  sortOrder: image.sortOrder,
                  isPrimary: image.isPrimary,
                })),
              ),
        optionsInput,
        variantsInput,
      });
    }

    let dataRequiresManualApproval: boolean | undefined =
      payload.requiresManualApproval;
    let dataIsApproved: boolean | undefined;
    let dataApprovalStatus: ListingApproval | undefined;
    if (lifecycle.explicitTransition) {
      if (merchantUserId && merchantProfile) {
        const autoPublish = merchantProfile.merchantTier === 'SUPER';
        dataRequiresManualApproval =
          payload.requiresManualApproval !== undefined
            ? payload.requiresManualApproval
            : !autoPublish;
        if (lifecycle.status === 'PUBLISHED') {
          const ok = autoPublish && !dataRequiresManualApproval;
          dataIsApproved = ok;
          dataApprovalStatus = ok ? 'APPROVED' : 'PENDING';
        } else {
          dataIsApproved = false;
          dataApprovalStatus = 'PENDING';
        }
      } else {
        dataIsApproved =
          lifecycle.status === 'PUBLISHED'
            ? true
            : lifecycle.status === 'DRAFT'
              ? false
              : undefined;
        dataApprovalStatus =
          lifecycle.explicitTransition && lifecycle.status === 'PUBLISHED'
            ? 'APPROVED'
            : lifecycle.explicitTransition && lifecycle.status === 'DRAFT'
              ? 'PENDING'
              : undefined;
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      try {
        const product = await tx.product.update({
          where: { id },
          data: {
            name: payload.name,
            slug: payload.slug,
            productCode:
              this.normalizeProductCode(payload.productCode) ?? undefined,
            description: payload.description,
            descriptionRich:
              (payload.descriptionRich as Prisma.InputJsonValue | undefined) ??
              undefined,
            priceNgn: payload.priceNgn,
            stock: payload.stock,
            variationGuide: payload.variationGuide,
            variationGuideTable:
              (payload.variationGuideTable as
                | Prisma.InputJsonValue
                | undefined) ?? undefined,
            categoryId: payload.categoryId,
            requiresManualApproval:
              lifecycle.explicitTransition && merchantUserId && merchantProfile
                ? dataRequiresManualApproval
                : payload.requiresManualApproval,
            authoringStatus: lifecycle.explicitTransition
              ? lifecycle.status
              : undefined,
            publishedAt:
              lifecycle.explicitTransition && lifecycle.status === 'PUBLISHED'
                ? new Date()
                : lifecycle.explicitTransition && lifecycle.status === 'DRAFT'
                  ? null
                  : undefined,
            isApproved: lifecycle.explicitTransition
              ? dataIsApproved
              : undefined,
            approvalStatus: lifecycle.explicitTransition
              ? dataApprovalStatus
              : undefined,
            lastSavedAt: new Date(),
            autosaveVersion:
              payload.autosaveVersion !== undefined
                ? payload.autosaveVersion + 1
                : undefined,
          },
        });

        if (
          payload.media ||
          payload.imageUrls ||
          payload.options ||
          payload.variants
        ) {
          await this.replaceGraphInTransaction({
            tx,
            productId: id,
            payload,
            mediaRecords:
              payload.media || payload.imageUrls
                ? mediaRecords
                : this.normalizeMediaPrimary(
                    (
                      await tx.productImage.findMany({
                        where: { productId: id },
                        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                      })
                    ).map((image) => ({
                      imageUrl: image.imageUrl,
                      storageKey: image.storageKey,
                      altText: image.altText,
                      sortOrder: image.sortOrder,
                      isPrimary: image.isPrimary,
                    })),
                  ),
            optionsInput,
            variantsInput,
          });
        }
        await this.captureRevision(
          tx,
          id,
          `UPDATE_${lifecycle.action}`,
          merchantUserId,
          {
            autosaveCheckpointId: payload.autosaveCheckpointId ?? null,
          },
        );
        return product;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            'Product code or slug already exists. Please retry.',
          );
        }
        throw error;
      }
    });

    return this.prisma.product
      .findUnique({
        where: { id: updated.id },
        include: this.productInclude,
      })
      .then((product) =>
        product ? this.normalizeProductMedia(product) : product,
      );
  }

  async deleteProduct(id: string, merchantUserId?: string) {
    if (merchantUserId) {
      const merchantProfile = await this.prisma.merchantProfile.findUnique({
        where: { userId: merchantUserId },
      });
      if (
        merchantProfile &&
        merchantProfile.status !== MerchantStatus.APPROVED
      ) {
        throw new ForbiddenException(
          'Merchant account is not approved for listings',
        );
      }
      const product = await this.prisma.product.findUnique({ where: { id } });
      if (
        !product ||
        !merchantProfile ||
        product.merchantId !== merchantProfile.id
      ) {
        throw new ForbiddenException('You cannot delete this product');
      }
    }
    await this.prisma.product.delete({ where: { id } });
    return { deleted: true };
  }

  private async assertMerchantOwnsProduct(
    productId: string,
    merchantUserId: string,
  ) {
    const [product, profile] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: productId } }),
      this.prisma.merchantProfile.findUnique({
        where: { userId: merchantUserId },
      }),
    ]);
    if (!product || !profile || product.merchantId !== profile.id) {
      throw new ForbiddenException('You cannot access this product');
    }
  }

  async listProductRevisions(productId: string, user: AuthUser) {
    if (user.role === 'MERCHANT') {
      await this.assertMerchantOwnsProduct(productId, user.sub);
    }
    const revisions = await this.prisma.productRevision.findMany({
      where: { productId },
      orderBy: { revisionNumber: 'desc' },
      take: 50,
    });
    return revisions;
  }

  async rollbackProductToRevision(
    productId: string,
    revisionId: string,
    user: AuthUser,
  ) {
    if (user.role === 'MERCHANT') {
      await this.assertMerchantOwnsProduct(productId, user.sub);
    }
    const actorId = user.sub;
    const revision = await this.prisma.productRevision.findFirst({
      where: { id: revisionId, productId },
    });
    if (!revision) {
      throw new NotFoundException('Revision not found for this product.');
    }

    const snapshot = revision.snapshot as unknown as CreateProductDto;
    const mediaRecords = this.normalizeMediaPrimary(
      (snapshot.media ?? []).map((media, index) => ({
        imageUrl: media.imageUrl,
        storageKey: media.storageKey ?? null,
        altText: media.altText ?? null,
        sortOrder: media.sortOrder ?? index,
        isPrimary: media.isPrimary ?? index === 0,
      })),
    );
    const optionsInput = snapshot.options ?? [];
    const variantsInput = snapshot.variants ?? [];
    this.validatePayloadSemantics(snapshot, optionsInput, variantsInput);

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: {
          name: snapshot.name,
          slug: snapshot.slug,
          productCode:
            this.normalizeProductCode(snapshot.productCode) ?? undefined,
          description: snapshot.description,
          descriptionRich:
            (snapshot.descriptionRich as Prisma.InputJsonValue | undefined) ??
            undefined,
          priceNgn: snapshot.priceNgn,
          stock: snapshot.stock,
          categoryId: snapshot.categoryId,
          variationGuide: snapshot.variationGuide,
          variationGuideTable:
            (snapshot.variationGuideTable as
              | Prisma.InputJsonValue
              | undefined) ?? undefined,
          requiresManualApproval: snapshot.requiresManualApproval,
          authoringStatus:
            snapshot.lifecycleAction === 'PUBLISH'
              ? 'PUBLISHED'
              : snapshot.lifecycleAction === 'SUBMIT_REVIEW'
                ? 'READY_FOR_REVIEW'
                : 'DRAFT',
          lastSavedAt: new Date(),
        },
      });
      await this.replaceGraphInTransaction({
        tx,
        productId,
        payload: snapshot,
        mediaRecords,
        optionsInput,
        variantsInput,
      });
      await this.captureRevision(tx, productId, 'ROLLBACK', actorId, {
        sourceRevisionId: revisionId,
      });
    });

    return this.prisma.product.findUnique({
      where: { id: productId },
      include: this.productInclude,
    });
  }

  listPendingListings() {
    return this.prisma.product
      .findMany({
        where: {
          approvalStatus: 'PENDING',
          authoringStatus: 'READY_FOR_REVIEW',
        },
        include: {
          merchant: { include: { user: { select: { email: true } } } },
          ...this.productInclude,
        },
        orderBy: { createdAt: 'desc' },
      })
      .then((products) =>
        products.map((product) => this.normalizeProductMedia(product)),
      );
  }

  reviewListing(productId: string, decision: 'APPROVED' | 'REJECTED') {
    return this.prisma.product.update({
      where: { id: productId },
      data: {
        approvalStatus: decision,
        isApproved: decision === 'APPROVED',
      },
    });
  }
}
