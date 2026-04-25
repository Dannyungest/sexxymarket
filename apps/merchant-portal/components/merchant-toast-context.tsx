"use client";

import { createContext, useCallback, useContext, useId, useMemo, useState } from "react";

export type MerchantToast = { id: string; message: string; kind: "success" | "error" | "info" };

const Ctx = createContext<{ push: (t: { message: string; kind: MerchantToast["kind"] }) => void } | null>(null);

export function useMerchantToast() {
  const c = useContext(Ctx);
  if (!c) {
    throw new Error("useMerchantToast must be used within MerchantToastProvider");
  }
  return c;
}

export function MerchantToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<MerchantToast[]>([]);
  const baseId = useId();
  const push = useCallback(
    ({ message, kind }: { message: string; kind: MerchantToast["kind"] }) => {
      const id = `${baseId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((s) => [...s, { id, message, kind }]);
      const duration = kind === "error" ? 6500 : 4000;
      setTimeout(() => {
        setToasts((s) => s.filter((t) => t.id !== id));
      }, duration);
    },
    [baseId],
  );
  const value = useMemo(() => ({ push }), [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        style={{
          position: "fixed",
          top: 72,
          right: 16,
          zIndex: 100,
          display: "grid",
          gap: 8,
          maxWidth: 420,
        }}
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
              color:
                t.kind === "error" ? "var(--ui-danger)" : t.kind === "success" ? "var(--ui-success)" : "var(--ui-text)",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
