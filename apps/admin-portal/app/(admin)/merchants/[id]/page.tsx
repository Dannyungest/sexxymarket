"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ActionButton, SurfaceCard } from "@sexxymarket/ui";
import { getAdminToken, getAdminApiBase, adminRequest, AdminRequestError } from "../../../../lib/admin-api";
import { useAdminToast } from "../../../../components/admin-toast-context";
import { AdminDialog, AdminDialogActions } from "../../../../components/admin-dialog";
import { StatusPill } from "../../../../components/status-pill";
import { TableSkeleton } from "../../../../components/loading-primitives";
import type { AdminMerchantDetail, AdminMerchantVerification } from "../../../../lib/admin-api-types";

type StatusAction = "PAUSED" | "BLACKLISTED" | "UNPAUSE";

const KYC_REJECT_PRESETS: { value: string; label: string }[] = [
  { value: "Document images are unclear, illegible, or out of date.", label: "Unclear or out-of-date document images" },
  { value: "Name or address on documents does not match the application (CAC, ID, or business details).", label: "Name/address mismatch" },
  { value: "One or more required KYC document types are missing (see verification checklist).", label: "Missing required documents" },
  { value: "custom", label: "Custom reason" },
];

function toAbsoluteMediaUrl(url?: string) {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      const isLocalhostHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
      if (isLocalhostHost && parsed.pathname.startsWith("/uploads/")) {
        return `${getAdminApiBase()}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      return trimmed;
    }
    return trimmed;
  }
  return `${getAdminApiBase()}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

export default function AdminMerchantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useAdminToast();
  const [data, setData] = useState<AdminMerchantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyModal, setVerifyModal] = useState<{
    verification: AdminMerchantVerification;
    decision: "APPROVED" | "REJECTED";
  } | null>(null);
  const [verifyReason, setVerifyReason] = useState("");
  const [verifyRejectPreset, setVerifyRejectPreset] = useState("custom");
  const [statusModal, setStatusModal] = useState<StatusAction | null>(null);
  const [openingDoc, setOpeningDoc] = useState(false);
  const [statusReason, setStatusReason] = useState("");
  const [kycDoc, setKycDoc] = useState({ documentType: "id_front", fileKey: "", fileUrl: "" });

  const load = useCallback(async () => {
    const token = getAdminToken();
    if (!token || !id) return;
    setLoading(true);
    try {
      const res = await adminRequest<AdminMerchantDetail>(token, `/api/admin/merchants/${id}`);
      setData(res);
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Unable to load merchant." });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id, push]);

  useEffect(() => {
    void load();
  }, [load]);

  const reviewVerification = async () => {
    if (!verifyModal) return;
    if (verifyModal.decision === "REJECTED") {
      const reason =
        verifyRejectPreset === "custom"
          ? verifyReason.trim()
          : [verifyRejectPreset, verifyReason.trim()].filter((x) => x).join("\n\n");
      if (reason.length < 2) {
        push({ kind: "error", message: "Choose a reason or enter at least two characters." });
        return;
      }
    }
    const token = getAdminToken();
    try {
      const body: {
        decision: "APPROVED" | "REJECTED";
        reason?: string;
      } = {
        decision: verifyModal.decision,
      };
      if (verifyModal.decision === "REJECTED") {
        body.reason =
          verifyRejectPreset === "custom"
            ? verifyReason.trim()
            : [verifyRejectPreset, verifyReason.trim()].filter((x) => x).join("\n\n");
      } else {
        if (verifyReason.trim()) body.reason = verifyReason.trim();
      }
      await adminRequest(token, `/api/merchant/verification/${verifyModal.verification.id}/review`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      push({ kind: "success", message: "Verification updated." });
      setVerifyModal(null);
      setVerifyReason("");
      void load();
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Review failed." });
    }
  };

  const openKycDocument = async (documentId: string, fallbackUrl?: string) => {
    const token = getAdminToken();
    if (!token) return;
    setOpeningDoc(true);
    try {
      const r = await fetch(`${getAdminApiBase()}/api/merchant/kyc-documents/${encodeURIComponent(documentId)}/file`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const text = await r.text();
        let msg = "Unable to open file.";
        try {
          const j = JSON.parse(text) as { message?: unknown };
          if (j.message) msg = String(j.message);
        } catch {
          if (text) msg = text.slice(0, 200);
        }
        push({ kind: "error", message: msg });
        return;
      }
      const blob = await r.blob();
      const u = URL.createObjectURL(blob);
      const w = window.open(u, "_blank", "noopener,noreferrer");
      if (!w) {
        push({ kind: "error", message: "Your browser blocked the document window. Allow pop-ups and try again." });
      }
      globalThis.setTimeout(() => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* best effort */
        }
      }, 60_000);
    } catch {
      if (fallbackUrl) {
        window.open(toAbsoluteMediaUrl(fallbackUrl), "_blank", "noopener,noreferrer");
      } else {
        push({ kind: "error", message: "Could not load the document from the server." });
      }
    } finally {
      setOpeningDoc(false);
    }
  };

  const patchTier = async (tier: "STANDARD" | "SUPER") => {
    if (!data) return;
    const token = getAdminToken();
    try {
      await adminRequest(token, `/api/admin/merchants/${data.id}/tier`, {
        method: "PATCH",
        body: JSON.stringify({ merchantTier: tier }),
      });
      push({ kind: "success", message: `Tier set to ${tier === "SUPER" ? "Super" : "Standard"}.` });
      void load();
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Tier update failed." });
    }
  };

  const appendKycFromFields = async () => {
    if (!data) return;
    if (!kycDoc.fileKey.trim() || !kycDoc.fileUrl.trim()) {
      push({ kind: "error", message: "fileKey and fileUrl are required (upload file, then paste storage key and public URL)." });
      return;
    }
    const token = getAdminToken();
    try {
      await adminRequest(token, `/api/admin/merchants/${data.id}/kyc/documents`, {
        method: "POST",
        body: JSON.stringify({
          documentType: kycDoc.documentType,
          fileKey: kycDoc.fileKey.trim(),
          fileUrl: kycDoc.fileUrl.trim(),
        }),
      });
      push({ kind: "success", message: "Document attached to pending verification." });
      setKycDoc((prev) => ({ ...prev, fileKey: "", fileUrl: "" }));
      void load();
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Could not add document." });
    }
  };

  const applyMerchantStatus = async () => {
    if (!data || !statusModal) return;
    const token = getAdminToken();
    const apiStatus: "APPROVED" | "PAUSED" | "BLACKLISTED" = statusModal === "UNPAUSE" ? "APPROVED" : statusModal;
    try {
      await adminRequest(token, `/api/admin/merchants/${data.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: apiStatus, reason: statusReason.trim() || undefined }),
      });
      push({ kind: "success", message: "Merchant status updated." });
      setStatusModal(null);
      setStatusReason("");
      void load();
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Update failed." });
    }
  };

  if (loading) {
    return (
      <div className="panel-stack" style={{ paddingTop: "0.35rem" }}>
        <SurfaceCard style={{ padding: "1rem" }}>
          <TableSkeleton rows={5} />
        </SurfaceCard>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel-stack" style={{ paddingTop: "0.35rem" }}>
        <SurfaceCard style={{ padding: "1rem" }}>
          <p>Merchant not found.</p>
          <ActionButton ghost onClick={() => router.push("/merchants")}>
            Back to directory
          </ActionButton>
        </SurfaceCard>
      </div>
    );
  }

  const storefront = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000";

  return (
    <div className="panel-stack" style={{ paddingTop: "0.35rem" }}>
      <SurfaceCard style={{ padding: "1rem" }}>
        <div className="actions-row" style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "start", gap: 12 }}>
          <div>
            <p className="route-eyebrow">Merchant</p>
            <h1 className="section-title" style={{ fontSize: "1.35rem", margin: "4px 0" }}>{data.businessName}</h1>
            <p className="muted" style={{ margin: 0 }}>
              <code>{data.merchantCode}</code> · {data.user.email}
            </p>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              Account status: <StatusPill value={data.status} /> · Verification:{" "}
              <StatusPill value={data.verificationStatus ?? "PENDING"} />
              {data.merchantTier ? (
                <>
                  {" "}
                  · Tier: <strong>{data.merchantTier === "SUPER" ? "Super" : "Standard"}</strong>
                </>
              ) : null}
              {data.businessType ? (
                <>
                  {" "}
                  · {data.businessType === "REGISTERED_BUSINESS" ? "Registered business" : "Individual"}
                </>
              ) : null}
            </p>
          </div>
          <div className="actions-row" style={{ flexWrap: "wrap" }}>
            <ActionButton ghost onClick={() => router.push("/merchants")}>
              Back
            </ActionButton>
            <Link className="chip" href="/merchants" style={{ textDecoration: "none", lineHeight: 1.2 }}>
              Directory
            </Link>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard style={{ padding: "1rem" }}>
        <h2 className="section-title" style={{ fontSize: "1.1rem", marginTop: 0 }}>
          Profile &amp; address
        </h2>
        <div className="panel-stack" style={{ gap: 6, fontSize: "0.92rem" }}>
          <p style={{ margin: 0 }}>
            <strong>Contact / registered</strong> — {data.contactAddress || "—"}
          </p>
          {data.hasPhysicalLocation ? (
            <p style={{ margin: 0 }}>
              <strong>Store address</strong> — {data.businessAddress?.trim() ? data.businessAddress : "—"}
            </p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              No physical store on file.
            </p>
          )}
          <p style={{ margin: 0 }}>
            <strong>Owner</strong> — {data.user.firstName} {data.user.lastName}
            {data.user.phone ? ` · ${data.user.phone}` : null}
          </p>
        </div>
      </SurfaceCard>

      <SurfaceCard style={{ padding: "1rem" }}>
        <h2 className="section-title" style={{ fontSize: "1.1rem", marginTop: 0 }}>
          Catalog tier
        </h2>
        <p className="muted" style={{ fontSize: "0.82rem", marginBottom: 6 }}>
          Audit log note: Auto tier decided by business type at approval time.
        </p>
        <p className="muted" style={{ fontSize: "0.86rem" }}>
          Tier is auto-set during verification approval based on business type. Use controls below only for manual upgrade/downgrade after approval.
        </p>
        <div className="actions-row" style={{ flexWrap: "wrap", marginTop: 8 }}>
          {data.merchantTier !== "STANDARD" ? (
            <button type="button" className="chip" onClick={() => void patchTier("STANDARD")}>
              Downgrade to Standard
            </button>
          ) : null}
          {data.merchantTier !== "SUPER" ? (
            <button type="button" className="chip" onClick={() => void patchTier("SUPER")}>
              Upgrade to Super
            </button>
          ) : null}
        </div>
      </SurfaceCard>

      <SurfaceCard style={{ padding: "1rem" }}>
        <h2 className="section-title" style={{ fontSize: "1.1rem", marginTop: 0 }}>
          Sales snapshot
        </h2>
        <div className="kpi-grid">
          <div className="surface-card" style={{ padding: "0.75rem" }}>
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Revenue (line items)</p>
            <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>NGN {data.analytics.revenueNgn.toLocaleString()}</p>
          </div>
          <div className="surface-card" style={{ padding: "0.75rem" }}>
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Orders (with your items)</p>
            <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>{data.analytics.orders}</p>
          </div>
          <div className="surface-card" style={{ padding: "0.75rem" }}>
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Line items</p>
            <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>{data.analytics.lineItems}</p>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard style={{ padding: "1rem" }}>
        <h2 className="section-title" style={{ fontSize: "1.1rem", marginTop: 0 }}>
          Account actions
        </h2>
        <p className="muted" style={{ fontSize: "0.86rem" }}>
          Approve or reject a new merchant <strong>only from the verification block below</strong> after you have opened every document. Lifecycle actions (pause, blacklist) are here.
        </p>
        {data.status === "PENDING" && data.verificationStatus !== "APPROVED" ? (
          <p className="muted" style={{ fontSize: "0.86rem", marginTop: 6 }}>
            No account-level approval here—use <strong>KYC &amp; documents</strong> to approve with documents, or update status to pause or blacklist.
          </p>
        ) : null}
        <div className="actions-row" style={{ flexWrap: "wrap", marginTop: 8 }}>
          {data.status === "APPROVED" ? (
            <>
              <button type="button" className="chip" onClick={() => { setStatusModal("PAUSED"); setStatusReason(""); }}>
                Pause
              </button>
              <button type="button" className="chip" onClick={() => { setStatusModal("BLACKLISTED"); setStatusReason(""); }}>
                Blacklist
              </button>
            </>
          ) : null}
          {data.status === "PAUSED" ? (
            <>
              <button type="button" className="chip" onClick={() => { setStatusModal("UNPAUSE"); setStatusReason(""); }}>
                Unpause
              </button>
              <button type="button" className="chip" onClick={() => { setStatusModal("BLACKLISTED"); setStatusReason(""); }}>
                Blacklist
              </button>
            </>
          ) : null}
          {data.status === "PENDING" ? (
            <button type="button" className="chip" onClick={() => { setStatusModal("PAUSED"); setStatusReason(""); }}>
              Pause
            </button>
          ) : null}
          {data.status === "REJECTED" ? (
            <button type="button" className="chip" onClick={() => { setStatusModal("BLACKLISTED"); setStatusReason(""); }}>
              Blacklist
            </button>
          ) : null}
          {data.status === "PENDING" ? (
            <button type="button" className="chip" onClick={() => { setStatusModal("BLACKLISTED"); setStatusReason(""); }}>
              Blacklist
            </button>
          ) : null}
        </div>
      </SurfaceCard>

      <SurfaceCard style={{ padding: "1rem" }}>
        <h2 className="section-title" style={{ fontSize: "1.1rem", marginTop: 0 }}>
          KYC &amp; documents
        </h2>
        <p className="muted" style={{ fontSize: "0.86rem" }}>
          If the merchant can&apos;t upload files, you can call{" "}
          <code>POST /api/admin/merchants/&#123;id&#125;/kyc/document-ref</code> then upload to storage, then register the file here.
        </p>
        <div className="field" style={{ marginTop: 8, display: "grid", gap: 8, maxWidth: 480 }}>
          <label>Attach document to pending verification</label>
          <div className="actions-row" style={{ flexWrap: "wrap", gap: 8 }}>
            <select
              className="text-input"
              value={kycDoc.documentType}
              onChange={(e) => setKycDoc((p) => ({ ...p, documentType: e.target.value }))}
            >
              <option value="id_front">id_front</option>
              <option value="id_back">id_back</option>
              <option value="cac_certificate">cac_certificate</option>
              <option value="cac_status_report">cac_status_report</option>
              <option value="proof_of_address">proof_of_address</option>
              <option value="business_proof_of_address">business_proof_of_address</option>
            </select>
          </div>
          <input
            className="text-input"
            placeholder="fileKey (storage key)"
            value={kycDoc.fileKey}
            onChange={(e) => setKycDoc((p) => ({ ...p, fileKey: e.target.value }))}
          />
          <input
            className="text-input"
            placeholder="fileUrl (public URL)"
            value={kycDoc.fileUrl}
            onChange={(e) => setKycDoc((p) => ({ ...p, fileUrl: e.target.value }))}
          />
          <ActionButton onClick={() => void appendKycFromFields()}>Add document</ActionButton>
        </div>
        {data.verifications.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No verification submissions yet.</p>
        ) : (
          <div className="panel-stack" style={{ gap: 12 }}>
            {data.verifications.map((v) => (
              <div key={v.id} className="surface-card" style={{ padding: "0.75rem" }}>
                <div className="actions-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                  <span>
                    <StatusPill value={v.status} /> · {v.identityType} · CAC {v.cacNumber}
                  </span>
                  <span className="muted" style={{ fontSize: "0.82rem" }}>{new Date(v.submittedAt).toLocaleString()}</span>
                </div>
                <p style={{ margin: "8px 0", fontSize: "0.88rem" }}>Verification business address: {v.businessAddress}</p>
                {v.isRegisteredBusinessUpgrade ? (
                  <p className="muted" style={{ fontSize: "0.85rem", margin: "4px 0" }}>
                    <strong>Registered business upgrade</strong> — on approval, this account is promoted to registered (CAC path) and tier is taken from the decision below.
                  </p>
                ) : null}
                {v.documents.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                    {v.documents.map((d) => (
                      <li key={d.id} style={{ fontSize: "0.86rem" }}>
                        <span>{d.documentType}</span>{" "}
                        <button
                          type="button"
                          className="chip"
                          disabled={openingDoc}
                          onClick={() => void openKycDocument(d.id, d.fileUrl)}
                        >
                          View file
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {v.status === "PENDING" ? (
                  <div className="actions-row" style={{ marginTop: 8 }}>
                    <ActionButton
                      ghost
                      onClick={() => {
                        setVerifyModal({ verification: v, decision: "APPROVED" });
                        setVerifyReason("");
                        setVerifyRejectPreset("custom");
                      }}
                    >
                      Approve verification
                    </ActionButton>
                    <ActionButton
                      ghost
                      onClick={() => {
                        setVerifyModal({ verification: v, decision: "REJECTED" });
                        setVerifyReason("");
                        setVerifyRejectPreset(KYC_REJECT_PRESETS[0]!.value);
                      }}
                    >
                      Reject
                    </ActionButton>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard style={{ padding: "1rem" }}>
        <h2 className="section-title" style={{ fontSize: "1.1rem", marginTop: 0 }}>
          Products
        </h2>
        {data.products.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No products yet.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="table" style={{ minWidth: 0 }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Storefront</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <code>{p.productCode}</code>
                    </td>
                    <td>
                      {p.name}
                      {p.isHidden ? <span className="muted"> (hidden)</span> : null}
                    </td>
                    <td>
                      <span className="chip" style={{ fontSize: "0.75rem" }}>{p.approvalStatus}</span>{" "}
                      <span className="chip" style={{ fontSize: "0.75rem" }}>{p.authoringStatus}</span>
                    </td>
                    <td>
                      <a href={`${storefront}/products/${p.slug}`} className="subtle-link" target="_blank" rel="noreferrer">
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      <AdminDialog
        open={!!verifyModal}
        title={verifyModal ? `Verification — ${verifyModal.decision === "APPROVED" ? "approve" : "reject"}` : ""}
        onClose={() => { setVerifyModal(null); setVerifyReason(""); }}
        footer={
          <AdminDialogActions
            onCancel={() => { setVerifyModal(null); setVerifyReason(""); }}
            onConfirm={() => void reviewVerification()}
            confirmLabel="Submit"
          />
        }
        size="md"
      >
        {verifyModal ? (
          <div className="field" style={{ display: "grid", gap: 10 }}>
            {verifyModal.decision === "APPROVED" ? (
              <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
                Merchant tier will be set automatically from business type during approval. You can still upgrade/downgrade later from the Catalog tier section.
              </p>
            ) : null}
            {verifyModal.decision === "REJECTED" ? (
              <div>
                <label htmlFor="vr-preset">Rejection reason</label>
                <select
                  id="vr-preset"
                  className="text-input"
                  value={verifyRejectPreset}
                  onChange={(e) => {
                    setVerifyRejectPreset(e.target.value);
                    if (e.target.value !== "custom") setVerifyReason(e.target.value);
                  }}
                >
                  {KYC_REJECT_PRESETS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
            <label htmlFor="vr-reason">
              {verifyModal.decision === "REJECTED" ? (verifyRejectPreset === "custom" ? "Custom reason" : "Optional extra note") : "Note (optional)"}
            </label>
            <textarea
              id="vr-reason"
              className="text-input"
              rows={3}
              value={verifyReason}
              onChange={(e) => setVerifyReason(e.target.value)}
            />
            </div>
          </div>
        ) : null}
      </AdminDialog>

      <AdminDialog
        open={!!statusModal}
        title={statusModal ? (statusModal === "UNPAUSE" ? "Unpause merchant" : `Set status: ${statusModal}`) : ""}
        onClose={() => { setStatusModal(null); setStatusReason(""); }}
        footer={
          <AdminDialogActions
            onCancel={() => { setStatusModal(null); setStatusReason(""); }}
            onConfirm={() => void applyMerchantStatus()}
            confirmLabel="Confirm"
          />
        }
        size="md"
      >
        {data && statusModal ? (
          <div className="field">
            <p className="muted" style={{ margin: "0 0 8px" }}>{data.businessName}</p>
            <label htmlFor="m-status-reason">Reason (optional)</label>
            <textarea
              id="m-status-reason"
              className="text-input"
              rows={3}
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
            />
          </div>
        ) : null}
      </AdminDialog>
    </div>
  );
}
