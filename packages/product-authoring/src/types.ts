export type RichDescriptionBlock = {
  id: string;
  type: "heading" | "paragraph" | "bullets";
  text?: string;
  items?: string[];
  bold?: boolean;
  italic?: boolean;
};

export type RichDescriptionDoc = {
  blocks: RichDescriptionBlock[];
};

export type VariationGuideTable = {
  title: string;
  headers: string[];
  rows: Array<{ label: string; cells: string[] }>;
};

export type ProductMediaDraft = {
  id: string;
  imageUrl: string;
  storageKey?: string | null;
  altText?: string;
  sortOrder: number;
  isPrimary: boolean;
  variantId?: string;
  focalX?: number;
  focalY?: number;
  cropPreset?: "hero" | "card" | "thumb";
};

export type ProductOptionDraft = {
  id: string;
  name: string;
  displayType: "TEXT" | "SWATCH" | "SIZE" | "DIMENSION" | "PACK";
  guideText: string;
  values: Array<{
    id: string;
    value: string;
    code?: string;
    imageUrl?: string;
    storageKey?: string | null;
    altText?: string;
  }>;
};

export type ProductVariantDraft = {
  id: string;
  sku: string;
  extraPriceNgn: number;
  stock: number;
  isActive: boolean;
  selections: Array<{
    optionName: string;
    value: string;
  }>;
};
