/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton, SurfaceCard } from "@sexxymarket/ui";
import { getAdminToken, adminRequest, AdminRequestError } from "../../../lib/admin-api";
import { useAdminToast } from "../../../components/admin-toast-context";
import { AdminDialog, AdminDialogActions } from "../../../components/admin-dialog";
import { StatusPill } from "../../../components/status-pill";
import { EmptyState } from "../../../components/empty-state";
import { TablePagination } from "../../../components/table-pagination";
import type { AdminListing, Category } from "../../../lib/admin-api-types";
import { ProductTableToolbar } from "../../../components/products/product-table-toolbar";
import { TableSkeleton } from "../../../components/loading-primitives";

const PAGE_SIZE = 12;
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function normalizeMediaUrl(url?: string | null) {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      const isLocalhostHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
      if (isLocalhostHost && parsed.pathname.startsWith("/uploads/")) {
        return `${apiBase}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      return trimmed;
    }
    return trimmed;
  }
  return `${apiBase}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

export default function AdminProductsPage() {
  const router = useRouter();
  const { push } = useAdminToast();
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [removeTarget, setRemoveTarget] = useState<AdminListing | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [stockTarget, setStockTarget] = useState<AdminListing | null>(null);
  const [stockValue, setStockValue] = useState("0");
  const [removingListing, setRemovingListing] = useState(false);
  const [savingStock, setSavingStock] = useState(false);

  const analytics = useMemo(() => {
    const low = listings.filter((item) => item.stock > 0 && item.stock <= 5).length;
    const out = listings.filter((item) => item.stock <= 0).length;
    return { low, out };
  }, [listings]);

  const load = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (query.trim()) params.set("q", query.trim());
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (stockFilter) params.set("stockState", stockFilter);
      const [listPayload, cRes] = await Promise.all([
        adminRequest<{ items: AdminListing[]; total: number }>(token, `/api/admin/listings?${params.toString()}`),
        fetch(`${apiBase}/api/catalog/categories`),
      ]);
      setListings(Array.isArray(listPayload.items) ? listPayload.items : []);
      setTotal(listPayload.total ?? 0);
      if (cRes.ok) setCategories((await cRes.json()) as Category[]);
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Failed to load catalog." });
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, page, push, query, statusFilter, stockFilter]);

  useEffect(() => {
    const frame = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(frame);
  }, [load]);

  const moderate = async (listing: AdminListing, updates: Record<string, unknown>) => {
    const token = getAdminToken();
    try {
      await adminRequest(token, `/api/admin/listings/${listing.id}`, { method: "PATCH", body: JSON.stringify(updates) });
      push({ kind: "success", message: "Product updated." });
      void load();
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Update failed." });
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const token = getAdminToken();
    try {
      setRemovingListing(true);
      await adminRequest(token, `/api/admin/listings/${removeTarget.id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason: removeReason.trim() || undefined }),
      });
      push({ kind: "success", message: "Listing removed." });
      setRemoveTarget(null);
      setRemoveReason("");
      void load();
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Remove failed." });
    } finally {
      setRemovingListing(false);
    }
  };

  const confirmStock = async () => {
    if (!stockTarget) return;
    const n = Number(stockValue);
    if (Number.isNaN(n) || n < 0) {
      push({ kind: "error", message: "Enter a valid non-negative number." });
      return;
    }
    try {
      setSavingStock(true);
      await moderate(stockTarget, { stock: n });
      setStockTarget(null);
    } finally {
      setSavingStock(false);
    }
  };

  return (
    <div className="panel-stack" style={{ paddingTop: "0.35rem" }}>
      <SurfaceCard style={{ padding: "1rem" }} aria-busy={loading} className="loading-region">
        <div className="actions-row" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="route-eyebrow">Product studio</p>
            <h1 className="section-title" style={{ fontSize: "1.3rem" }}>
              Product management
            </h1>
            <p className="section-lead" style={{ fontSize: "0.9rem", marginBottom: 0 }}>
              All product authoring now happens in the dedicated guided flow for consistency and quality.
            </p>
          </div>
          <div className="actions-row">
            <ActionButton onClick={() => router.push("/products/new")}>
              Add product
            </ActionButton>
          </div>
        </div>
        <div className="kpi-grid" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="kpi-tile"
            onClick={() => { setPage(0); setStockFilter(""); setStatusFilter(""); setCategoryFilter(""); setQuery(""); }}
            style={{ textAlign: "left", background: "var(--ui-raised)", border: "1px solid var(--ui-border)", borderRadius: 12, padding: "0.7rem", cursor: "pointer" }}
          >
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Current page products</p>
            <strong>{listings.length}</strong>
          </button>
          <button
            type="button"
            className="kpi-tile"
            onClick={() => { setPage(0); setStockFilter("LOW"); setQuery(""); }}
            style={{ textAlign: "left", background: "var(--ui-raised)", border: "1px solid var(--ui-border)", borderRadius: 12, padding: "0.7rem", cursor: "pointer" }}
          >
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Low stock</p>
            <strong>{analytics.low}</strong>
          </button>
          <button
            type="button"
            className="kpi-tile"
            onClick={() => { setPage(0); setStockFilter("OUT"); setQuery(""); }}
            style={{ textAlign: "left", background: "var(--ui-raised)", border: "1px solid var(--ui-border)", borderRadius: 12, padding: "0.7rem", cursor: "pointer" }}
          >
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Out of stock</p>
            <strong>{analytics.out}</strong>
          </button>
        </div>
        <p className="muted" style={{ marginTop: 10, marginBottom: 0, fontSize: "0.84rem" }}>
          Create and edit actions are routed to `/products/new` and `/products/[id]/edit`.
        </p>
      </SurfaceCard>

      <SurfaceCard style={{ padding: "1rem" }}>
        <h2 className="section-title" style={{ fontSize: "1.2rem" }}>
          Listings & visibility
        </h2>
        <ProductTableToolbar
          query={query}
          categoryId={categoryFilter}
          status={statusFilter}
          stockState={stockFilter}
          categories={categories}
          onChange={(next) => {
            if (next.query !== undefined) setQuery(next.query);
            if (next.categoryId !== undefined) setCategoryFilter(next.categoryId);
            if (next.status !== undefined) setStatusFilter(next.status);
            if (next.stockState !== undefined) setStockFilter(next.stockState);
            setPage(0);
          }}
        />
        {loading ? <TableSkeleton rows={5} /> : null}
        {!loading && listings.length === 0 ? (
          <EmptyState title="No products" description="Try changing filters or add your first product above." />
        ) : !loading ? (
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Preview</th>
                  <th>Code</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((listing) => {
                  const u = normalizeMediaUrl(listing.images?.[0]?.imageUrl);
                  return (
                    <tr key={listing.id}>
                      <td style={{ width: 72 }}>
                        {u ? (
                          <div style={{ position: "relative", width: 56, height: 56, borderRadius: 8, overflow: "hidden" }}>
                            <img src={u} alt="" width={56} height={56} style={{ objectFit: "cover" }} />
                          </div>
                        ) : (
                          <div className="muted" style={{ fontSize: "0.7rem" }}>No image</div>
                        )}
                      </td>
                      <td><code>{listing.productCode}</code></td>
                      <td>
                        <strong>{listing.name}</strong>
                        <div className="muted" style={{ fontSize: "0.82rem" }}>{listing.merchant?.businessName ?? "Marketplace"}</div>
                      </td>
                      <td>{listing.category?.name ?? "—"}</td>
                      <td>{listing.stock}</td>
                      <td>{listing.isHidden ? <StatusPill value="HIDDEN" /> : <StatusPill value={listing.approvalStatus} />}</td>
                      <td>
                        <div className="actions-row" style={{ flexWrap: "wrap" }}>
                          <button type="button" className="chip" onClick={() => router.push(`/products/${listing.id}/edit`)}>Edit</button>
                          <button type="button" className="chip" onClick={() => moderate(listing, { isHidden: !listing.isHidden })}>
                            {listing.isHidden ? "Unhide" : "Hide"}
                          </button>
                          <button
                            type="button"
                            className="chip"
                            onClick={() => {
                              setStockTarget(listing);
                              setStockValue(String(listing.stock));
                            }}
                          >
                            Stock
                          </button>
                          <button
                            type="button"
                            className="chip"
                            onClick={() => {
                              setRemoveTarget(listing);
                              setRemoveReason("");
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
              loading={loading}
            />
          </div>
        ) : null}
      </SurfaceCard>

      <AdminDialog
        open={!!removeTarget}
        title="Remove listing"
        onClose={() => { setRemoveTarget(null); setRemoveReason(""); }}
        footer={
          <AdminDialogActions
            onCancel={() => { setRemoveTarget(null); setRemoveReason(""); }}
            onConfirm={() => void confirmRemove()}
            confirmLabel="Remove from catalog"
            confirmLoading={removingListing}
          />
        }
      >
        {removeTarget ? (
          <div className="field">
            <p>Remove <strong>{removeTarget.name}</strong> from moderation?</p>
            <label htmlFor="r-reason">Reason (optional, for audit)</label>
            <textarea id="r-reason" className="text-input" rows={3} value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} />
          </div>
        ) : null}
      </AdminDialog>

      <AdminDialog
        open={!!stockTarget}
        title="Set stock"
        onClose={() => setStockTarget(null)}
        footer={<AdminDialogActions onCancel={() => setStockTarget(null)} onConfirm={() => void confirmStock()} confirmLoading={savingStock} />}
      >
        {stockTarget ? (
          <div className="field">
            <label>Quantity in stock for {stockTarget.name}</label>
            <input className="text-input" value={stockValue} onChange={(e) => setStockValue(e.target.value)} type="number" min={0} />
          </div>
        ) : null}
      </AdminDialog>
    </div>
  );
}
