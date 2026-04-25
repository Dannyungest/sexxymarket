import Link from "next/link";
import { MetricTile } from "@sexxymarket/ui";
import type { CSSProperties, ReactNode } from "react";

const linkStyle: CSSProperties = {
  textDecoration: "none",
  color: "inherit",
  display: "block",
};

function KpiLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} style={linkStyle}>
      {children}
    </Link>
  );
}

type OverviewStats = {
  totalUsers: number;
  totalMerchants: number;
  totalProducts: number;
  totalOrders: number;
  ordersPendingPayment: number;
  ordersPendingDelivery: number;
  ordersDelivered: number;
  ordersCompleted: number;
};

export function AdminMetricGrid({
  totalOrders,
  totalRevenueNgn,
  pendingMerchants,
  flaggedUsers,
}: {
  totalOrders: number;
  totalRevenueNgn: number;
  pendingMerchants: number;
  flaggedUsers: number;
}) {
  return (
    <section className="kpi-grid">
      <KpiLink href="/orders">
        <MetricTile label="Orders (in range)" value={String(totalOrders)} meta="Matches selected period" />
      </KpiLink>
      <KpiLink href="/orders">
        <MetricTile label="Revenue (in range)" value={`NGN ${totalRevenueNgn.toLocaleString()}`} meta="Gross in selected period" />
      </KpiLink>
      <KpiLink href="/merchants">
        <MetricTile label="Pending merchants" value={String(pendingMerchants)} meta="Awaiting decisions" />
      </KpiLink>
      <KpiLink href="/users">
        <MetricTile label="Flagged customers" value={String(flaggedUsers)} meta="Blocked or blacklisted" />
      </KpiLink>
    </section>
  );
}

export function AdminOverviewStatsGrid({ stats }: { stats: OverviewStats | null }) {
  if (!stats) return null;
  return (
    <section className="kpi-grid" style={{ marginTop: 4 }}>
      <KpiLink href="/users">
        <MetricTile label="Total customers" value={String(stats.totalUsers)} meta="Storefront user accounts" />
      </KpiLink>
      <KpiLink href="/merchants">
        <MetricTile label="Total merchants" value={String(stats.totalMerchants)} meta="All registered merchants" />
      </KpiLink>
      <KpiLink href="/products">
        <MetricTile label="Total products" value={String(stats.totalProducts)} meta="Listings in catalog" />
      </KpiLink>
      <KpiLink href="/orders">
        <MetricTile label="Total orders" value={String(stats.totalOrders)} meta="All time" />
      </KpiLink>
      <KpiLink href="/orders">
        <MetricTile label="Orders (paid+)" value={String(stats.ordersCompleted)} meta="Excludes checkout-pending" />
      </KpiLink>
      <KpiLink href="/orders">
        <MetricTile label="Delivered" value={String(stats.ordersDelivered)} meta="Fulfilled deliveries" />
      </KpiLink>
      <KpiLink href="/orders">
        <MetricTile
          label="Pending delivery"
          value={String(stats.ordersPendingDelivery)}
          meta="Paid, not yet delivered"
        />
      </KpiLink>
      <KpiLink href="/orders">
        <MetricTile
          label="Payment pending"
          value={String(stats.ordersPendingPayment)}
          meta="Awaiting customer payment"
        />
      </KpiLink>
    </section>
  );
}
