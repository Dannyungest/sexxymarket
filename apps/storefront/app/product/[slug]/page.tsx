/* eslint-disable react-hooks/exhaustive-deps,react-hooks/refs,@next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ActionButton, ProductCodePill, QuantityStepper, StarRow, SurfaceCard } from "@sexxymarket/ui";
import { ArrowLeft, ChevronLeft, ChevronRight, ShieldCheck, Truck, X } from "lucide-react";
import { StorefrontShell } from "../../../components/storefront-shell";
import { useStorefront } from "../../../components/storefront-provider";
import {
  getEligibility,
  getProduct,
  getReviews,
  getReviewSummary,
  submitReview,
} from "../../../lib/storefront-api";
import type { Product, Review, ReviewEligibility, ReviewSummary } from "../../../lib/storefront-types";
import { DELIVERY_ESTIMATE_PRODUCT } from "../../../lib/delivery-copy";
import { resolveProductCode } from "../../../lib/product-code";
import { RichDescription, VariationGuideTable } from "../../../components/rich-description";

const ACCESS_TOKEN_KEY = "sm_access_token";
const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

function toAbsoluteMediaUrl(url?: string | null) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBase}${url.startsWith("/") ? url : `/${url}`}`;
}

function toDerivative(url: string, kind: "hero" | "thumb") {
  if (!url.endsWith(".webp")) return url;
  if (kind === "thumb") return url.replace(/\.webp$/i, "-thumb.webp");
  return url;
}

function buildFallbackOptions(product: Product) {
  if (!product.variants?.length) return [];
  return [
    {
      id: "fallback-option",
      name: "Option",
      displayType: "TEXT",
      guideText: "",
      values: product.variants.map((variant) => ({
        id: variant.id,
        value: variant.label,
        sortOrder: 0,
        imageUrl: null,
        storageKey: null,
        altText: null,
      })),
    },
  ];
}

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { addToCart } = useStorefront();
  const resolvedSlug = params.slug ?? "";
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>({ averageRating: 0, totalReviews: 0 });
  const [eligibility, setEligibility] = useState<ReviewEligibility>({ canReview: false });
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const pointerRef = useRef<{
    mode: "idle" | "swipe" | "pan";
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({
    mode: "idle",
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  useEffect(() => {
    if (!resolvedSlug) return;
    getProduct(resolvedSlug).then((result) => setProduct(result));
  }, [resolvedSlug]);

  useEffect(() => {
    if (!product) return;
    Promise.all([getReviews(product.id), getReviewSummary(product.id)])
      .then(([nextReviews, nextSummary]) => {
        setReviews(nextReviews);
        setSummary(nextSummary);
      })
      .catch(() => {
        setReviews([]);
        setSummary({ averageRating: 0, totalReviews: 0 });
      });

    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return;
    getEligibility(product.id, token).then(setEligibility).catch(() => setEligibility({ canReview: false }));
  }, [product]);

  const options = useMemo(() => {
    if (!product) return [];
    return product.options?.length ? product.options : buildFallbackOptions(product);
  }, [product]);

  useEffect(() => {
    if (!options.length || !product?.variants?.length) return;
    const initial: Record<string, string> = {};
    options.forEach((option) => {
      initial[option.id] = option.values[0]?.value ?? "";
    });
    setSelectedValues(initial);
  }, [options, product?.variants?.length]);

  const selectedVariant = useMemo(() => {
    if (!product?.variants?.length) return undefined;
    const variants = product.variants.filter((variant) => variant.isActive !== false);
    if (!options.length || Object.keys(selectedValues).length === 0) return variants[0];
    return variants.find((variant) =>
      options.every((option) => {
        const expected = selectedValues[option.id];
        if (!expected) return true;
        if (option.id === "fallback-option") {
          return variant.label === expected;
        }
        return variant.optionValues?.some(
          (entry) => entry.optionValue.option.id === option.id && entry.optionValue.value === expected,
        );
      }),
    );
  }, [options, product?.variants, selectedValues]);

  const displayPrice = (product?.priceNgn ?? 0) + (selectedVariant?.extraPriceNgn ?? 0);
  const availableStock = selectedVariant?.stock ?? product?.stock ?? 0;
  const hasConfigurableVariants = (product?.variants?.length ?? 0) > 0;
  const gallery = useMemo(() => {
    const base = product?.images?.length ? product.images : [{ imageUrl: "/sexxymarketlogo.PNG", altText: product?.name }];
    const optionValueImages =
      options.flatMap((option) =>
        option.values
          .filter((value) => value.imageUrl)
          .map((value) => ({
            imageUrl: value.imageUrl as string,
            altText: value.altText ?? `${option.name}: ${value.value}`,
          })),
      ) ?? [];
    const merged = [...base, ...optionValueImages].map((item) => ({
      ...item,
      imageUrl: toAbsoluteMediaUrl(item.imageUrl),
    }));
    const deduped: Array<{ imageUrl: string; altText?: string | null }> = [];
    const seen = new Set<string>();
    for (const item of merged) {
      if (!item.imageUrl || seen.has(item.imageUrl)) continue;
      seen.add(item.imageUrl);
      deduped.push(item);
    }
    return deduped;
  }, [options, product]);

  useEffect(() => {
    setActiveImage((prev) => (gallery.length === 0 ? 0 : Math.min(prev, gallery.length - 1)));
  }, [gallery.length]);

  useEffect(() => {
    setLightboxZoom(1);
    setLightboxPan({ x: 0, y: 0 });
  }, [activeImage, lightboxOpen]);

  const goToNextImage = () => {
    if (gallery.length <= 1) return;
    setActiveImage((prev) => (prev + 1) % gallery.length);
  };

  const goToPreviousImage = () => {
    if (gallery.length <= 1) return;
    setActiveImage((prev) => (prev - 1 + gallery.length) % gallery.length);
  };

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxOpen(false);
        return;
      }
      if (event.key === "ArrowRight") {
        goToNextImage();
      }
      if (event.key === "ArrowLeft") {
        goToPreviousImage();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gallery.length, lightboxOpen]);

  const submit = async () => {
    if (!product || !eligibility.canReview || !eligibility.orderId) return;
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) {
      setMessage("Please sign in to leave a review.");
      return;
    }
    try {
      setReviewSubmitting(true);
      await submitReview(
        {
          productId: product.id,
          orderId: eligibility.orderId,
          rating,
          comment,
        },
        token,
      );
      setComment("");
      setMessage("Review submitted successfully.");
      const [nextReviews, nextSummary] = await Promise.all([getReviews(product.id), getReviewSummary(product.id)]);
      setReviews(nextReviews);
      setSummary(nextSummary);
      setEligibility({ canReview: false });
    } catch {
      setMessage("Unable to submit review. Ensure your order is delivered.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (!product) {
    return (
      <StorefrontShell>
        <SurfaceCard style={{ padding: "1rem" }}>Loading product...</SurfaceCard>
      </StorefrontShell>
    );
  }

  return (
    <StorefrontShell>
      <div className="route-grid">
        <div style={{ display: "grid", gap: 8 }}>
          <div className="crumbs">
            <Link href="/">Home</Link>
            <ChevronRight size={12} />
            <Link href="/products">Products</Link>
            <ChevronRight size={12} />
            <span>{product.name}</span>
          </div>
          <div>
            <Link href="/products" className="subtle-link icon-inline">
              <ArrowLeft size={14} /> Back to products
            </Link>
          </div>
        </div>

        <SurfaceCard className="route-card">
          <div className="product-detail-grid">
            <div className="panel-stack" style={{ gap: 10 }}>
              <img
                src={toDerivative(gallery[activeImage]?.imageUrl ?? "/sexxymarketlogo.PNG", "hero")}
                onError={(event) => {
                  const target = event.currentTarget;
                  if (target.src.endsWith("/sexxymarketlogo.PNG")) target.src = "/sexxymarketlogo.png";
                }}
                alt={product.name}
                style={{ width: "100%", borderRadius: 14, minHeight: 320, objectFit: "cover" }}
                onClick={() => setLightboxOpen(true)}
              />
              <div className="actions-row" style={{ overflowX: "auto", paddingBottom: 4 }}>
                {gallery.map((image, index) => (
                  <button
                    key={`${image.imageUrl}-${index}`}
                    type="button"
                    className="chip"
                    aria-pressed={activeImage === index}
                    onClick={() => setActiveImage(index)}
                    style={{ padding: 0, borderRadius: 10, overflow: "hidden" }}
                  >
                    <img src={toDerivative(image.imageUrl, "thumb")} alt="" width={72} height={72} style={{ objectFit: "cover" }} />
                  </button>
                ))}
              </div>
            </div>

            <div className="content-stack">
              <p className="route-eyebrow" style={{ margin: 0 }}>
                Product detail
              </p>
              <small style={{ color: "var(--ui-muted)" }}>{product.category?.name ?? "General"}</small>
              <h1 className="section-title" style={{ margin: 0, fontSize: "clamp(1.5rem, 2.4vw, 2.1rem)" }}>
                {product.name}
              </h1>
              <ProductCodePill code={resolveProductCode(product, selectedVariant?.id)} />
              <RichDescription doc={product.descriptionRich} fallback={product.description} />
              <StarRow rating={summary.averageRating} count={summary.totalReviews} />
              <strong style={{ fontSize: "1.4rem" }}>NGN {displayPrice.toLocaleString()}</strong>

              {options.length > 0 ? (
                <div className="panel-stack" style={{ gap: 10 }}>
                  {options.map((option) => (
                    <div key={option.id} className="field">
                      <label>{option.name}</label>
                      <div className="actions-row">
                        {option.values.map((value) => {
                          const variantValueEnabled = !hasConfigurableVariants
                            ? true
                            : (product?.variants ?? [])
                                .filter((variant) => variant.isActive !== false)
                                .some((variant) =>
                                  options.every((candidateOption) => {
                                    const expected =
                                      candidateOption.id === option.id
                                        ? value.value
                                        : selectedValues[candidateOption.id];
                                    if (!expected) return true;
                                    if (candidateOption.id === "fallback-option") {
                                      return variant.label === expected;
                                    }
                                    return variant.optionValues?.some(
                                      (entry) =>
                                        entry.optionValue.option.id === candidateOption.id &&
                                        entry.optionValue.value === expected,
                                    );
                                  }),
                                );
                          return (
                          <button
                            key={value.id}
                            type="button"
                            className="chip"
                            aria-pressed={selectedValues[option.id] === value.value}
                            disabled={!variantValueEnabled}
                            onClick={() => {
                              setSelectedValues((prev) => ({ ...prev, [option.id]: value.value }));
                              if (value.imageUrl) {
                                const imageIndex = gallery.findIndex(
                                  (item) => item.imageUrl === toAbsoluteMediaUrl(value.imageUrl),
                                );
                                if (imageIndex >= 0) setActiveImage(imageIndex);
                              }
                            }}
                          >
                            {value.imageUrl ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <img
                                  src={toAbsoluteMediaUrl(value.imageUrl)}
                                  alt={value.altText ?? `${option.name} ${value.value}`}
                                  width={28}
                                  height={28}
                                  style={{ borderRadius: 6, objectFit: "cover" }}
                                />
                                {value.value}
                              </span>
                            ) : (
                              value.value
                            )}
                          </button>
                        )})}
                      </div>
                      {option.guideText ? (
                        <p style={{ margin: 0, color: "var(--ui-muted)", fontSize: "0.84rem" }}>{option.guideText}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {product.variationGuide || product.variationGuideTable ? (
                <SurfaceCard style={{ padding: "0.75rem", background: "var(--ui-card-soft)" }}>
                  <VariationGuideTable table={product.variationGuideTable} />
                  {product.variationGuide ? (
                    <p style={{ margin: "0.35rem 0 0", color: "var(--ui-muted)", whiteSpace: "pre-wrap" }}>
                      {product.variationGuide}
                    </p>
                  ) : null}
                </SurfaceCard>
              ) : null}

              <div className="route-actions">
                <span className="pill">In stock: {availableStock}</span>
                <span className="pill">
                  <Truck size={13} /> Discreet delivery nationwide
                </span>
                <span className="pill">
                  <ShieldCheck size={13} /> Secure checkout
                </span>
              </div>
              <div className="route-actions">
                <QuantityStepper
                  value={quantity}
                  onDecrease={() => setQuantity((value) => Math.max(1, value - 1))}
                  onIncrease={() => setQuantity((value) => Math.min(availableStock || 100, value + 1))}
                />
                <ActionButton
                  isLoading={addingToCart}
                  loadingText="Adding..."
                  onClick={() => {
                    setAddingToCart(true);
                    addToCart(product, quantity, selectedVariant?.id);
                    window.setTimeout(() => setAddingToCart(false), 350);
                  }}
                  disabled={availableStock < 1 || (hasConfigurableVariants && !selectedVariant)}
                >
                  {availableStock < 1
                    ? "Out of stock"
                    : hasConfigurableVariants && !selectedVariant
                      ? "Select valid option"
                      : "Add to cart"}
                </ActionButton>
                <ActionButton type="button" ghost onClick={() => router.push("/cart")}>
                  View cart
                </ActionButton>
              </div>
              <p style={{ margin: 0, color: "var(--ui-muted)", fontSize: "0.86rem" }}>
                {DELIVERY_ESTIMATE_PRODUCT}
              </p>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="route-card">
          <p className="route-eyebrow" style={{ margin: 0 }}>
            Community feedback
          </p>
          <h2 className="section-title" style={{ marginTop: 2, fontSize: "1.25rem" }}>
            Ratings & Reviews
          </h2>
          {eligibility.canReview ? (
            <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              <label style={{ color: "var(--ui-muted)", fontWeight: 600 }} htmlFor="review-rating">
                Your rating
              </label>
              <select id="review-rating" className="text-input" value={rating} onChange={(event) => setRating(Number(event.target.value))}>
                <option value={5}>5 stars</option>
                <option value={4}>4 stars</option>
                <option value={3}>3 stars</option>
                <option value={2}>2 stars</option>
                <option value={1}>1 star</option>
              </select>
              <textarea
                id="review-comment"
                className="text-input"
                placeholder="Share your experience..."
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                style={{ minHeight: 90 }}
              />
              <div>
                <ActionButton isLoading={reviewSubmitting} loadingText="Submitting..." onClick={submit}>
                  Submit review
                </ActionButton>
              </div>
            </div>
          ) : (
            <p style={{ color: "var(--ui-muted)" }}>
              Reviews are visible to everyone. Verified purchasers with delivered orders can rate and review this product.
            </p>
          )}
          {message ? <p style={{ color: "var(--ui-success)" }}>{message}</p> : null}

          <div style={{ display: "grid", gap: 8 }}>
            {reviews.length === 0 ? <p style={{ color: "var(--ui-muted)" }}>No reviews yet.</p> : null}
            {reviews.map((review) => (
              <article key={review.id} className="surface-card" style={{ padding: "0.75rem" }}>
                <strong>{"★".repeat(review.rating)}</strong>
                <p style={{ margin: "0.35rem 0" }}>{review.comment}</p>
                <small style={{ color: "var(--ui-muted)" }}>
                  {review.user?.firstName} {review.user?.lastName}
                </small>
              </article>
            ))}
          </div>
        </SurfaceCard>
      </div>
      {lightboxOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Product image viewer"
          onClick={() => setLightboxOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.86)",
            display: "grid",
            placeItems: "center",
            zIndex: 120,
            padding: "1rem",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(95vw, 980px)", display: "grid", gap: 10 }}
          >
            <div className="actions-row" style={{ justifyContent: "space-between" }}>
              <button type="button" className="chip" onClick={() => setLightboxOpen(false)}>
                <X size={14} /> Exit
              </button>
              <p className="muted" style={{ margin: 0 }}>
                Image {activeImage + 1} of {gallery.length}
              </p>
            </div>
            <div style={{ position: "relative", background: "#111", borderRadius: 14, overflow: "hidden" }}>
              <div
                onWheel={(event) => {
                  event.preventDefault();
                  setLightboxZoom((current) => {
                    const next = current + (event.deltaY > 0 ? -0.2 : 0.2);
                    return Math.max(1, Math.min(4, Number(next.toFixed(2))));
                  });
                }}
                onDoubleClick={() =>
                  setLightboxZoom((current) => (current > 1 ? 1 : 2))
                }
                onPointerDown={(event) => {
                  pointerRef.current = {
                    mode: lightboxZoom > 1 ? "pan" : "swipe",
                    startX: event.clientX,
                    startY: event.clientY,
                    originX: lightboxPan.x,
                    originY: lightboxPan.y,
                  };
                }}
                onPointerMove={(event) => {
                  const state = pointerRef.current;
                  if (state.mode === "pan" && lightboxZoom > 1) {
                    const dx = event.clientX - state.startX;
                    const dy = event.clientY - state.startY;
                    setLightboxPan({
                      x: state.originX + dx,
                      y: state.originY + dy,
                    });
                  }
                }}
                onPointerUp={(event) => {
                  const state = pointerRef.current;
                  if (state.mode === "swipe" && lightboxZoom === 1) {
                    const dx = event.clientX - state.startX;
                    const dy = event.clientY - state.startY;
                    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) {
                      if (dx < 0) goToNextImage();
                      else goToPreviousImage();
                    }
                  }
                  pointerRef.current.mode = "idle";
                }}
                onPointerCancel={() => {
                  pointerRef.current.mode = "idle";
                }}
                style={{
                  width: "100%",
                  maxHeight: "78vh",
                  overflow: "hidden",
                  touchAction: "none",
                  cursor: lightboxZoom > 1 ? "grab" : "zoom-in",
                }}
              >
                <img
                  src={gallery[activeImage]?.imageUrl}
                  alt={gallery[activeImage]?.altText ?? product.name}
                  style={{
                    width: "100%",
                    maxHeight: "78vh",
                    objectFit: "contain",
                    display: "block",
                    transform: `translate(${lightboxPan.x}px, ${lightboxPan.y}px) scale(${lightboxZoom})`,
                    transformOrigin: "center center",
                    transition: pointerRef.current.mode === "idle" ? "transform 160ms ease" : "none",
                  }}
                />
              </div>
              <div className="actions-row" style={{ position: "absolute", right: 12, top: 12 }}>
                <button type="button" className="chip" onClick={() => setLightboxZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}>
                  -
                </button>
                <button type="button" className="chip" onClick={() => setLightboxZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))))}>
                  +
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    setLightboxZoom(1);
                    setLightboxPan({ x: 0, y: 0 });
                  }}
                >
                  Reset
                </button>
              </div>
              <button
                type="button"
                className="chip"
                onClick={goToPreviousImage}
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="chip"
                onClick={goToNextImage}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </StorefrontShell>
  );
}
