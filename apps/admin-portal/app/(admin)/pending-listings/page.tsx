"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ActionButton, SurfaceCard } from "@sexxymarket/ui";
import { getAdminToken, adminRequest, AdminRequestError } from "../../../lib/admin-api";
import { useAdminToast } from "../../../components/admin-toast-context";
import { TableSkeleton } from "../../../components/loading-primitives";

type PendingRow = {
  id: string;
  name: string;
  productCode: string;
  slug: string;
  createdAt: string;
  merchant?: { businessName: string; user?: { email: string } | null } | null;
};

export default function PendingListingsPage() {
  const { push } = useAdminToast();
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminRequest<PendingRow[]>(token, "/api/catalog/products/pending");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      push({
        kind: "error",
        message: e instanceof AdminRequestError ? e.message : "Could not load pending listings.",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (id: string, decision: "APPROVED" | "REJECTED") => {
    const token = getAdminToken();
    if (!token) return;
    try {
      await adminRequest(token, `/api/catalog/products/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
      });
      push({ kind: "success", message: decision === "APPROVED" ? "Listing approved." : "Listing rejected." });
      void load();
    } catch (e) {
      push({
        kind: "error",
        message: e instanceof AdminRequestError ? e.message : "Update failed.",
      });
    }
  };

  return (
    <div className="panel-stack" style={{ paddingTop: "0.35rem" }}>
      <SurfaceCard style={{ padding: "1rem" }}>
        <p className="route-eyebrow">Catalog</p>
        <h1 className="section-title" style={{ fontSize: "1.35rem", margin: "4px 0" }}>Pending product approvals</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          Standard-tier merchants need review before products appear on the storefront. Super-tier listings are auto-approved.
        </p>
      </SurfaceCard>

      <SurfaceCard style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "1rem" }}>
            <TableSkeleton rows={6} />
          </div>
        ) : rows.length === 0 ? (
          <p className="muted" style={{ padding: "1rem", margin: 0 }}>No products awaiting approval.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Merchant</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div>
                        <strong>{p.name}</strong>
                        <div className="muted" style={{ fontSize: "0.82rem" }}><code>{p.productCode}</code></div>
                      </div>
                    </td>
                    <td>
                      {p.merchant?.businessName ?? "—"}
                      {p.merchant?.user?.email ? (
                        <div className="muted" style={{ fontSize: "0.8rem" }}>{p.merchant.user.email}</div>
                      ) : null}
                    </td>
                    <td className="muted" style={{ fontSize: "0.86rem" }}>
                      {p.createdAt ? new Date(p.createdAt).toLocaleString() : "—"}
                    </td>
                    <td>
                      <div className="actions-row" style={{ flexWrap: "wrap" }}>
                        <Link className="chip" href={`/products/${p.id}/edit`} style={{ textDecoration: "none" }}>
                          Open in editor
                        </Link>
                        <ActionButton ghost onClick={() => void review(p.id, "APPROVED")}>
                          Approve
                        </ActionButton>
                        <ActionButton ghost onClick={() => void review(p.id, "REJECTED")}>
                          Reject
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
