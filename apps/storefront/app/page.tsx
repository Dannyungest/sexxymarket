"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ActionButton, MetricTile, SurfaceCard } from "@sexxymarket/ui";
import { ArrowRight, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star } from "lucide-react";
import { ProductCard } from "../components/product-card";
import { StorefrontShell } from "../components/storefront-shell";
import { getCategories, getProducts } from "../lib/storefront-api";
import { DELIVERY_META_HOME } from "../lib/delivery-copy";
import { normalizeCategories } from "../lib/category-utils";
import type { Category, Product } from "../lib/storefront-types";

export default function HomePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [apiWarning, setApiWarning] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    getProducts()
      .then((result) => {
        setProducts(result);
        if (result.length === 0) {
          setApiWarning("Products are temporarily unavailable. Please try again shortly.");
        } else {
          setApiWarning(null);
        }
      })
      .catch(() => {
        setApiWarning("We could not connect to the catalog service. Please refresh shortly.");
      });
    getCategories().then((result) => {
      setCategories(normalizeCategories(result));
    });
  }, []);

  const visibleProducts = useMemo(() => {
    return products.filter((product) => {
      const categoryPass = selectedCategory === "all" || product.category?.slug === selectedCategory;
      const queryPass =
        query.length === 0 ||
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.description.toLowerCase().includes(query.toLowerCase());
      return categoryPass && queryPass;
    });
  }, [products, query, selectedCategory]);

  return (
    <StorefrontShell>
      <section className="route-grid">
        <section className="hero-grid">
          <SurfaceCard className="hero-card">
            <p className="hero-kicker">Premium intimate wellness marketplace</p>
            <h1 className="section-title hero-title">
              Fantastic pleasure, trusted quality, discreet delivery.
            </h1>
            <p className="section-lead hero-lead">
              Rediscover confidence, connection, and elevated satisfaction with expertly curated intimate essentials.
              Enjoy verified merchants, clear product details, secure payments, and discreet nationwide shipping.
              Your privacy and comfort stay protected at every step.
            </p>
            <div className="hero-actions">
              <ActionButton type="button" onClick={() => router.push("/products")}>
                Explore catalog
              </ActionButton>
              <ActionButton type="button" ghost onClick={() => router.push("/cart")}>
                Review cart <ArrowRight size={14} />
              </ActionButton>
            </div>
            <p className="hero-trust">
              <Star size={14} /> Trusted by verified buyers who value pleasure, privacy, and premium standards.
            </p>
          </SurfaceCard>
          <SurfaceCard className="why-card">
            <p className="route-eyebrow" style={{ margin: 0 }}>Confidence and discretion</p>
            <h2 className="section-title why-title">Why customers choose Sexxy Market</h2>
            <ul className="why-list">
              <li>Curated premium selections for personal and shared pleasure</li>
              <li>Verified merchants with strict listing quality checks</li>
              <li>Secure checkout and trusted payment experience</li>
              <li>Private, discreet delivery with verified-buyer reviews</li>
            </ul>
            <div className="why-links">
              <Link href="/legal/terms">Terms</Link>
              <Link href="/legal/privacy">Privacy</Link>
              <Link href="/legal/refund">Refunds</Link>
              <Link href="/legal/age-policy">18+ policy</Link>
            </div>
          </SurfaceCard>
        </section>

        <section className="stats-grid">
          <MetricTile label="Verified merchants" value="Growing daily" meta="Newly launched with strict merchant vetting" />
          <MetricTile label="Delivery target" value={"< 7 days"} meta={DELIVERY_META_HOME} />
          <MetricTile label="Customer rating" value="4.8 / 5" meta="Real buyer-verified feedback" />
          <MetricTile label="Nationwide coverage" value="36 states" meta="Private delivery, every region" />
        </section>

        <SurfaceCard className="discover-shell">
          <div className="discover-header">
            <div>
              <p className="route-eyebrow" style={{ margin: 0 }}>Discover</p>
              <h2 className="section-title discover-title">Featured categories</h2>
              <p className="section-lead discover-lead">
                Explore by intent with a premium search experience and curated category navigation.
              </p>
            </div>
            <Link href="/products" className="subtle-link icon-inline">
              <SlidersHorizontal size={14} />
              View full catalog
            </Link>
          </div>
          <div className="discover-search discover-search-standalone">
            <Search />
            <input
              className="text-input"
              placeholder="Search by product name, category, code, or experience..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="discover-categories-row">
            <p className="discover-categories-label">Browse premium categories</p>
            <div className="discover-categories">
              {categories.map((category) => (
                <button
                  key={category.slug}
                  type="button"
                  className="chip discover-chip"
                  aria-pressed={selectedCategory === category.slug}
                  onClick={() => setSelectedCategory(category.slug)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
          <div className="discover-meta">
            <span className="pill">Showing {visibleProducts.length} curated matches</span>
            {selectedCategory !== "all" || query ? (
              <button
                type="button"
                className="chip discover-chip"
                onClick={() => {
                  setSelectedCategory("all");
                  setQuery("");
                }}
              >
                Reset discover
              </button>
            ) : null}
          </div>
        </SurfaceCard>

        <section>
          {apiWarning ? (
            <div className="checkout-alert checkout-alert--error" role="alert" style={{ marginBottom: 12 }}>
              {apiWarning}
            </div>
          ) : null}
          <div className="home-section-head">
            <div>
              <p className="route-eyebrow" style={{ margin: 0 }}>Editor selection</p>
              <h2 className="section-title home-section-title">Featured products</h2>
            </div>
            <small className="home-section-meta">
              <Sparkles size={14} /> {visibleProducts.length} items
            </small>
          </div>
          <div className="product-grid">
            {visibleProducts.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="home-trust-row">
            <p className="home-section-meta" style={{ margin: 0, gap: 6 }}>
              <ShieldCheck size={14} /> Every listing passes merchant verification, quality checks, and moderation.
            </p>
            <Link href="/products" className="subtle-link">
              Browse all products
            </Link>
          </div>
        </section>
      </section>
    </StorefrontShell>
  );
}
