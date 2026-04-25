"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ActionButton, SurfaceCard } from "@sexxymarket/ui";
import { getAdminToken, adminRequest, AdminRequestError } from "../../../lib/admin-api";
import { useAdminToast } from "../../../components/admin-toast-context";
import { AdminDialog, AdminDialogActions } from "../../../components/admin-dialog";
import { StatusPill } from "../../../components/status-pill";
import { EmptyState } from "../../../components/empty-state";
import type { AdminMerchant } from "../../../lib/admin-api-types";
import { PasswordField } from "../../../components/password-field";
import { TableSkeleton } from "../../../components/loading-primitives";

type StatusAction = "APPROVED" | "PAUSED" | "BLACKLISTED";
type StateLgaRow = { state: string; lgas: string[] };

const NIGERIA_GEO_DATA_URL =
  "https://gist.githubusercontent.com/devhammed/0bb9eeac9ff22c895100d072f489dc98/raw";

const buildAddress = (parts: {
  houseNo: string;
  street: string;
  city: string;
  state: string;
  lga: string;
  landmark?: string;
}) =>
  [
    `${parts.houseNo.trim()} ${parts.street.trim()}`.trim(),
    parts.city.trim(),
    parts.lga.trim(),
    parts.state.trim(),
    parts.landmark?.trim() ? `Landmark: ${parts.landmark.trim()}` : "",
  ]
    .filter(Boolean)
    .join(", ");

const emptyMerchant = () => ({
  email: "",
  password: "",
  businessName: "",
  contactHouseNo: "",
  contactStreet: "",
  contactCity: "",
  contactState: "",
  contactLga: "",
  contactLandmark: "",
  storeHouseNo: "",
  storeStreet: "",
  storeCity: "",
  storeState: "",
  storeLga: "",
  storeLandmark: "",
  hasPhysicalLocation: false,
});

export default function AdminMerchantsPage() {
  const { push } = useAdminToast();
  const [merchants, setMerchants] = useState<AdminMerchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [newMerchant, setNewMerchant] = useState(emptyMerchant);
  const [modal, setModal] = useState<{ merchant: AdminMerchant; action: StatusAction; unpause?: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [stateLgaRows, setStateLgaRows] = useState<StateLgaRow[]>([]);

  const load = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminRequest<AdminMerchant[]>(token, "/api/admin/merchants");
      setMerchants(Array.isArray(data) ? data : []);
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Unable to load merchants." });
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void fetch(NIGERIA_GEO_DATA_URL)
      .then((r) => r.json())
      .then((rows) => {
        const normalized = Array.isArray(rows)
          ? rows
              .map((row) => ({
                state: String(row?.state ?? ""),
                lgas: Array.isArray(row?.lgas) ? row.lgas.map((lga: unknown) => String(lga)) : [],
              }))
              .filter((row) => row.state && row.lgas.length)
          : [];
        setStateLgaRows(normalized);
      })
      .catch(() => setStateLgaRows([]));
  }, []);

  const createProvisioned = async () => {
    const token = getAdminToken();
    const body = {
      email: newMerchant.email,
      password: newMerchant.password,
      businessName: newMerchant.businessName,
      contactAddress: buildAddress({
        houseNo: newMerchant.contactHouseNo,
        street: newMerchant.contactStreet,
        city: newMerchant.contactCity,
        lga: newMerchant.contactLga,
        state: newMerchant.contactState,
        landmark: newMerchant.contactLandmark,
      }),
      hasPhysicalLocation: newMerchant.hasPhysicalLocation,
      ...(newMerchant.hasPhysicalLocation
        ? {
            businessAddress: buildAddress({
              houseNo: newMerchant.storeHouseNo,
              street: newMerchant.storeStreet,
              city: newMerchant.storeCity,
              lga: newMerchant.storeLga,
              state: newMerchant.storeState,
              landmark: newMerchant.storeLandmark,
            }),
          }
        : {}),
    };
    try {
      await adminRequest(token, "/api/admin/merchants", { method: "POST", body: JSON.stringify(body) });
      push({ kind: "success", message: "Merchant provisioned. Credentials were emailed." });
      setNewMerchant(emptyMerchant());
      setAddFormOpen(false);
      void load();
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Create failed." });
    }
  };

  const applyStatus = async () => {
    if (!modal) return;
    const token = getAdminToken();
    const apiStatus: StatusAction =
      modal.unpause ? "APPROVED" : modal.action;
    try {
      await adminRequest(token, `/api/admin/merchants/${modal.merchant.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: apiStatus, reason: reason.trim() || undefined }),
      });
      push({ kind: "success", message: "Merchant status updated." });
      setModal(null);
      setReason("");
      void load();
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Update failed." });
    }
  };

  return (
    <div className="panel-stack" style={{ paddingTop: "0.35rem" }}>
      <SurfaceCard style={{ padding: "1rem" }} aria-busy={loading} className="loading-region">
        <div className="actions-row" style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <div>
            <p className="route-eyebrow">Merchants</p>
            <h1 className="section-title" style={{ fontSize: "1.25rem", marginTop: 4, marginBottom: 0 }}>
              Add merchant
            </h1>
            <p className="section-lead" style={{ marginTop: 4 }}>
              Provision accounts when needed. Sends email with credentials; use a strong temporary password.
            </p>
          </div>
          <ActionButton ghost onClick={() => setAddFormOpen((o) => !o)}>{addFormOpen ? "Hide form" : "Add merchant"}</ActionButton>
        </div>
        {addFormOpen ? (
        <div className="panel-stack" style={{ marginTop: 10, gap: 10 }}>
          <div className="field">
            <label>Email</label>
            <input className="text-input" value={newMerchant.email} onChange={(e) => setNewMerchant((s) => ({ ...s, email: e.target.value }))} />
          </div>
          <div className="field">
            <label>Temporary password</label>
            <PasswordField
              id="new-merchant-password"
              value={newMerchant.password}
              onChange={(value) => setNewMerchant((s) => ({ ...s, password: value }))}
              placeholder="Set temporary password"
              autoComplete="new-password"
              containerClassName=""
            />
          </div>
          <div className="field">
            <label>Business name</label>
            <input
              className="text-input"
              value={newMerchant.businessName}
              onChange={(e) => setNewMerchant((s) => ({ ...s, businessName: e.target.value }))}
            />
          </div>
          <h3 style={{ margin: "6px 0 0" }}>Contact / registered address</h3>
          <div className="merchant-auth-two-col">
            <div className="field"><label>House no.</label><input className="text-input" value={newMerchant.contactHouseNo} onChange={(e) => setNewMerchant((s) => ({ ...s, contactHouseNo: e.target.value }))} /></div>
            <div className="field"><label>Street</label><input className="text-input" value={newMerchant.contactStreet} onChange={(e) => setNewMerchant((s) => ({ ...s, contactStreet: e.target.value }))} /></div>
            <div className="field"><label>City / town</label><input className="text-input" value={newMerchant.contactCity} onChange={(e) => setNewMerchant((s) => ({ ...s, contactCity: e.target.value }))} /></div>
            <div className="field">
              <label>State</label>
              <select className="text-input" value={newMerchant.contactState} onChange={(e) => setNewMerchant((s) => ({ ...s, contactState: e.target.value, contactLga: "" }))}>
                <option value="">Select state</option>
                {stateLgaRows.map((row) => <option key={row.state} value={row.state}>{row.state}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Local government</label>
              <select className="text-input" value={newMerchant.contactLga} onChange={(e) => setNewMerchant((s) => ({ ...s, contactLga: e.target.value }))}>
                <option value="">Select LGA</option>
                {(stateLgaRows.find((row) => row.state === newMerchant.contactState)?.lgas ?? []).map((lga) => <option key={lga} value={lga}>{lga}</option>)}
              </select>
            </div>
            <div className="field"><label>Closest landmark (optional)</label><input className="text-input" value={newMerchant.contactLandmark} onChange={(e) => setNewMerchant((s) => ({ ...s, contactLandmark: e.target.value }))} /></div>
          </div>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={newMerchant.hasPhysicalLocation}
                onChange={(e) => setNewMerchant((s) => ({ ...s, hasPhysicalLocation: e.target.checked }))}
              />{" "}
              Has a physical store / walk-in location
            </label>
          </div>
          {newMerchant.hasPhysicalLocation ? (
            <div className="route-grid" style={{ gap: 8 }}>
              <h3 style={{ margin: "6px 0 0" }}>Store address</h3>
              <div className="merchant-auth-two-col">
                <div className="field"><label>House no.</label><input className="text-input" value={newMerchant.storeHouseNo} onChange={(e) => setNewMerchant((s) => ({ ...s, storeHouseNo: e.target.value }))} /></div>
                <div className="field"><label>Street</label><input className="text-input" value={newMerchant.storeStreet} onChange={(e) => setNewMerchant((s) => ({ ...s, storeStreet: e.target.value }))} /></div>
                <div className="field"><label>City / town</label><input className="text-input" value={newMerchant.storeCity} onChange={(e) => setNewMerchant((s) => ({ ...s, storeCity: e.target.value }))} /></div>
                <div className="field">
                  <label>State</label>
                  <select className="text-input" value={newMerchant.storeState} onChange={(e) => setNewMerchant((s) => ({ ...s, storeState: e.target.value, storeLga: "" }))}>
                    <option value="">Select state</option>
                    {stateLgaRows.map((row) => <option key={row.state} value={row.state}>{row.state}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Local government</label>
                  <select className="text-input" value={newMerchant.storeLga} onChange={(e) => setNewMerchant((s) => ({ ...s, storeLga: e.target.value }))}>
                    <option value="">Select LGA</option>
                    {(stateLgaRows.find((row) => row.state === newMerchant.storeState)?.lgas ?? []).map((lga) => <option key={lga} value={lga}>{lga}</option>)}
                  </select>
                </div>
                <div className="field"><label>Closest landmark (optional)</label><input className="text-input" value={newMerchant.storeLandmark} onChange={(e) => setNewMerchant((s) => ({ ...s, storeLandmark: e.target.value }))} /></div>
              </div>
            </div>
          ) : null}
          <ActionButton onClick={() => void createProvisioned()}>Create &amp; email</ActionButton>
        </div>
        ) : null}
      </SurfaceCard>

      <SurfaceCard style={{ padding: "1rem" }}>
        <h2 className="section-title" style={{ fontSize: "1.2rem" }}>
          Merchant directory
        </h2>
        {loading ? <TableSkeleton rows={4} /> : null}
        {!loading && merchants.length === 0 ? (
          <EmptyState
            title="No merchants yet"
            description="Use “Add merchant” to provision an account, or wait for self-serve applications from the portal."
          />
        ) : !loading ? (
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Merchant</th>
                  <th>Email</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {merchants.map((merchant) => (
                  <tr key={merchant.id}>
                    <td>
                      <code>{merchant.merchantCode}</code>
                    </td>
                    <td>
                      <Link href={`/merchants/${merchant.id}`} className="subtle-link">
                        <strong>{merchant.businessName}</strong>
                      </Link>
                    </td>
                    <td>{merchant.user.email}</td>
                    <td className="muted">
                      {merchant._count?.products != null ? merchant._count.products : "—"}
                    </td>
                    <td>
                      <StatusPill value={merchant.status} />
                    </td>
                    <td>
                      <div className="actions-row" style={{ flexWrap: "wrap" }}>
                        <Link href={`/merchants/${merchant.id}`} className="chip" style={{ textDecoration: "none" }}>
                          {merchant.status === "PENDING" || merchant.status === "REJECTED" ? "Review" : "View"}
                        </Link>
                        {merchant.status === "APPROVED" ? (
                          <>
                            <button
                              type="button"
                              className="chip"
                              onClick={() => {
                                setModal({ merchant, action: "PAUSED" });
                                setReason("");
                              }}
                            >
                              Pause
                            </button>
                            <button
                              type="button"
                              className="chip"
                              onClick={() => {
                                setModal({ merchant, action: "BLACKLISTED" });
                                setReason("");
                              }}
                            >
                              Blacklist
                            </button>
                          </>
                        ) : null}
                        {merchant.status === "PAUSED" ? (
                          <>
                            <button
                              type="button"
                              className="chip"
                              onClick={() => {
                                setModal({ merchant, action: "APPROVED", unpause: true });
                                setReason("");
                              }}
                            >
                              Unpause
                            </button>
                            <button
                              type="button"
                              className="chip"
                              onClick={() => {
                                setModal({ merchant, action: "BLACKLISTED" });
                                setReason("");
                              }}
                            >
                              Blacklist
                            </button>
                          </>
                        ) : null}
                        {merchant.status === "PENDING" || merchant.status === "REJECTED" ? (
                          <button
                            type="button"
                            className="chip"
                            onClick={() => {
                              setModal({ merchant, action: "BLACKLISTED" });
                              setReason("");
                            }}
                          >
                            Blacklist
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </SurfaceCard>

      <AdminDialog
        open={!!modal}
        title={modal ? (modal.unpause ? "Unpause merchant" : `${modal.action} merchant`) : ""}
        onClose={() => {
          setModal(null);
          setReason("");
        }}
        footer={
          <AdminDialogActions
            onCancel={() => { setModal(null); setReason(""); }}
            onConfirm={() => void applyStatus()}
            confirmLabel="Confirm"
          />
        }
        size="md"
      >
        {modal ? (
          <div className="field">
            <p className="muted" style={{ margin: "0 0 8px" }}>
              {modal.merchant.businessName} ({modal.merchant.user.email})
            </p>
            <label htmlFor="m-reason">Reason (recommended for high-impact actions)</label>
            <textarea
              id="m-reason"
              className="text-input"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        ) : null}
      </AdminDialog>
    </div>
  );
}
