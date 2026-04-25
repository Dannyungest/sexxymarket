import type { Product } from "./storefront-types";

function numericFallback(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return String(hash % 10_000_000_000).padStart(10, "0");
}

export function resolveProductCode(product: Product, selectedVariantId?: string): string {
  if (product.productCode?.trim()) {
    const digits = product.productCode.replace(/\D/g, "");
    if (digits) return digits;
  }
  if (selectedVariantId) {
    const selected = product.variants?.find((variant) => variant.id === selectedVariantId);
    if (selected?.sku) {
      const digits = selected.sku.replace(/\D/g, "");
      if (digits) return digits;
    }
  }
  const fallbackSku = product.variants?.find((variant) => variant.sku)?.sku;
  if (fallbackSku) {
    const digits = fallbackSku.replace(/\D/g, "");
    if (digits) return digits;
  }
  return numericFallback(product.id);
}
