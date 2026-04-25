"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton, SurfaceCard } from "@sexxymarket/ui";
import { getAdminToken, adminRequest, AdminRequestError } from "../../../lib/admin-api";
import { useAdminToast } from "../../../components/admin-toast-context";
import { AdminDialog, AdminDialogActions } from "../../../components/admin-dialog";
import { StatusPill } from "../../../components/status-pill";
import { EmptyState } from "../../../components/empty-state";
import { PasswordField } from "../../../components/password-field";
import { TableSkeleton } from "../../../components/loading-primitives";

type Me = { sub: string; role: "ADMIN" | "SUPER_ADMIN" };
type AdminUser = { id: string; email: string; role: string; firstName: string; lastName: string; isActive: boolean };

export default function AdminAdminsPage() {
  const { push } = useAdminToast();
  const [me, setMe] = useState<Me | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAdmin, setNewAdmin] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "ADMIN",
  });
  const [deactivateTarget, setDeactivateTarget] = useState<AdminUser | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");

  const load = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    try {
      const [mePayload, adminPayload] = await Promise.all([
        adminRequest<Me>(token, "/api/auth/me"),
        adminRequest<AdminUser[]>(token, "/api/admin/users"),
      ]);
      setMe(mePayload);
      setAdmins(Array.isArray(adminPayload) ? adminPayload : []);
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Failed to load admins." });
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const createAdmin = async () => {
    const token = getAdminToken();
    try {
      await adminRequest(token, "/api/admin/users", { method: "POST", body: JSON.stringify(newAdmin) });
      push({ kind: "success", message: "Admin user created." });
      setNewAdmin({ firstName: "", lastName: "", email: "", password: "", role: "ADMIN" });
      void load();
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Create failed." });
    }
  };

  const updateRole = async (userId: string, role: "ADMIN" | "SUPER_ADMIN") => {
    if (me?.role !== "SUPER_ADMIN") return;
    const token = getAdminToken();
    try {
      await adminRequest(token, `/api/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
      push({ kind: "success", message: "Role updated." });
      void load();
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Update failed." });
    }
  };

  const doDeactivate = async () => {
    if (!deactivateTarget) return;
    const token = getAdminToken();
    try {
      await adminRequest(token, `/api/admin/users/${deactivateTarget.id}/deactivate`, {
        method: "PATCH",
        body: JSON.stringify({ reason: deactivateReason.trim() || undefined }),
      });
      push({ kind: "success", message: "Admin deactivated." });
      setDeactivateTarget(null);
      setDeactivateReason("");
      void load();
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Deactivation failed." });
    }
  };

  return (
    <div className="panel-stack" style={{ paddingTop: "0.35rem" }}>
      <section className="dashboard-grid">
        <SurfaceCard style={{ padding: "1rem" }} aria-busy={loading} className="loading-region">
          <p className="route-eyebrow">Create</p>
          <h1 className="section-title" style={{ fontSize: "1.2rem" }}>
            New admin user
          </h1>
          {me?.role !== "SUPER_ADMIN" ? <p className="muted" style={{ fontSize: "0.88rem" }}>Only super admins can create new admins.</p> : null}
          <div className="panel-stack" style={{ marginTop: 8, gap: 8 }}>
            <div className="field">
              <label>First name</label>
              <input className="text-input" value={newAdmin.firstName} onChange={(e) => setNewAdmin((s) => ({ ...s, firstName: e.target.value }))} />
            </div>
            <div className="field">
              <label>Last name</label>
              <input className="text-input" value={newAdmin.lastName} onChange={(e) => setNewAdmin((s) => ({ ...s, lastName: e.target.value }))} />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="text-input" value={newAdmin.email} onChange={(e) => setNewAdmin((s) => ({ ...s, email: e.target.value }))} />
            </div>
            <div className="field">
              <label>Password</label>
              <PasswordField
                id="new-admin-password"
                value={newAdmin.password}
                onChange={(value) => setNewAdmin((s) => ({ ...s, password: value }))}
                placeholder="Set temporary password"
                autoComplete="new-password"
                containerClassName=""
              />
            </div>
            <div className="field">
              <label>Role</label>
              <select className="text-input" value={newAdmin.role} onChange={(e) => setNewAdmin((s) => ({ ...s, role: e.target.value }))}>
                <option value="ADMIN">ADMIN</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              </select>
            </div>
            <ActionButton onClick={() => void createAdmin()} disabled={me?.role !== "SUPER_ADMIN"}>
              Create
            </ActionButton>
          </div>
        </SurfaceCard>
        <SurfaceCard style={{ padding: "1rem" }}>
          <h2 className="section-title" style={{ fontSize: "1.2rem" }}>
            Admin directory
          </h2>
          {loading ? <TableSkeleton rows={4} /> : null}
          {!loading && admins.length === 0 ? <EmptyState title="No admin users" description="Your seed admin should always appear; reload if empty." /> : !loading ? (
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Admin</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => (
                    <tr key={admin.id}>
                      <td>
                        <strong>
                          {admin.firstName} {admin.lastName}
                        </strong>
                        <div className="muted">{admin.email}</div>
                      </td>
                      <td>
                        <StatusPill value={admin.role} />
                      </td>
                      <td>{admin.isActive ? <StatusPill value="ACTIVE" /> : <StatusPill value="INACTIVE" />}</td>
                      <td>
                        <div className="actions-row">
                          <button
                            type="button"
                            className="chip"
                            disabled={me?.role !== "SUPER_ADMIN"}
                            onClick={() => void updateRole(admin.id, admin.role === "ADMIN" ? "SUPER_ADMIN" : "ADMIN")}
                          >
                            Toggle role
                          </button>
                          <button
                            type="button"
                            className="chip"
                            disabled={me?.role !== "SUPER_ADMIN"}
                            onClick={() => { setDeactivateTarget(admin); setDeactivateReason(""); }}
                          >
                            Deactivate
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
      </section>

      <AdminDialog
        open={!!deactivateTarget}
        title="Deactivate admin"
        onClose={() => { setDeactivateTarget(null); setDeactivateReason(""); }}
        footer={
          <AdminDialogActions
            onCancel={() => { setDeactivateTarget(null); setDeactivateReason(""); }}
            onConfirm={() => void doDeactivate()}
            confirmLabel="Deactivate"
          />
        }
      >
        {deactivateTarget ? (
          <div className="field">
            <p>Retire <strong>{deactivateTarget.email}</strong> from admin access?</p>
            <label htmlFor="a-reason">Reason (optional)</label>
            <textarea id="a-reason" className="text-input" rows={3} value={deactivateReason} onChange={(e) => setDeactivateReason(e.target.value)} />
          </div>
        ) : null}
      </AdminDialog>
    </div>
  );
}
