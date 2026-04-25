"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CartLine, Product } from "../lib/storefront-types";

type StorefrontContextType = {
  cart: Record<string, CartLine>;
  addToCart: (product: Product, quantity?: number, selectedVariantId?: string) => void;
  updateQuantity: (lineKey: string, quantity: number) => void;
  removeFromCart: (lineKey: string) => void;
  /** Clear all lines (e.g. after a successful purchase). */
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
  toast: string;
  clearToast: () => void;
};

const STORAGE_KEY = "sm_cart_lines_v4";
const StorefrontContext = createContext<StorefrontContextType | null>(null);

function buildLineKey(productId: string, variantId?: string) {
  return `${productId}::${variantId ?? "default"}`;
}

function getUnitPrice(product: Product, selectedVariantId?: string) {
  const selectedVariant = selectedVariantId
    ? product.variants?.find((variant) => variant.id === selectedVariantId)
    : undefined;
  return product.priceNgn + (selectedVariant?.extraPriceNgn ?? 0);
}

export function StorefrontProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Record<string, CartLine>>(() => {
    if (typeof window === "undefined") return {};
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, CartLine>;
    } catch {
      return {};
    }
  });
  const isFirstPersist = useRef(true);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (isFirstPersist.current) {
      isFirstPersist.current = false;
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product: Product, quantity = 1, selectedVariantId?: string) => {
    const lineKey = buildLineKey(product.id, selectedVariantId);
    setCart((previous) => {
      const existing = previous[lineKey];
      const nextQuantity = (existing?.quantity ?? 0) + quantity;
      const variantLabel = selectedVariantId
        ? product.variants?.find((variant) => variant.id === selectedVariantId)?.label
        : null;
      const productLabel = variantLabel ? `${product.name} (${variantLabel})` : product.name;
      setToast(`${productLabel} added to cart — Qty ${nextQuantity}`);
      return {
        ...previous,
        [lineKey]: {
          key: lineKey,
          product,
          selectedVariantId,
          quantity: nextQuantity,
        },
      };
    });
    window.setTimeout(() => setToast(""), 1800);
  };

  const updateQuantity = (lineKey: string, quantity: number) => {
    setCart((previous) => {
      const line = previous[lineKey];
      if (!line) return previous;
      if (quantity <= 0) {
        const copy = { ...previous };
        delete copy[lineKey];
        return copy;
      }
      return { ...previous, [lineKey]: { ...line, quantity } };
    });
  };

  const removeFromCart = (lineKey: string) => {
    setCart((previous) => {
      const copy = { ...previous };
      delete copy[lineKey];
      return copy;
    });
  };

  const clearCart = () => {
    setCart({});
  };

  const value = useMemo(() => {
    const cartLines = Object.values(cart);
    const cartCount = cartLines.reduce((count, line) => count + line.quantity, 0);
    const cartTotal = cartLines.reduce(
      (sum, line) => sum + line.quantity * getUnitPrice(line.product, line.selectedVariantId),
      0,
    );
    return {
      cart,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      cartCount,
      cartTotal,
      toast,
      clearToast: () => setToast(""),
    };
  }, [cart, toast]);

  return (
    <StorefrontContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          style={{
            position: "fixed",
            right: 14,
            bottom: 14,
            zIndex: 60,
            padding: "0.8rem 0.95rem",
            borderRadius: 12,
            border: "1px solid var(--ui-border)",
            background: "var(--ui-surface)",
            boxShadow: "0 14px 40px -24px rgba(0,0,0,0.6)",
          }}
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      ) : null}
    </StorefrontContext.Provider>
  );
}

export function useStorefront() {
  const context = useContext(StorefrontContext);
  if (!context) throw new Error("useStorefront must be used within StorefrontProvider");
  return context;
}
