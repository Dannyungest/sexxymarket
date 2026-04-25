"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { ActionButton } from "@sexxymarket/ui";

type AuthoringDialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
};

const sizes = { sm: 400, md: 520, lg: 640 };

export function AuthoringModal({ open, title, onClose, children, footer, size = "md" }: AuthoringDialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const t = setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [open, title]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!open || !panelRef.current) return;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((entry) => !entry.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("keydown", h);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      openerRef.current?.focus();
    }
  }, [open]);

  if (typeof document === "undefined" || !open) return null;

  return createPortal(
    <div
      className="admin-dialog-root"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "grid",
        placeItems: "center",
        background: "rgba(15, 10, 6, 0.45)",
        backdropFilter: "blur(4px)",
        padding: 16,
      }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="surface-card"
        style={{ width: "min(100%, " + sizes[size] + "px)", maxHeight: "min(90vh, 800px)", overflow: "auto", padding: "1.1rem" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, marginBottom: 12 }}>
          <h2 id={titleId} className="section-title" style={{ fontSize: "1.2rem", margin: 0 }}>
            {title}
          </h2>
          <button type="button" className="chip" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <div style={{ color: "var(--ui-text)" }}>{children}</div>
        {footer ? <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function AdminDialogActions({
  onCancel,
  onConfirm,
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  confirmDisabled = false,
  confirmLoading = false,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
}) {
  return (
    <>
      <ActionButton type="button" ghost onClick={onCancel} disabled={confirmLoading}>
        {cancelLabel}
      </ActionButton>
      <ActionButton
        type="button"
        onClick={onConfirm}
        disabled={confirmDisabled}
        isLoading={confirmLoading}
        loadingText="Saving..."
      >
        {confirmLabel}
      </ActionButton>
    </>
  );
}
