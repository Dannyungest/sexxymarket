import { Prisma, Product, ProductImage } from '@prisma/client';

const storeRoot = (
  process.env.STOREFRONT_URL ||
  process.env.NEXT_PUBLIC_STOREFRONT_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');
const DEFAULT_ASSET = `${storeRoot}/sexxymarketlogo.png`;

export function absoluteMediaUrl(
  pathOrUrl: string | null | undefined,
): string | null {
  if (!pathOrUrl) return null;
  const p = String(pathOrUrl).trim();
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  const api = (
    process.env.R2_PUBLIC_BASE_URL ||
    process.env.PUBLIC_API_URL ||
    'http://localhost:4000'
  ).replace(/\/$/, '');
  return p.startsWith('/') ? `${api}${p}` : `${api}/${p}`;
}

export function primaryProductImage(
  product:
    | { images: ProductImage[] }
    | { images?: ProductImage[] }
    | null
    | undefined,
): string | null {
  const list = product?.images;
  if (!list?.length) return null;
  const sorted = [...list].sort((a, b) => a.sortOrder - b.sortOrder);
  return absoluteMediaUrl(sorted[0]?.imageUrl);
}

type OrderItemWithProduct = {
  lineTotalNgn: number;
  quantity: number;
  variantLabelSnapshot: string | null;
  product: Product & { images: ProductImage[] };
};

type OrderForReceipt = {
  items: OrderItemWithProduct[];
  customer: { email: string } | null;
};

/** Any order query that includes `items → product → images` (and optional merchant on product). */
export type OrderForReceiptEmail = {
  items: {
    lineTotalNgn: number;
    quantity: number;
    variantLabelSnapshot: string | null;
    product: { name: string; images: ProductImage[] } & Record<string, unknown>;
  }[];
  customer: { email: string } | null;
};

export function buildReceiptViewUrl(
  paymentReference: string | null | undefined,
  storefrontBase: string,
): string {
  const base = storefrontBase.replace(/\/$/, '');
  if (!paymentReference) return base;
  return `${base}/order/complete?tx_ref=${encodeURIComponent(paymentReference)}`;
}

export function toReceiptLineRows(
  order: OrderForReceipt | OrderForReceiptEmail,
): {
  name: string;
  imageUrl: string;
  quantity: number;
  lineTotalNgn: number;
  variantLabel: string | null;
}[] {
  return order.items.map((line) => {
    const img = primaryProductImage(line.product) ?? DEFAULT_ASSET;
    return {
      name: line.product.name,
      imageUrl: img,
      quantity: line.quantity,
      lineTotalNgn: line.lineTotalNgn,
      variantLabel: line.variantLabelSnapshot ?? null,
    };
  });
}

export const orderReceiptInclude: Prisma.OrderInclude = {
  items: {
    include: {
      product: {
        include: { images: { orderBy: { sortOrder: 'asc' }, take: 4 } },
      },
    },
  },
  customer: { select: { email: true } },
};

/** Webhook: customer receipt email + per-merchant emails */
export const orderIncludeForPaymentWebhook: Prisma.OrderInclude = {
  customer: { select: { email: true } },
  items: {
    include: {
      product: {
        include: {
          images: { orderBy: { sortOrder: 'asc' }, take: 4 },
          merchant: { include: { user: { select: { email: true } } } },
        },
      },
    },
  },
};

export function storefrontBaseUrl(): string {
  return (
    process.env.STOREFRONT_URL ||
    process.env.NEXT_PUBLIC_STOREFRONT_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

/** Shape of `Order` with `include: orderIncludeForPaymentWebhook` — for per-merchant “paid” emails. */
export type OrderForMerchantNotify = {
  id: string;
  totalNgn: number;
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  shippingState: string;
  shippingCity: string;
  items: {
    quantity: number;
    lineTotalNgn: number;
    product: {
      name: string;
      merchant: {
        id: string;
        businessName: string;
        user: { email: string } | null;
      } | null;
    };
  }[];
};
