/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { ActionButton, ProductCodePill, StarRow, SurfaceCard } from "@sexxymarket/ui";
import { Eye } from "lucide-react";
import { useState } from "react";
import type { Product } from "../lib/storefront-types";
import { useStorefront } from "./storefront-provider";
import { resolveProductCode } from "../lib/product-code";

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

function normalizeMediaUrl(url: string) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const isLocalhostHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
      if (isLocalhostHost && parsed.pathname.startsWith("/uploads/") && apiBase) {
        return `${apiBase}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      return url;
    }
    return url;
  }
  if (!apiBase) return url.startsWith("/") ? url : `/${url}`;
  return `${apiBase}${url.startsWith("/") ? url : `/${url}`}`;
}

function resolveCardImage(url?: string) {
  if (!url) return "/sexxymarketlogo.png";
  const normalized = normalizeMediaUrl(url);
  if (!normalized.endsWith(".webp")) return normalized;
  return normalized.replace(/\.webp$/i, "-card.webp");
}

export function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useStorefront();
  const [adding, setAdding] = useState(false);
  const image = resolveCardImage(product.images?.[0]?.imageUrl);
  const productCode = resolveProductCode(product);

  return (
    <SurfaceCard style={{ padding: 0 }}>
      <article className="product-card">
        <Link href={`/product/${product.slug}`} aria-label={`Open ${product.name} details`}>
          <img
            src={image}
            alt={product.name}
            onError={(event) => {
              const target = event.currentTarget;
              if (/\/sexxymarketlogo\.(png|PNG)$/.test(target.src)) {
                target.src = "/sexxymarketlogo.png";
              }
            }}
          />
        </Link>
        <div style={{ padding: "0.88rem", display: "grid", gap: 8 }}>
          <small style={{ color: "var(--ui-muted)" }}>{product.category?.name ?? "General"}</small>
          <Link href={`/product/${product.slug}`}>
            <strong style={{ fontSize: "1.04rem", lineHeight: 1.32 }}>{product.name}</strong>
          </Link>
          <ProductCodePill code={productCode} />
          <StarRow rating={4.8} count={18} />
          <p style={{ margin: 0, color: "var(--ui-muted)", fontSize: "0.9rem", minHeight: 46, whiteSpace: "pre-wrap" }}>
            {product.description.slice(0, 90)}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "auto" }}>
            <strong>NGN {product.priceNgn.toLocaleString()}</strong>
            <small style={{ color: "var(--ui-muted)" }}>Stock {product.stock}</small>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ActionButton
              isLoading={adding}
              loadingText="Adding..."
              onClick={() => {
                setAdding(true);
                addToCart(product);
                window.setTimeout(() => setAdding(false), 320);
              }}
            >
              Add to cart
            </ActionButton>
            <Link href={`/product/${product.slug}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ActionButton ghost>View <Eye size={14} strokeWidth={1.85} /></ActionButton>
            </Link>
          </div>
        </div>
      </article>
    </SurfaceCard>
  );
}
