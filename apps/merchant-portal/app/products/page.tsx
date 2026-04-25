"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ActionButton, SurfaceCard } from "@sexxymarket/ui";
import { MerchantVerificationGateModal } from "../../components/merchant-verification-gate-modal";
import { getMerchantToken } from "../../lib/merchant-auth";
import { merchantVerificationGateFromProfile } from "../../lib/merchant-verification-gate";

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

type Row = {
  id: string;
  name: string;
  productCode: string;
  approvalStatus: string;
  authoringStatus?: string;
  slug: string;
};

export default function MerchantProductsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<"PENDING" | "APPROVED" | "REJECTED" | "NONE">("NONE");
  const [hasSubmittedVerification, setHasSubmittedVerification] = useState(false);
  const [showVerifyPrompt, setShowVerifyPrompt] = useState(false);

  const load = useCallback(() => {
    const t = getMerchantToken();
    if (!t) return;
    void fetch(`${apiBase}/api/catalog/products/merchant/mine`, { headers: { Authorization: `Bearer ${t}` } })
      .then(async (r) => {
        if (!r.ok) {
          setErr("Could not load products.");
          return;
        }
        setRows((await r.json()) as Row[]);
        setErr("");
      })
      .catch(() => setErr("Could not load products."));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = getMerchantToken();
    if (!t) return;
    void fetch(`${apiBase}/api/merchant/profile`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then(async (r) => {
        if (r.status === 404) {
          setVerificationStatus("NONE");
          setHasSubmittedVerification(false);
          return;
        }
        if (!r.ok) return;
        const profile = (await r.json()) as {
          verificationStatus?: "PENDING" | "APPROVED" | "REJECTED";
          verifications?: unknown[];
        };
        setVerificationStatus(profile.verificationStatus ?? "NONE");
        setHasSubmittedVerification(Array.isArray(profile.verifications) && profile.verifications.length > 0);
      })
      .catch(() => undefined);
  }, []);

  const isLocked = verificationStatus !== "APPROVED";
  const profileForGate =
    verificationStatus === "NONE"
      ? null
      : { verificationStatus, verifications: hasSubmittedVerification ? [{}] : [] };
  const gateKind = merchantVerificationGateFromProfile(profileForGate);
  const promptKind = gateKind === "awaiting_approval" ? "awaiting_approval" : "needs_verification";

  return (
    <div className="panel-stack" style={{ maxWidth: 900, margin: "0 auto", padding: "1rem" }}>
      <div className="actions-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <h1 className="section-title" style={{ fontSize: "1.25rem", margin: 0 }}>
          Your products
        </h1>
        <Link
          href="/products/new"
          style={{ textDecoration: "none" }}
          onClick={(event) => {
            if (!isLocked) return;
            event.preventDefault();
            setShowVerifyPrompt(true);
          }}
        >
          <ActionButton>Add product</ActionButton>
        </Link>
      </div>
      {err ? <p className="muted">{err}</p> : null}
      <SurfaceCard style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 && !err ? (
          <p className="muted" style={{ padding: "1rem" }}>
            No products yet. Create your first listing.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Approval</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <code>{p.productCode}</code>
                    </td>
                    <td>{p.name}</td>
                    <td>
                      <span className="chip" style={{ fontSize: "0.75rem" }}>{p.approvalStatus}</span>
                    </td>
                    <td>
                      <span className="chip" style={{ fontSize: "0.75rem" }}>{p.authoringStatus ?? "—"}</span>
                    </td>
                    <td>
                      <Link
                        className="subtle-link"
                        href={`/products/${p.id}/edit`}
                        onClick={(event) => {
                          if (!isLocked) return;
                          event.preventDefault();
                          setShowVerifyPrompt(true);
                        }}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
      {showVerifyPrompt ? (
        <MerchantVerificationGateModal kind={promptKind} onClose={() => setShowVerifyPrompt(false)} />
      ) : null}
    </div>
  );
}
