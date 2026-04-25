"use client";

import { ActionButton, SurfaceCard } from "@sexxymarket/ui";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <SurfaceCard style={{ padding: "1.2rem" }}>
      <h2 className="section-title" style={{ fontSize: "1.1rem" }}>
        Something went wrong
      </h2>
      <p className="section-lead">{error.message || "An unexpected error occurred in this view."}</p>
      <ActionButton onClick={() => reset()}>Try again</ActionButton>
    </SurfaceCard>
  );
}
