"use client";

import { Inbox } from "lucide-react";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "2rem 1rem",
        border: "1px dashed var(--ui-border)",
        borderRadius: 16,
        color: "var(--ui-muted)",
        background: "var(--ui-card-soft)",
      }}
    >
      <Inbox size={32} style={{ marginBottom: 8, opacity: 0.7 }} aria-hidden />
      <p style={{ margin: 0, fontWeight: 600, color: "var(--ui-text)" }}>{title}</p>
      <p style={{ margin: "6px 0 0", fontSize: "0.9rem" }}>{description}</p>
    </div>
  );
}
