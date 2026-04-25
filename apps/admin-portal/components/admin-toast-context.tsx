"use client";

import { createContext, useCallback, useContext, useId, useMemo, useState } from "react";

export type AdminToast = { id: string; message: string; kind: "success" | "error" | "info" };

const ToastContext = createContext<{
  push: (t: { message: string; kind: AdminToast["kind"] }) => void;
} | null>(null);

export function useAdminToast() {
  const c = useContext(ToastContext);
  if (!c) throw new Error("useAdminToast must be used within AdminToastProvider");
  return c;
}

export function AdminToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<AdminToast[]>([]);
  const baseId = useId();
  const push = useCallback(({ message, kind }: { message: string; kind: AdminToast["kind"] }) => {
    const id = `${baseId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((s) => [...s, { id, message, kind }]);
    const duration = kind === "error" ? 6500 : 4000;
    setTimeout(() => {
      setToasts((s) => s.filter((t) => t.id !== id));
    }, duration);
  }, [baseId]);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        style={{ position: "fixed", top: 72, right: 16, zIndex: 100, display: "grid", gap: 8, maxWidth: 420 }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="admin-toast"
            data-kind={t.kind}
            style={{
              borderRadius: 12,
              border: "1px solid var(--ui-border)",
              background: "var(--ui-surface)",
              boxShadow: "var(--ui-shadow)",
              padding: "0.65rem 0.85rem",
              color: t.kind === "error" ? "var(--ui-danger)" : t.kind === "success" ? "var(--ui-success)" : "var(--ui-text)",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
