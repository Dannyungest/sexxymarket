"use client";

import { useMemo } from "react";
import {
  ProductAuthoringProvider,
  ProductAuthoringStudio,
  createBearerRequest,
  getDefaultApiBase,
} from "@sexxymarket/product-authoring";
import { getAdminToken } from "../lib/admin-api";
import { useAdminToast } from "./admin-toast-context";
import type { AdminListing } from "../lib/admin-api-types";

export function ProductAuthoringWithAdminApi({ productId }: { productId?: string }) {
  const { push } = useAdminToast();
  const api = useMemo(() => {
    const getApiBase = getDefaultApiBase;
    const getToken = getAdminToken;
    const request = createBearerRequest(getApiBase, getToken);
    return {
      getApiBase,
      getToken,
      productImageUploadPath: "/api/admin/uploads/product-image/file",
      getProductById: (id: string) => request<AdminListing>(`/api/admin/listings/${id}`),
      request,
      toast: push,
    };
  }, [push]);
  return (
    <ProductAuthoringProvider value={api}>
      <ProductAuthoringStudio productId={productId} productsListHref="/products" />
    </ProductAuthoringProvider>
  );
}
