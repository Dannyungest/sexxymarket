"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { ActionButton, ProductCodePill, QuantityStepper, SurfaceCard } from "@sexxymarket/ui";
import { CheckCircle2, CreditCard, PackageCheck, ShoppingBag } from "lucide-react";
import { StorefrontShell } from "../../components/storefront-shell";
import { useStorefront } from "../../components/storefront-provider";
import { CheckoutMethodModal } from "../../components/checkout-method-modal";
import { getStoredToken } from "../../lib/use-auth-session";
import { resolveProductCode } from "../../lib/product-code";
import { DELIVERY_ESTIMATE_SHORT } from "../../lib/delivery-copy";

export default function CartPage() {
  const router = useRouter();
  const { cart, cartTotal, updateQuantity, removeFromCart } = useStorefront();
  const [methodModalOpen, setMethodModalOpen] = useState(false);
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const cartLines = useMemo(() => Object.values(cart), [cart]);
  const visibleCartLines = isHydrated ? cartLines : [];
  const visibleCartTotal = isHydrated ? cartTotal : 0;

  const unitPrice = (line: (typeof visibleCartLines)[number]) =>
    line.product.priceNgn +
    (line.selectedVariantId
      ? (line.product.variants?.find((variant) => variant.id === line.selectedVariantId)?.extraPriceNgn ?? 0)
      : 0);

  const goToCheckout = () => {
    if (visibleCartLines.length === 0) return;
    if (getStoredToken()) {
      router.push("/checkout");
      return;
    }
    setMethodModalOpen(true);
  };

  return (
    <StorefrontShell>
      <CheckoutMethodModal open={methodModalOpen} onClose={() => setMethodModalOpen(false)} />
      <section className="checkout-grid">
        <SurfaceCard className="route-card">
          <p className="route-eyebrow" style={{ margin: 0 }}>Step 1 of 3</p>
          <h1 className="section-title" style={{ marginTop: 0 }}>Cart review</h1>
          {visibleCartLines.length === 0 ? <p style={{ color: "var(--ui-muted)" }}>Your cart is empty.</p> : null}
          {visibleCartLines.map((line) => (
            <article key={line.key} className="surface-card">
              <div className="line-item">
                <Image
                  src={line.product.images?.[0]?.imageUrl ?? "/sexxymarketlogo.png"}
                  alt={line.product.name}
                  width={72}
                  height={72}
                  className="line-item-thumb"
                  unoptimized
                />
                <div>
                  <Link href={`/product/${line.product.slug}`}>
                    <strong>{line.product.name}</strong>
                  </Link>
                  <div style={{ marginTop: 6 }}>
                    <ProductCodePill code={resolveProductCode(line.product, line.selectedVariantId)} />
                  </div>
                  <p style={{ margin: "0.2rem 0", color: "var(--ui-muted)" }}>
                    {line.selectedVariantId
                      ? line.product.variants?.find((variant) => variant.id === line.selectedVariantId)?.label
                      : "Default option"}
                  </p>
                  <p style={{ margin: "0.2rem 0", color: "var(--ui-muted)" }}>NGN {unitPrice(line).toLocaleString()}</p>
                </div>
                <QuantityStepper
                  value={line.quantity}
                  onDecrease={() => updateQuantity(line.key, line.quantity - 1)}
                  onIncrease={() => updateQuantity(line.key, line.quantity + 1)}
                />
                <div style={{ textAlign: "right" }}>
                  <strong>NGN {(unitPrice(line) * line.quantity).toLocaleString()}</strong>
                  <div>
                    <button type="button" className="chip" onClick={() => removeFromCart(line.key)}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <strong>Total</strong>
            <strong>NGN {visibleCartTotal.toLocaleString()}</strong>
          </div>
        </SurfaceCard>

        <SurfaceCard className="route-card">
          <p className="route-eyebrow" style={{ margin: 0 }}>Secure flow</p>
          <h2 className="section-title" style={{ marginTop: 2, fontSize: "1.26rem" }}>Premium checkout journey</h2>
          <p className="section-lead">
            Continue to secure checkout to enter delivery details and complete payment authorization. Guest checkout is
            available—no account required.
          </p>
          <p style={{ margin: "0 0 8px", fontSize: "0.86rem", color: "var(--ui-muted)", lineHeight: 1.5 }}>{DELIVERY_ESTIMATE_SHORT}</p>
          <div className="flow-step-list">
            <article className="flow-step">
              <span className="flow-step-bullet">1</span>
              <div>
                <strong style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><ShoppingBag size={14} /> Review cart</strong>
                <p style={{ margin: "3px 0 0", color: "var(--ui-muted)", fontSize: "0.88rem" }}>
                  Confirm product numbers, quantities, and totals.
                </p>
              </div>
            </article>
            <article className="flow-step">
              <span className="flow-step-bullet">2</span>
              <div>
                <strong style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><PackageCheck size={14} /> Delivery details</strong>
                <p style={{ margin: "3px 0 0", color: "var(--ui-muted)", fontSize: "0.88rem" }}>
                  Enter recipient and address information.
                </p>
              </div>
            </article>
            <article className="flow-step">
              <span className="flow-step-bullet">3</span>
              <div>
                <strong style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><CreditCard size={14} /> Payment authorization</strong>
                <p style={{ margin: "3px 0 0", color: "var(--ui-muted)", fontSize: "0.88rem" }}>
                  Receive a secure payment link and complete checkout.
                </p>
              </div>
            </article>
          </div>
          <div style={{ marginTop: 10 }}>
            <ActionButton type="button" disabled={visibleCartLines.length === 0} onClick={goToCheckout}>
              Continue to checkout
            </ActionButton>
          </div>
          <p style={{ margin: "8px 0 0", color: "var(--ui-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={14} /> Discreet packaging and secure merchant verification included.
          </p>
        </SurfaceCard>
      </section>
    </StorefrontShell>
  );
}
