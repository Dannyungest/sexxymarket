export type FullOrder = {
  id: string;
  status: string;
  totalNgn: number;
  subtotalNgn: number;
  paymentGateway: string;
  paymentReference?: string | null;
  /** Admin-recorded cash payment (manual order) */
  cashAmountNgn?: number | null;
  /** Who collected cash (admin manual order) */
  cashCollectedBy?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  shippingAddress: string;
  shippingState: string;
  shippingCity: string;
  recipientName: string;
  recipientPhone: string;
  trackingNumber?: string | null;
  paymentLink?: string | null;
  createdAt: string;
  userId?: string | null;
  items: Array<{
    id: string;
    quantity: number;
    unitPriceNgn: number;
    lineTotalNgn: number;
    product: {
      id: string;
      name: string;
      productCode: string;
      images?: { imageUrl: string }[];
    };
  }>;
  customer?: { id: string; email: string; firstName: string; lastName: string } | null;
};

export type CatalogProduct = {
  id: string;
  name: string;
  productCode: string;
  priceNgn: number;
  stock: number;
  slug: string;
  categoryId: string;
  variationGuide?: string | null;
  images: { id: string; imageUrl: string }[];
  options?: Array<{
    id: string;
    name: string;
    displayType: string;
    guideText?: string | null;
    sortOrder: number;
    values: Array<{
      id: string;
      value: string;
      code?: string | null;
      imageUrl?: string | null;
      storageKey?: string | null;
      altText?: string | null;
      sortOrder: number;
    }>;
  }>;
  variants: Array<{
    id: string;
    label: string;
    sku?: string | null;
    extraPriceNgn: number;
    stock: number;
    isActive?: boolean;
    optionValues?: Array<{
      optionValue: {
        id: string;
        value: string;
        option: { id: string; name: string };
      };
    }>;
  }>;
};

export type Category = { id: string; name: string; slug: string };

export type AdminListing = {
  id: string;
  name: string;
  slug: string;
  productCode: string;
  description: string;
  descriptionRich?: Record<string, unknown> | null;
  priceNgn: number;
  stock: number;
  categoryId: string;
  variationGuide?: string | null;
  variationGuideTable?: {
    title: string;
    headers: string[];
    rows: Array<{ label: string; cells: string[] }>;
  } | null;
  approvalStatus: string;
  authoringStatus?: "DRAFT" | "READY_FOR_REVIEW" | "PUBLISHED";
  isHidden: boolean;
  isApproved: boolean;
  lastSavedAt?: string | null;
  publishedAt?: string | null;
  autosaveVersion?: number;
  images: Array<{
    id: string;
    imageUrl: string;
    storageKey?: string | null;
    altText?: string | null;
    sortOrder?: number;
    isPrimary?: boolean;
    variantId?: string | null;
  }>;
  options?: Array<{
    id: string;
    name: string;
    displayType: string;
    guideText?: string | null;
    sortOrder: number;
    values: Array<{
      id: string;
      value: string;
      code?: string | null;
      imageUrl?: string | null;
      storageKey?: string | null;
      altText?: string | null;
      sortOrder: number;
    }>;
  }>;
  variants: Array<{
    id: string;
    label: string;
    sku?: string | null;
    extraPriceNgn: number;
    stock: number;
    isActive?: boolean;
    optionValues?: Array<{
      optionValue: {
        id: string;
        value: string;
        option: { id: string; name: string };
      };
    }>;
  }>;
  category?: { name: string; id: string };
  merchant?: { businessName: string; user?: { email: string } };
};

export type ProductRevision = {
  id: string;
  productId: string;
  revisionNumber: number;
  action: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type ProductReadiness = {
  statuses: {
    basics: boolean;
    media: boolean;
    options: boolean;
    variants: boolean;
    review: boolean;
  };
  errors: {
    basics: string[];
    media: string[];
    options: string[];
    variants: string[];
    review: string[];
  };
  canSubmitReview: boolean;
  canPublish: boolean;
  suggestedStatus: "DRAFT" | "READY_FOR_REVIEW" | "PUBLISHED";
};

export type AdminMerchant = {
  id: string;
  merchantCode: string;
  businessName: string;
  businessType?: "INDIVIDUAL" | "REGISTERED_BUSINESS" | null;
  merchantTier?: "STANDARD" | "SUPER" | null;
  contactAddress?: string;
  businessAddress?: string | null;
  hasPhysicalLocation?: boolean;
  status: string;
  verificationStatus?: string;
  user: { email: string; firstName: string; lastName: string };
  _count?: { products: number };
};

export type AdminMerchantDocument = {
  id: string;
  documentType: string;
  fileKey: string;
  fileUrl: string;
  createdAt: string;
};

export type AdminMerchantVerification = {
  id: string;
  isRegisteredBusinessUpgrade?: boolean;
  identityType: string;
  cacNumber: string | null;
  tinNumber?: string | null;
  businessAddress: string;
  status: string;
  reviewReason?: string | null;
  submittedAt: string;
  documents: AdminMerchantDocument[];
};

export type AdminMerchantProductRow = {
  id: string;
  name: string;
  productCode: string;
  stock: number;
  priceNgn: number;
  approvalStatus: string;
  authoringStatus: string;
  slug: string;
  isHidden: boolean;
};

export type AdminMerchantDetail = Omit<AdminMerchant, "user"> & {
  user: { id: string; email: string; firstName: string; lastName: string; phone?: string | null };
  verifications: AdminMerchantVerification[];
  products: AdminMerchantProductRow[];
  analytics: { lineItems: number; orders: number; revenueNgn: number };
};

export type AdminCustomer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isBlocked: boolean;
  isBlacklisted: boolean;
  walletCreditNgn: number;
  couponCode?: string | null;
  discountPercent: number;
  emailVerifiedAt?: string | null;
  mustChangePassword?: boolean;
};
