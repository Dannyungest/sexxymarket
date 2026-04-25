"use client";

import { useParams } from "next/navigation";
import { ProductAuthoringWithMerchantApi } from "../../../../components/product-authoring-with-merchant-api";

export default function EditMerchantProductPage() {
  const { id } = useParams<{ id: string }>();
  return <ProductAuthoringWithMerchantApi productId={id} />;
}
