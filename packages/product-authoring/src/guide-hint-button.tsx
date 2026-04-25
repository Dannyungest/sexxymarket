"use client";

import { useId, useState } from "react";
import { HelpCircle } from "lucide-react";
import { AuthoringModal } from "./authoring-modal";

type GuideHintButtonProps = {
  label: string;
  title: string;
  children: React.ReactNode;
  "aria-label"?: string;
};

export function GuideHintButton({ label, title, children, "aria-label": ariaLabel }: GuideHintButtonProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button
        type="button"
        className="chip guide-hint-btn"
        aria-label={ariaLabel ?? `Open guide: ${label}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(true)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.35rem 0.65rem" }}
      >
        <HelpCircle size={16} strokeWidth={1.8} aria-hidden />
        {label}
      </button>
      <AuthoringModal open={open} title={title} onClose={() => setOpen(false)} size="lg">
        <div id={id} className="panel-stack" style={{ gap: 12, fontSize: "0.92rem", lineHeight: 1.55 }}>
          {children}
        </div>
      </AuthoringModal>
    </>
  );
}
