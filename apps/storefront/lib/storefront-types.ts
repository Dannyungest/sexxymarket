export type Product = {
  id: string;
  slug: string;
  productCode?: string;
  name: string;
  description: string;
  descriptionRich?: { blocks?: Array<{ type: string; text?: string; items?: string[]; bold?: boolean; italic?: boolean }> } | null;
  variationGuide?: string | null;
  variationGuideTable?: {
    title: string;
    headers: string[];
    rows: Array<{ label: string; cells: string[] }>;
  } | null;
  priceNgn: number;
  stock: number;
  images?: Array<{
    id?: string;
    imageUrl: string;
    altText?: string | null;
    isPrimary?: boolean;
    sortOrder?: number;
    variantId?: string | null;
    variants?: { card?: string | null; thumb?: string | null } | null;
  }>;
  category?: { id: string; name: string; slug: string };
  options?: Array<{
    id: string;
    name: string;
    displayType: string;
    guideText?: string | null;
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
  variants?: Array<{
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

export type Category = {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
};

export type Review = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  user?: { firstName: string; lastName: string };
};

export type ReviewSummary = {
  averageRating: number;
  totalReviews: number;
};

export type ReviewEligibility = {
  canReview: boolean;
  orderId?: string;
};

export type CartLine = {
  key: string;
  product: Product;
  quantity: number;
  selectedVariantId?: string;
};
