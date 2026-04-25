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

export class AuthoringRequestError extends Error {
  constructor(
    public override message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AuthoringRequestError";
  }
}

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
