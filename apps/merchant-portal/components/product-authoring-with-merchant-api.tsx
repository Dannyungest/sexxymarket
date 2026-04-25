"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type AdminListing,
  ProductAuthoringProvider,
  ProductAuthoringStudio,
  createBearerRequest,
  getDefaultApiBase,
} from "@sexxymarket/product-authoring";
import { getMerchantToken } from "../lib/merchant-auth";
import {
  merchantVerificationGateFromProfile,
  type MerchantVerificationGate,
} from "../lib/merchant-verification-gate";
import { MerchantVerificationGateModal } from "./merchant-verification-gate-modal";
import { useRegisterGlobalLoadingWhile } from "@sexxymarket/ui";
import { useMerchantToast } from "./merchant-toast-context";

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

export function ProductAuthoringWithMerchantApi({ productId }: { productId?: string }) {
  const { push } = useMerchantToast();
  const router = useRouter();
  const [gateLoaded, setGateLoaded] = useState(false);
  const [gateKind, setGateKind] = useState<MerchantVerificationGate>("needs_verification");

  useRegisterGlobalLoadingWhile(!gateLoaded);

  useEffect(() => {
    const t = getMerchantToken();
    if (!t) {
      setGateLoaded(true);
      setGateKind("needs_verification");
      return;
    }
    void fetch(`${apiBase}/api/merchant/profile`, { headers: { Authorization: `Bearer ${t}` } })
      .then(async (r) => {
        if (r.status === 404) {
          setGateKind("needs_verification");
          return;
        }
        if (!r.ok) {
          setGateKind("needs_verification");
          return;
        }
        const profile = (await r.json()) as {
          verificationStatus?: "PENDING" | "APPROVED" | "REJECTED";
          verifications?: unknown[];
        };
        setGateKind(merchantVerificationGateFromProfile(profile));
      })
      .catch(() => setGateKind("needs_verification"))
      .finally(() => setGateLoaded(true));
  }, []);

  const api = useMemo(() => {
    const getApiBase = getDefaultApiBase;
    const getToken = getMerchantToken;
    const request = createBearerRequest(getApiBase, getToken);
    return {
      getApiBase,
      getToken,
      productImageUploadPath: "/api/catalog/uploads/product-image/file",
      getProductById: (id: string) => request<AdminListing>(`/api/catalog/products/${id}`),
      request,
      toast: push,
    };
  }, [push]);

  if (!gateLoaded) {
    return null;
  }

  if (gateKind !== "approved") {
    const modalKind = gateKind === "awaiting_approval" ? "awaiting_approval" : "needs_verification";
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          background: "color-mix(in oklab, var(--ui-bg) 82%, black)",
        }}
      >
        <div style={{ width: "100%", maxWidth: 440 }}>
          <MerchantVerificationGateModal
            kind={modalKind}
            onClose={() => router.push("/products")}
          />
        </div>
      </div>
    );
  }

  return (
    <ProductAuthoringProvider value={api}>
      <ProductAuthoringStudio productId={productId} productsListHref="/products" />
    </ProductAuthoringProvider>
  );
}
