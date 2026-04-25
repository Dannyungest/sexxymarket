"use client";

import { useEffect, useMemo, useState } from "react";
import { SurfaceCard } from "@sexxymarket/ui";
import { ListFilter } from "lucide-react";
import { ProductCard } from "../../components/product-card";
import { StorefrontShell } from "../../components/storefront-shell";
import { getCategories, getProducts } from "../../lib/storefront-api";
import { normalizeCategories } from "../../lib/category-utils";
import type { Category, Product } from "../../lib/storefront-types";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("popular");

  useEffect(() => {
    getProducts().then(setProducts);
    getCategories().then((result) => setCategories(normalizeCategories(result)));
  }, []);

  const filteredProducts = useMemo(() => {
    const base = products.filter((product) => {
      const categoryPass = selectedCategory === "all" || product.category?.slug === selectedCategory;
      const queryPass =
        query.length === 0 ||
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.description.toLowerCase().includes(query.toLowerCase());
      return categoryPass && queryPass;
    });
    if (sort === "price-asc") return [...base].sort((a, b) => a.priceNgn - b.priceNgn);
    if (sort === "price-desc") return [...base].sort((a, b) => b.priceNgn - a.priceNgn);
    return base;
  }, [products, query, selectedCategory, sort]);

  return (
    <StorefrontShell>
      <SurfaceCard className="route-card">
        <div className="route-head">
          <p className="route-eyebrow" style={{ margin: 0 }}>Curated catalog</p>
          <h1 className="section-title">Products</h1>
          <p className="section-lead">
            Refined catalog browsing with clearer filters, premium product details, and buyer-focused discovery.
          </p>
        </div>
        <div className="form-grid" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="catalog-search">Search</label>
            <input
              id="catalog-search"
              className="text-input"
              placeholder="Search by product, code or description..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="catalog-category">Category</label>
            <select id="catalog-category" className="text-input" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="catalog-sort">Sort</label>
            <select id="catalog-sort" className="text-input" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="popular">Most recent</option>
              <option value="price-asc">Price: Low to high</option>
              <option value="price-desc">Price: High to low</option>
            </select>
          </div>
        </div>
        <div className="route-actions" style={{ marginTop: 10 }}>
          {selectedCategory !== "all" ? <span className="pill">Category: {categories.find((c) => c.slug === selectedCategory)?.name}</span> : null}
          {query ? <span className="pill">Search: {query}</span> : null}
          <span className="pill">Results: {filteredProducts.length}</span>
          {selectedCategory !== "all" || query ? (
            <button
              type="button"
              className="chip"
              onClick={() => {
                setSelectedCategory("all");
                setQuery("");
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </SurfaceCard>

      <section className="product-grid" style={{ marginTop: 12 }}>
        {filteredProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </section>
      <p className="route-meta" style={{ marginTop: 8 }}>
        <ListFilter size={14} /> Use search, category, and sort to narrow your perfect pick.
      </p>
    </StorefrontShell>
  );
}
