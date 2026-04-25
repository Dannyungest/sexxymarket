"use client";

import { useEffect } from "react";

const API_WARMUP_TIMEOUT_MS = 7000;

export function ApiWarmup() {
  useEffect(() => {
    const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
    if (!apiBase) return;
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), API_WARMUP_TIMEOUT_MS);
    void fetch(`${apiBase}/`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => {
      globalThis.clearTimeout(timeout);
    });
    return () => {
      controller.abort();
      globalThis.clearTimeout(timeout);
    };
  }, []);

  return null;
}
