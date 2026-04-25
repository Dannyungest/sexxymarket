"use client";

import { useParams } from "next/navigation";
import { ProductAuthoringWithAdminApi } from "../../../../../components/product-authoring-with-admin-api";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  return <ProductAuthoringWithAdminApi productId={params.id} />;
}
