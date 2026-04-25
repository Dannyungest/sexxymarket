"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton, SurfaceCard } from "@sexxymarket/ui";
import { getAdminToken, adminRequest, AdminRequestError } from "../../../lib/admin-api";
import { useAdminToast } from "../../../components/admin-toast-context";
import { AdminDialog, AdminDialogActions } from "../../../components/admin-dialog";
import { StatusPill } from "../../../components/status-pill";
import { EmptyState } from "../../../components/empty-state";
import type { AdminCustomer } from "../../../lib/admin-api-types";
import { PasswordField } from "../../../components/password-field";
import { TableSkeleton } from "../../../components/loading-primitives";

export default function AdminUsersPage() {
  const { push } = useAdminToast();
  const [users, setUsers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ email: "", password: "", firstName: "", lastName: "", phone: "" });
  const [walletModal, setWalletModal] = useState<AdminCustomer | null>(null);
  const [walletValue, setWalletValue] = useState("");
  const [couponModal, setCouponModal] = useState<AdminCustomer | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState("0");

  const load = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminRequest<AdminCustomer[]>(token, "/api/admin/customers");
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Unable to load users." });
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const createUser = async () => {
    const token = getAdminToken();
    try {
      await adminRequest(token, "/api/admin/customers", { method: "POST", body: JSON.stringify(newCustomer) });
      push({ kind: "success", message: "User created. Verification path sent as per policy." });
      setNewCustomer({ email: "", password: "", firstName: "", lastName: "", phone: "" });
      void load();
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Create failed." });
    }
  };

  const patchUser = async (userId: string, body: Record<string, unknown>, msg: string) => {
    const token = getAdminToken();
    try {
      await adminRequest(token, `/api/admin/customers/${userId}`, { method: "PATCH", body: JSON.stringify(body) });
      push({ kind: "success", message: msg });
      void load();
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Update failed." });
    }
  };

  const saveWallet = () => {
    if (!walletModal) return;
    const n = Number(walletValue);
    if (Number.isNaN(n) || n < 0) {
      push({ kind: "error", message: "Invalid credit amount." });
      return;
    }
    void patchUser(walletModal.id, { walletCreditNgn: n }, "Wallet credit updated.");
    setWalletModal(null);
  };

  const saveCoupon = () => {
    if (!couponModal) return;
    const d = Number(discountPercent);
    if (Number.isNaN(d) || d < 0 || d > 100) {
      push({ kind: "error", message: "Discount must be 0–100." });
      return;
    }
    void patchUser(
      couponModal.id,
      { couponCode: couponCode || "", discountPercent: d },
      "Coupon and discount updated.",
    );
    setCouponModal(null);
  };

  return (
    <div className="panel-stack" style={{ paddingTop: "0.35rem" }}>
      <SurfaceCard style={{ padding: "1rem" }} aria-busy={loading} className="loading-region">
        <div className="actions-row" style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <div>
            <h1 className="section-title" style={{ fontSize: "1.25rem", margin: 0 }}>
              Onboard customer
            </h1>
            <p className="section-lead" style={{ fontSize: "0.9rem" }}>
              Sends a verification and onboarding path. Open when you need to create an account.
            </p>
          </div>
          <ActionButton ghost onClick={() => setOnboardOpen((o) => !o)}>{onboardOpen ? "Hide" : "Onboard customer"}</ActionButton>
        </div>
        {onboardOpen ? (
        <div className="actions-row" style={{ marginTop: 8, flexWrap: "wrap" }}>
          <input
            className="text-input"
            placeholder="Email"
            value={newCustomer.email}
            onChange={(e) => setNewCustomer((s) => ({ ...s, email: e.target.value }))}
            style={{ minWidth: 180, flex: 1 }}
          />
          <PasswordField
            value={newCustomer.password}
            onChange={(value) => setNewCustomer((s) => ({ ...s, password: value }))}
            placeholder="Temp password"
            autoComplete="new-password"
            containerStyle={{ minWidth: 140, flex: 1 }}
          />
          <input
            className="text-input"
            placeholder="First name"
            value={newCustomer.firstName}
            onChange={(e) => setNewCustomer((s) => ({ ...s, firstName: e.target.value }))}
            style={{ minWidth: 120, flex: 1 }}
          />
          <input
            className="text-input"
            placeholder="Last name"
            value={newCustomer.lastName}
            onChange={(e) => setNewCustomer((s) => ({ ...s, lastName: e.target.value }))}
            style={{ minWidth: 120, flex: 1 }}
          />
          <input
            className="text-input"
            placeholder="Phone"
            value={newCustomer.phone}
            onChange={(e) => setNewCustomer((s) => ({ ...s, phone: e.target.value }))}
            style={{ minWidth: 120, flex: 1 }}
          />
          <ActionButton onClick={() => void createUser()}>Create user</ActionButton>
        </div>
        ) : null}
      </SurfaceCard>

      <SurfaceCard style={{ padding: "1rem" }}>
        <h2 className="section-title" style={{ fontSize: "1.2rem" }}>
          Accounts &amp; risk
        </h2>
        {loading ? <TableSkeleton rows={5} /> : null}
        {!loading && users.length === 0 ? <EmptyState title="No user accounts" description="Customers you create or register will show here." /> : !loading ? (
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Email &amp; verification</th>
                  <th>Flags</th>
                  <th>Benefits</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {item.firstName} {item.lastName}
                      </strong>
                    </td>
                    <td>{item.role}</td>
                    <td>
                      <div className="muted" style={{ fontSize: "0.84rem" }}>{item.email}</div>
                      {item.emailVerifiedAt ? <StatusPill value="VERIFIED" /> : <StatusPill value="UNVERIFIED" />}
                      {item.mustChangePassword ? <span className="muted" style={{ fontSize: "0.75rem" }}> · Password reset due</span> : null}
                    </td>
                    <td>
                      {item.isBlocked ? <StatusPill value="BLOCKED" /> : null}{" "}
                      {item.isBlacklisted ? <StatusPill value="BLACKLISTED" /> : null}
                      {!item.isBlocked && !item.isBlacklisted ? <span className="muted">Clear</span> : null}
                    </td>
                    <td>
                      Credit: NGN {item.walletCreditNgn.toLocaleString()}
                      <br />
                      <span className="muted" style={{ fontSize: "0.82rem" }}>Disc {item.discountPercent}% · {item.couponCode ?? "—"}</span>
                    </td>
                    <td>
                      <div className="actions-row" style={{ flexWrap: "wrap" }}>
                        <button type="button" className="chip" onClick={() => void patchUser(item.id, { isBlocked: !item.isBlocked }, item.isBlocked ? "Unblocked" : "Blocked")}>
                          {item.isBlocked ? "Unblock" : "Block"}
                        </button>
                        <button type="button" className="chip" onClick={() => void patchUser(item.id, { isBlacklisted: !item.isBlacklisted }, item.isBlacklisted ? "Removed from blacklist" : "Blacklisted")}>
                          {item.isBlacklisted ? "Unblacklist" : "Blacklist"}
                        </button>
                        <button
                          type="button"
                          className="chip"
                          onClick={() => {
                            setWalletModal(item);
                            setWalletValue(String(item.walletCreditNgn));
                          }}
                        >
                          Credit
                        </button>
                        <button
                          type="button"
                          className="chip"
                          onClick={() => {
                            setCouponModal(item);
                            setCouponCode(item.couponCode ?? "");
                            setDiscountPercent(String(item.discountPercent));
                          }}
                        >
                          Coupon
                        </button>
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
        open={!!walletModal}
        title="Wallet credit"
        onClose={() => setWalletModal(null)}
        footer={<AdminDialogActions onCancel={() => setWalletModal(null)} onConfirm={() => saveWallet()} confirmLabel="Save" />}
      >
        {walletModal ? (
          <div className="field">
            <label htmlFor="w-amount">NGN credit for {walletModal.firstName} {walletModal.lastName}</label>
            <input id="w-amount" className="text-input" value={walletValue} onChange={(e) => setWalletValue(e.target.value)} type="number" min={0} />
          </div>
        ) : null}
      </AdminDialog>

      <AdminDialog
        open={!!couponModal}
        title="Coupon &amp; discount"
        onClose={() => setCouponModal(null)}
        footer={<AdminDialogActions onCancel={() => setCouponModal(null)} onConfirm={() => saveCoupon()} confirmLabel="Save" />}
      >
        {couponModal ? (
          <div className="panel-stack" style={{ gap: 10 }}>
            <div className="field">
              <label>Coupon code</label>
              <input className="text-input" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
            </div>
            <div className="field">
              <label>Discount % (0–100)</label>
              <input className="text-input" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} type="number" min={0} max={100} />
            </div>
          </div>
        ) : null}
      </AdminDialog>
    </div>
  );
}
