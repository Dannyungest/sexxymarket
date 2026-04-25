"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { AuthoringRequestError, type AdminListing } from "./api-types";

export type ProductAuthoringApi = {
  getApiBase: () => string;
  getToken: () => string;
  productImageUploadPath: string;
  getProductById: (id: string) => Promise<AdminListing>;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  toast: (msg: { kind: "error" | "success"; message: string }) => void;
};

const ProductAuthoringContext = createContext<ProductAuthoringApi | null>(null);

export function ProductAuthoringProvider({
  value,
  children,
}: {
  value: ProductAuthoringApi;
  children: ReactNode;
}) {
  const v = useMemo(() => value, [value]);
  return (
    <ProductAuthoringContext.Provider value={v}>
      {children}
    </ProductAuthoringContext.Provider>
  );
}

export function useProductAuthoringApi(): ProductAuthoringApi {
  const ctx = useContext(ProductAuthoringContext);
  if (!ctx) {
    throw new Error("useProductAuthoringApi must be used under ProductAuthoringProvider");
  }
  return ctx;
}

export function getDefaultApiBase() {
  return (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) || "http://localhost:4000";
}

export function createBearerRequest(getApiBase: () => string, getToken: () => string) {
  return async function request<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const token = getToken();
    const apiBase = getApiBase().replace(/\/$/, "");
    const p = path.startsWith("/") ? path : `/${path}`;
    const response = await fetch(`${apiBase}${p}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!response.ok) {
      const msg =
        typeof body === "object" && body && "message" in body
          ? Array.isArray((body as { message: unknown }).message)
            ? String((body as { message: unknown[] }).message[0] ?? "Request failed")
            : String((body as { message: unknown }).message)
          : `Request failed (${response.status})`;
      throw new AuthoringRequestError(msg, response.status, body);
    }
    return body as T;
  };
}
