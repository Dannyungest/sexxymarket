"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ActionButton, MetricTile, SurfaceCard } from "@sexxymarket/ui";
import { ArrowRight, Sparkles } from "lucide-react";
import { getAdminToken, adminRequest, AdminRequestError } from "../../../lib/admin-api";
import { useAdminToast } from "../../../components/admin-toast-context";
import { AdminMetricGrid, AdminOverviewStatsGrid } from "../../../components/admin-metric-grid";
import type { AdminCustomer, AdminListing, AdminMerchant, FullOrder } from "../../../lib/admin-api-types";
import { MetricGridSkeleton, TableSkeleton } from "../../../components/loading-primitives";

type Preset = "7" | "30" | "90" | "all";

function getDateRange(preset: Preset): { dateFrom?: string; dateTo?: string } {
  if (preset === "all") return {};
  const end = new Date();
  const start = new Date();
  const days = preset === "7" ? 7 : preset === "30" ? 30 : 90;
  start.setDate(start.getDate() - days);
  return { dateFrom: start.toISOString().slice(0, 10), dateTo: end.toISOString().slice(0, 10) };
}

type Analytics = {
  totalOrders: number;
  totalRevenueNgn: number;
  pendingOrders: number;
  deliveredOrders: number;
};

export default function AdminOverviewPage() {
  const { push } = useAdminToast();
  const [preset, setPreset] = useState<Preset>("30");
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<Analytics>({
    totalOrders: 0,
    totalRevenueNgn: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
  });
  const [recent, setRecent] = useState<FullOrder[]>([]);
  const [merchants, setMerchants] = useState<AdminMerchant[]>([]);
  const [users, setUsers] = useState<AdminCustomer[]>([]);
  const [catalogSize, setCatalogSize] = useState(0);
  const [adminCount, setAdminCount] = useState(0);
  const [overviewStats, setOverviewStats] = useState<{
    totalUsers: number;
    totalMerchants: number;
    totalProducts: number;
    totalOrders: number;
    ordersPendingPayment: number;
    ordersPendingDelivery: number;
    ordersDelivered: number;
    ordersCompleted: number;
  } | null>(null);

  const load = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    const { dateFrom, dateTo } = getDateRange(preset);
    const query = new URLSearchParams();
    query.set("status", "ALL");
    query.set("q", "");
    query.set("page", "0");
    query.set("pageSize", "8");
    if (dateFrom) query.set("dateFrom", dateFrom);
    if (dateTo) query.set("dateTo", dateTo);
    try {
      const [orderPayload, merchantPayload, userPayload, listingPayload, adminPayload, statPayload] = await Promise.all([
        adminRequest<{
          analytics: Analytics;
          orders: FullOrder[];
        }>(token, `/api/admin/orders?${query.toString()}`),
        adminRequest<AdminMerchant[]>(token, "/api/admin/merchants"),
        adminRequest<AdminCustomer[]>(token, "/api/admin/customers"),
        adminRequest<{ items: AdminListing[]; total: number }>(token, "/api/admin/listings?page=0&pageSize=1"),
        adminRequest<{ id: string; role: string }[]>(token, "/api/admin/users"),
        adminRequest<{
          totalUsers: number;
          totalMerchants: number;
          totalProducts: number;
          totalOrders: number;
          ordersPendingPayment: number;
          ordersPendingDelivery: number;
          ordersDelivered: number;
          ordersCompleted: number;
        }>(token, "/api/admin/stats"),
      ]);
      if (orderPayload.analytics) setAnalytics(orderPayload.analytics);
      setRecent(Array.isArray(orderPayload.orders) ? orderPayload.orders : []);
      setMerchants(Array.isArray(merchantPayload) ? merchantPayload : []);
      setUsers(Array.isArray(userPayload) ? userPayload : []);
      setCatalogSize(listingPayload.total ?? 0);
      setAdminCount(Array.isArray(adminPayload) ? adminPayload.length : 0);
      if (statPayload && typeof statPayload === "object") setOverviewStats(statPayload);
      else setOverviewStats(null);
    } catch (e) {
      setAnalytics({ totalOrders: 0, totalRevenueNgn: 0, pendingOrders: 0, deliveredOrders: 0 });
      setRecent([]);
      setOverviewStats(null);
      push({
        kind: "error",
        message: e instanceof AdminRequestError ? e.message : "Unable to load overview.",
      });
    } finally {
      setLoading(false);
    }
  }, [preset, push]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingMerchants = merchants.filter((m) => m.status === "PENDING").length;
  const flaggedUsers = users.filter((u) => u.isBlocked || u.isBlacklisted).length;
  const rangeLabel =
    preset === "all" ? "All time" : preset === "7" ? "Last 7 days" : preset === "30" ? "Last 30 days" : "Last 90 days";

  return (
    <div className="panel-stack" style={{ paddingTop: "0.35rem" }}>
      <SurfaceCard style={{ padding: "1rem" }} aria-busy={loading} className="loading-region">
        <p className="route-eyebrow">Executive overview</p>
        <h1 className="section-title" style={{ margin: "0.2rem 0" }}>
          Command center
        </h1>
        <p className="section-lead">
          Monitor order flow, revenue, and risk in one place. Select a period to focus KPIs; tables in each section use
          the same data contract.
        </p>
        <div className="actions-row" style={{ marginTop: 12, flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: "0.82rem", alignSelf: "center" }}>
            {rangeLabel} metrics
          </span>
          {(
            [
              { id: "7" as const, label: "7d" },
              { id: "30" as const, label: "30d" },
              { id: "90" as const, label: "90d" },
              { id: "all" as const, label: "All" },
            ] as const
          ).map((b) => (
            <button
              key={b.id}
              type="button"
              className="chip"
              aria-pressed={preset === b.id}
              onClick={() => setPreset(b.id)}
              disabled={loading}
            >
              {b.label}
            </button>
          ))}
          <Link href="/orders" className="subtle-link icon-inline" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            All orders
            <ArrowRight size={14} />
          </Link>
        </div>
      </SurfaceCard>

      {loading ? (
        <MetricGridSkeleton />
      ) : (
        <>
          <AdminMetricGrid
            totalOrders={analytics.totalOrders}
            totalRevenueNgn={analytics.totalRevenueNgn}
            pendingMerchants={pendingMerchants}
            flaggedUsers={flaggedUsers}
          />
          <AdminOverviewStatsGrid stats={overviewStats} />
        </>
      )}

      {!loading ? (
        <section className="kpi-grid">
          <Link href="/orders" className="subtle-link" style={{ textDecoration: "none", color: "inherit" }}>
            <MetricTile label="Pending fulfillment" value={String(analytics.pendingOrders)} meta="In the selected range" />
          </Link>
          <Link href="/orders" className="subtle-link" style={{ textDecoration: "none", color: "inherit" }}>
            <MetricTile label="Delivered (range)" value={String(analytics.deliveredOrders)} meta="Completed in period" />
          </Link>
          <Link href="/products" className="subtle-link" style={{ textDecoration: "none", color: "inherit" }}>
            <MetricTile label="Catalog listings" value={String(catalogSize)} meta="All managed products" />
          </Link>
          <Link href="/admins" className="subtle-link" style={{ textDecoration: "none", color: "inherit" }}>
            <MetricTile label="Admin team" value={String(adminCount)} meta="Active admin accounts" />
          </Link>
        </section>
      ) : null}

      <SurfaceCard style={{ padding: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div>
            <p className="route-eyebrow" style={{ margin: 0 }}>
              Recent
            </p>
            <h2 className="section-title" style={{ fontSize: "1.25rem", margin: 0 }}>
              Latest orders
            </h2>
            <p className="section-lead" style={{ fontSize: "0.9rem" }}>
              Newest in this period (up to eight)
            </p>
          </div>
          <Link href="/orders">
            <ActionButton type="button">Open orders</ActionButton>
          </Link>
        </div>
        {loading ? (
          <TableSkeleton rows={3} />
        ) : recent.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            No orders in this range. Try a wider period or add activity from the storefront.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "grid", gap: 8 }}>
            {recent.map((o) => (
              <li
                key={o.id}
                className="surface-card"
                style={{ padding: "0.75rem 0.9rem", border: "1px solid var(--ui-border)", borderRadius: 12 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong>
                    {o.recipientName}
                    <span className="muted" style={{ fontWeight: 500, marginLeft: 8, fontSize: "0.85rem" }}>
                      {o.id.slice(0, 8)}…
                    </span>
                  </strong>
                  <span>NGN {o.totalNgn.toLocaleString()}</span>
                </div>
                <div className="muted" style={{ fontSize: "0.82rem", marginTop: 4 }}>
                  {new Date(o.createdAt).toLocaleString()} · {o.status}
                </div>
              </li>
            ))}
          </ul>
        )}
        {!loading && recent.length > 0 ? (
          <p className="muted" style={{ marginTop: 12, fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={14} />
            All figures respect the date range and filters above.
          </p>
        ) : null}
      </SurfaceCard>
    </div>
  );
}
