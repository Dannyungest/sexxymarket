"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton, SurfaceCard } from "@sexxymarket/ui";
import { getAdminToken, adminRequest, AdminRequestError } from "../../../lib/admin-api";
import { useAdminToast } from "../../../components/admin-toast-context";
import { AdminDialog, AdminDialogActions } from "../../../components/admin-dialog";
import { StatusPill } from "../../../components/status-pill";
import { TablePagination } from "../../../components/table-pagination";
import { EmptyState } from "../../../components/empty-state";
import type { CatalogProduct, Category, FullOrder } from "../../../lib/admin-api-types";
import { TableSkeleton } from "../../../components/loading-primitives";

const PAGE_SIZE = 15;
const CATALOG_PAGE_SIZE = 40;
const ORDER_SEARCH_DEBOUNCE_MS = 250;
const CATALOG_SEARCH_DEBOUNCE_MS = 300;
const DRAFT_STORAGE_KEY = "admin.manualOrderDraft.v1";
const NIGERIA_GEO_DATA_URL =
  "https://gist.githubusercontent.com/devhammed/0bb9eeac9ff22c895100d072f489dc98/raw";
type StateLgaRow = { state: string; lgas: string[] };

const statusOptions = ["PENDING", "PAID", "PROCESSING", "DELIVERED", "CANCELLED", "REFUNDED"] as const;

type ManualLineDraft = {
  productId: string;
  variantId: string;
  quantity: number;
};

type ManualLine = {
  key: string;
  productId: string;
  variantId: string;
  quantity: number;
  productName: string;
  productCode: string;
  productSlug: string;
  variantLabel?: string;
  unitPriceNgn: number;
  maxStock: number;
  imageUrl?: string;
};

type CatalogSearchResponse = {
  items: CatalogProduct[];
  total: number;
  page: number;
  pageSize: number;
};

type ManualOrderFieldErrors = {
  shippingHouseNo?: string;
  shippingStreet?: string;
  shippingState?: string;
  shippingLga?: string;
  shippingCity?: string;
  recipientName?: string;
  recipientPhone?: string;
  userOrGuest?: string;
  guestEmail?: string;
  guestPhone?: string;
  paymentReference?: string;
  cashAmountNgn?: string;
  cashCollectedBy?: string;
};

const formatNgn = (amount: number) => `NGN ${amount.toLocaleString()}`;
const lineKey = (productId: string, variantId?: string) => `${productId}::${variantId ?? "default"}`;
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isLikelyNgPhone = (value: string) => /^\+234\d{10}$/.test(value.trim());

export default function AdminOrdersPage() {
  const { push } = useAdminToast();
  const [orders, setOrders] = useState<FullOrder[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [orderDetail, setOrderDetail] = useState<FullOrder | null>(null);
  const [orderSearchInput, setOrderSearchInput] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  const [stateLgaRows, setStateLgaRows] = useState<StateLgaRow[]>([]);
  const [manualOrderOpen, setManualOrderOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogDebouncedQuery, setCatalogDebouncedQuery] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("ALL");
  const [activeCatalogIndex, setActiveCatalogIndex] = useState(-1);

  const [manualLine, setManualLine] = useState<ManualLineDraft>({ productId: "", variantId: "", quantity: 1 });
  const [manualLines, setManualLines] = useState<ManualLine[]>([]);
  const [fieldErrors, setFieldErrors] = useState<ManualOrderFieldErrors>({});
  const [quickCode, setQuickCode] = useState("");
  const [quickQuantity, setQuickQuantity] = useState(1);
  const [bulkCodeInput, setBulkCodeInput] = useState("");
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [manualMeta, setManualMeta] = useState({
    shippingHouseNo: "",
    shippingStreet: "",
    shippingState: "",
    shippingLga: "",
    shippingCity: "",
    shippingLandmark: "",
    recipientName: "",
    recipientPhone: "+234",
    userId: "",
    guestEmail: "",
    guestPhone: "",
    paymentMode: "CASH" as "CASH" | "ONLINE_RECONCILED",
    paymentReference: "",
    cashAmountNgn: "",
    cashCollectedBy: "",
  });

  const [updateFor, setUpdateFor] = useState<FullOrder | null>(null);
  const [updateForm, setUpdateForm] = useState({
    status: "PROCESSING",
    trackingNumber: "",
    deliveryNote: "",
  });

  const catalogSearchRef = useRef<HTMLInputElement | null>(null);
  const storefrontBase = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000";
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

  const loadOrders = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;
    setLoading(true);
    const q = new URLSearchParams();
    q.set("status", orderStatus);
    q.set("q", orderSearch);
    q.set("page", String(page));
    q.set("pageSize", String(PAGE_SIZE));
    try {
      const payload = await adminRequest<{
        orders: FullOrder[];
        orderTotal: number;
      }>(token, `/api/admin/orders?${q.toString()}`);
      setOrders(Array.isArray(payload.orders) ? payload.orders : []);
      setOrderTotal(payload.orderTotal ?? 0);
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Unable to load orders." });
    } finally {
      setLoading(false);
    }
  }, [orderSearch, orderStatus, page, push]);

  const loadCatalogCategories = useCallback(async () => {
    try {
      const cRes = await fetch(`${apiBase}/api/catalog/categories`);
      if (cRes.ok) setCategories((await cRes.json()) as Category[]);
    } catch {
      push({ kind: "error", message: "Could not load categories for manual order." });
    }
  }, [apiBase, push]);

  const loadCatalog = useCallback(async () => {
    if (!manualOrderOpen) return;
    const params = new URLSearchParams();
    if (catalogDebouncedQuery.trim()) params.set("q", catalogDebouncedQuery.trim());
    if (catalogCategory !== "ALL") params.set("categoryId", catalogCategory);
    params.set("page", String(catalogPage));
    params.set("pageSize", String(CATALOG_PAGE_SIZE));
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const response = await fetch(`${apiBase}/api/catalog/products/search?${params.toString()}`);
      if (!response.ok) throw new Error(`Catalog search failed (${response.status})`);
      const payload = (await response.json()) as CatalogSearchResponse;
      const items = Array.isArray(payload.items) ? payload.items : [];
      setCatalogProducts(items);
      setCatalogTotal(payload.total ?? 0);
      setActiveCatalogIndex(items.length > 0 ? 0 : -1);
    } catch (e) {
      setCatalogProducts([]);
      setCatalogTotal(0);
      setCatalogError(e instanceof Error ? e.message : "Could not search catalog.");
    } finally {
      setCatalogLoading(false);
    }
  }, [apiBase, catalogCategory, catalogDebouncedQuery, catalogPage, manualOrderOpen]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOrderSearch(orderSearchInput);
    }, ORDER_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [orderSearchInput]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCatalogDebouncedQuery(catalogQuery);
    }, CATALOG_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [catalogQuery]);

  useEffect(() => {
    setCatalogPage(0);
  }, [catalogDebouncedQuery, catalogCategory]);

  useEffect(() => {
    void fetch(NIGERIA_GEO_DATA_URL)
      .then((r) => r.json())
      .then((rows) => {
        const normalized = Array.isArray(rows)
          ? rows
              .map((row) => ({
                state: String(row?.state ?? ""),
                lgas: Array.isArray(row?.lgas) ? row.lgas.map((lga: unknown) => String(lga)) : [],
              }))
              .filter((row) => row.state && row.lgas.length)
          : [];
        setStateLgaRows(normalized);
      })
      .catch(() => setStateLgaRows([]));
  }, []);

  useEffect(() => {
    if (!manualOrderOpen) return;
    void loadCatalogCategories();
  }, [manualOrderOpen, loadCatalogCategories]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!manualOrderOpen) return;
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      event.preventDefault();
      catalogSearchRef.current?.focus();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [manualOrderOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as {
        manualLine?: ManualLineDraft;
        manualLines?: ManualLine[];
        manualMeta?: typeof manualMeta;
        catalogQuery?: string;
        catalogCategory?: string;
        quickCode?: string;
        quickQuantity?: number;
        bulkCodeInput?: string;
      };
      if (draft.manualLine) setManualLine(draft.manualLine);
      if (Array.isArray(draft.manualLines)) setManualLines(draft.manualLines);
      if (draft.manualMeta) {
        setManualMeta((prev) => ({
          ...prev,
          ...draft.manualMeta,
          cashAmountNgn: draft.manualMeta?.cashAmountNgn ?? "",
          cashCollectedBy: draft.manualMeta?.cashCollectedBy ?? "",
        }));
      }
      if (typeof draft.catalogQuery === "string") setCatalogQuery(draft.catalogQuery);
      if (typeof draft.catalogCategory === "string") setCatalogCategory(draft.catalogCategory);
      if (typeof draft.quickCode === "string") setQuickCode(draft.quickCode);
      if (typeof draft.quickQuantity === "number") setQuickQuantity(Math.max(1, draft.quickQuantity));
      if (typeof draft.bulkCodeInput === "string") setBulkCodeInput(draft.bulkCodeInput);
    } catch {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        manualLine,
        manualLines,
        manualMeta,
        catalogQuery,
        catalogCategory,
        quickCode,
        quickQuantity,
        bulkCodeInput,
      }),
    );
  }, [bulkCodeInput, catalogCategory, catalogQuery, manualLine, manualLines, manualMeta, quickCode, quickQuantity]);

  const selectedProduct = useMemo(
    () => catalogProducts.find((p) => p.id === manualLine.productId),
    [catalogProducts, manualLine.productId],
  );
  const selectedVariant = useMemo(
    () => selectedProduct?.variants.find((v) => v.id === manualLine.variantId),
    [selectedProduct, manualLine.variantId],
  );
  const selectedUnitPrice = (selectedProduct?.priceNgn ?? 0) + (selectedVariant?.extraPriceNgn ?? 0);
  const selectedAvailableStock = selectedVariant?.stock ?? selectedProduct?.stock ?? 0;
  const activeCatalogProduct = activeCatalogIndex >= 0 ? catalogProducts[activeCatalogIndex] : undefined;
  const catalogPageCount = Math.max(1, Math.ceil(catalogTotal / CATALOG_PAGE_SIZE));
  const manualSubtotalNgn = useMemo(
    () => manualLines.reduce((sum, line) => sum + line.unitPriceNgn * line.quantity, 0),
    [manualLines],
  );
  const productByCode = useMemo(
    () => new Map(catalogProducts.map((product) => [product.productCode.trim().toLowerCase(), product])),
    [catalogProducts],
  );
  const manualItemsCount = useMemo(
    () => manualLines.reduce((sum, line) => sum + line.quantity, 0),
    [manualLines],
  );

  const getPrimaryImage = (product?: CatalogProduct | null) => product?.images?.[0]?.imageUrl;

  const validateManualMeta = useCallback(() => {
    const errors: ManualOrderFieldErrors = {};
    if (!manualMeta.shippingHouseNo.trim()) errors.shippingHouseNo = "House number is required.";
    if (!manualMeta.shippingStreet.trim()) errors.shippingStreet = "Street is required.";
    if (!manualMeta.shippingState.trim()) errors.shippingState = "State is required.";
    if (!manualMeta.shippingLga.trim()) errors.shippingLga = "Local government is required.";
    if (!manualMeta.shippingCity.trim()) errors.shippingCity = "City is required.";
    if (!manualMeta.recipientName.trim()) errors.recipientName = "Recipient name is required.";
    if (!manualMeta.recipientPhone.trim()) {
      errors.recipientPhone = "Recipient phone is required.";
    } else if (!isLikelyNgPhone(manualMeta.recipientPhone)) {
      errors.recipientPhone = "Use +234XXXXXXXXXX format.";
    }
    if (!manualMeta.userId.trim() && !manualMeta.guestEmail.trim()) {
      errors.userOrGuest = "Provide customer user id or guest email.";
    }
    if (manualMeta.guestEmail.trim() && !isValidEmail(manualMeta.guestEmail.trim())) {
      errors.guestEmail = "Enter a valid guest email.";
    }
    if (manualMeta.guestPhone.trim() && !isLikelyNgPhone(manualMeta.guestPhone)) {
      errors.guestPhone = "Guest phone must use +234XXXXXXXXXX format.";
    }
    if (manualMeta.paymentMode === "ONLINE_RECONCILED" && !manualMeta.paymentReference.trim()) {
      errors.paymentReference = "Payment reference is required for reconciled payments.";
    }
    if (manualMeta.paymentMode === "CASH") {
      const amt = Number(manualMeta.cashAmountNgn);
      if (!manualMeta.cashAmountNgn.trim() || Number.isNaN(amt) || amt < 1) {
        errors.cashAmountNgn = "Enter the amount received (NGN, minimum 1).";
      }
      if (!manualMeta.cashCollectedBy.trim()) {
        errors.cashCollectedBy = "Enter who collected the cash.";
      }
    }
    return errors;
  }, [manualMeta]);

  const upsertManualLine = useCallback((next: Omit<ManualLine, "quantity"> & { quantity: number }) => {
    setManualLines((prev) => {
      const existing = prev.find((line) => line.key === next.key);
      if (!existing) {
        return [
          ...prev,
          {
            ...next,
            quantity: Math.max(1, Math.min(next.maxStock || 1, next.quantity)),
          },
        ];
      }
      const mergedQty = existing.quantity + next.quantity;
      if (mergedQty > existing.maxStock) {
        return prev;
      }
      return prev.map((line) =>
        line.key === next.key
          ? {
              ...line,
              quantity: mergedQty,
            }
          : line,
      );
    });
  }, []);

  const addManualLine = () => {
    if (!selectedProduct) {
      push({ kind: "error", message: "Choose a product first." });
      return;
    }
    if (selectedAvailableStock < 1) {
      push({ kind: "error", message: "This selection is out of stock." });
      return;
    }
    setIsAddingLine(true);
    const quantity = Math.max(1, manualLine.quantity);
    if (quantity > selectedAvailableStock) {
      push({ kind: "error", message: `Only ${selectedAvailableStock} in stock for this selection.` });
      setIsAddingLine(false);
      return;
    }
    const key = lineKey(selectedProduct.id, manualLine.variantId || undefined);
    upsertManualLine({
      key,
      productId: selectedProduct.id,
      variantId: manualLine.variantId,
      quantity,
      productName: selectedProduct.name,
      productCode: selectedProduct.productCode,
      productSlug: selectedProduct.slug,
      variantLabel: selectedVariant?.label,
      unitPriceNgn: selectedUnitPrice,
      maxStock: selectedAvailableStock,
      imageUrl: getPrimaryImage(selectedProduct),
    });
    setIsAddingLine(false);
  };

  const addDefaultProductLine = useCallback(
    (product: CatalogProduct, quantity: number) => {
      if (product.stock < 1) return false;
      const key = lineKey(product.id);
      upsertManualLine({
        key,
        productId: product.id,
        variantId: "",
        quantity,
        productName: product.name,
        productCode: product.productCode,
        productSlug: product.slug,
        unitPriceNgn: product.priceNgn,
        maxStock: product.stock,
        imageUrl: getPrimaryImage(product),
      });
      return true;
    },
    [upsertManualLine],
  );

  const updateManualLineQuantity = (key: string, nextQty: number) => {
    setManualLines((prev) =>
      prev.map((line) =>
        line.key === key
          ? {
              ...line,
              quantity: Math.max(1, Math.min(line.maxStock || 1, nextQty)),
            }
          : line,
      ),
    );
  };

  const removeManualLine = (key: string) => {
    setManualLines((prev) => prev.filter((line) => line.key !== key));
  };

  const addByCode = async () => {
    const code = quickCode.trim().toLowerCase();
    if (!code) {
      push({ kind: "error", message: "Enter a product code first." });
      return;
    }
    const qty = Math.max(1, quickQuantity);
    const local = productByCode.get(code);
    if (local) {
      const ok = addDefaultProductLine(local, qty);
      if (!ok) push({ kind: "error", message: "That product is out of stock." });
      return;
    }
    try {
      const params = new URLSearchParams({ q: quickCode.trim(), page: "0", pageSize: "1" });
      const response = await fetch(`${apiBase}/api/catalog/products/search?${params.toString()}`);
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as CatalogSearchResponse;
      const product = payload.items?.[0];
      if (!product) {
        push({ kind: "error", message: "No matching product code found." });
        return;
      }
      const ok = addDefaultProductLine(product, qty);
      if (!ok) {
        push({ kind: "error", message: "Matched product is out of stock." });
      } else {
        push({ kind: "success", message: `Added ${product.productCode} to cart.` });
      }
    } catch {
      push({ kind: "error", message: "Could not lookup product code." });
    }
  };

  const addBulkCodes = async () => {
    const lines = bulkCodeInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      push({ kind: "error", message: "Paste at least one product code line." });
      return;
    }
    setIsBulkAdding(true);
    let added = 0;
    let missing = 0;
    for (const row of lines) {
      const match = row.match(/^([A-Za-z0-9-]+)\s*(?:x|,)?\s*(\d+)?$/i);
      const code = (match?.[1] ?? "").trim().toLowerCase();
      const qty = Math.max(1, Number(match?.[2] ?? 1));
      if (!code) continue;
      const product = productByCode.get(code);
      if (!product) {
        missing += 1;
        continue;
      }
      if (addDefaultProductLine(product, qty)) {
        added += 1;
      }
    }
    setIsBulkAdding(false);
    if (added === 0) {
      push({ kind: "error", message: "No pasted codes matched loaded products. Search first, then paste." });
      return;
    }
    push({
      kind: "success",
      message: `Added ${added} codes to cart${missing > 0 ? ` (${missing} not found in current result set)` : ""}.`,
    });
  };

  const applyUpdate = async () => {
    const token = getAdminToken();
    if (!updateFor) return;
    try {
      await adminRequest(token, `/api/admin/orders/${updateFor.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: updateForm.status,
          trackingNumber: updateForm.trackingNumber || undefined,
          deliveryNote: updateForm.deliveryNote || undefined,
        }),
      });
      push({ kind: "success", message: "Order updated." });
      setUpdateFor(null);
      void loadOrders();
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Update failed." });
    }
  };

  const openUpdate = (order: FullOrder) => {
    setUpdateFor(order);
    setUpdateForm({
      status: order.status,
      trackingNumber: order.trackingNumber ?? "",
      deliveryNote: "",
    });
  };

  const submitManualOrder = async () => {
    const token = getAdminToken();
    if (manualLines.length < 1) {
      push({ kind: "error", message: "Add at least one line item." });
      return;
    }
    const errors = validateManualMeta();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      push({ kind: "error", message: "Fix highlighted fields before creating order." });
      return;
    }
    setIsSubmittingOrder(true);
    try {
      const shippingAddress = [
        `${manualMeta.shippingHouseNo.trim()} ${manualMeta.shippingStreet.trim()}`.trim(),
        manualMeta.shippingLga.trim(),
        manualMeta.shippingState.trim(),
        manualMeta.shippingLandmark.trim()
          ? `Landmark: ${manualMeta.shippingLandmark.trim()}`
          : "",
      ]
        .filter(Boolean)
        .join(", ");
      const body: Record<string, unknown> = {
        items: manualLines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          ...(line.variantId ? { variantId: line.variantId } : {}),
        })),
        shippingAddress,
        shippingState: manualMeta.shippingState.trim(),
        shippingCity: manualMeta.shippingCity.trim(),
        recipientName: manualMeta.recipientName.trim(),
        recipientPhone: manualMeta.recipientPhone.trim(),
        paymentMode: manualMeta.paymentMode,
        ...(manualMeta.userId.trim() ? { userId: manualMeta.userId.trim() } : {}),
        ...(manualMeta.guestEmail.trim() ? { guestEmail: manualMeta.guestEmail.trim() } : {}),
        ...(manualMeta.guestPhone.trim() ? { guestPhone: manualMeta.guestPhone.trim() } : {}),
        ...(manualMeta.paymentMode === "ONLINE_RECONCILED"
          ? { paymentReference: manualMeta.paymentReference.trim() }
          : {}),
        ...(manualMeta.paymentMode === "CASH"
          ? {
              cashAmountNgn: Math.max(1, Math.floor(Number(manualMeta.cashAmountNgn) || 0)),
              cashCollectedBy: manualMeta.cashCollectedBy.trim(),
            }
          : {}),
      };
      await adminRequest(token, "/api/admin/orders", { method: "POST", body: JSON.stringify(body) });
      push({ kind: "success", message: "Manual order recorded." });
      setConfirmOpen(false);
      setManualOrderOpen(false);
      setManualLines([]);
      setManualLine({ productId: "", variantId: "", quantity: 1 });
      setCatalogQuery("");
      setCatalogCategory("ALL");
      setCatalogPage(0);
      setQuickCode("");
      setQuickQuantity(1);
      setBulkCodeInput("");
      setFieldErrors({});
      setManualMeta({
        shippingHouseNo: "",
        shippingStreet: "",
        shippingState: "",
        shippingLga: "",
        shippingCity: "",
        shippingLandmark: "",
        recipientName: "",
        recipientPhone: "+234",
        userId: "",
        guestEmail: "",
        guestPhone: "",
        paymentMode: "CASH",
        paymentReference: "",
        cashAmountNgn: "",
        cashCollectedBy: "",
      });
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      void loadOrders();
    } catch (e) {
      push({ kind: "error", message: e instanceof AdminRequestError ? e.message : "Failed to create order." });
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <div className="panel-stack" style={{ paddingTop: "0.35rem" }}>
      {orderDetail ? (
        <SurfaceCard style={{ padding: "1rem" }}>
          <div className="actions-row" style={{ justifyContent: "space-between" }}>
            <h2 className="section-title" style={{ fontSize: "1.2rem", margin: 0 }}>
              Order {orderDetail.id}
            </h2>
            <ActionButton ghost onClick={() => setOrderDetail(null)}>
              Close
            </ActionButton>
          </div>
          <p className="muted">
            {new Date(orderDetail.createdAt).toLocaleString()} · {orderDetail.paymentGateway}
            {orderDetail.paymentReference ? ` · ref ${orderDetail.paymentReference}` : null}
            {orderDetail.cashAmountNgn != null && orderDetail.cashAmountNgn > 0
              ? ` · cash NGN ${orderDetail.cashAmountNgn.toLocaleString()}${orderDetail.cashCollectedBy ? ` · collected by ${orderDetail.cashCollectedBy}` : ""}`
              : null}
          </p>
          <p>
            <strong>Recipient</strong> {orderDetail.recipientName} — {orderDetail.recipientPhone}
          </p>
          <p>
            <strong>Address</strong> {orderDetail.shippingAddress}, {orderDetail.shippingCity}, {orderDetail.shippingState}
          </p>
          <p>
            <strong>Email</strong> {orderDetail.customer?.email ?? orderDetail.guestEmail ?? "—"}{" "}
            {orderDetail.guestPhone ? ` · ${orderDetail.guestPhone}` : null}
          </p>
          <p>
            <strong>Tracking</strong> {orderDetail.trackingNumber ?? "—"}
          </p>
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Code</th>
                  <th>Qty</th>
                  <th>Line total</th>
                </tr>
              </thead>
              <tbody>
                {orderDetail.items.map((line) => (
                  <tr key={line.id}>
                    <td>{line.product.name}</td>
                    <td>{line.product.productCode}</td>
                    <td>{line.quantity}</td>
                    <td>NGN {line.lineTotalNgn.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      ) : null}

      <SurfaceCard style={{ padding: "1rem" }} aria-busy={loading} className="loading-region">
        <div className="actions-row" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="route-eyebrow">Operations</p>
            <h1 className="section-title" style={{ fontSize: "1.42rem" }}>
              Order management
            </h1>
            <p className="section-lead">Search, page, and update fulfillment without browser prompts.</p>
          </div>
          <ActionButton onClick={() => setManualOrderOpen((v) => !v)}>{manualOrderOpen ? "Hide" : "Record manual order"}</ActionButton>
        </div>
        {manualOrderOpen ? (
          <div className="panel-stack" style={{ marginTop: 12 }}>
            <p className="section-lead">
              Build the cart using fast product search, variant selection, and stock-aware quantities.
            </p>
            <div className="order-builder-grid">
              <div className="panel-stack">
                <div className="actions-row">
                  <input
                    ref={catalogSearchRef}
                    className="text-input"
                    aria-label="Search products"
                    placeholder="Search name, code, slug, variant label..."
                    value={catalogQuery}
                    onChange={(e) => setCatalogQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActiveCatalogIndex((prev) => Math.min(catalogProducts.length - 1, Math.max(0, prev + 1)));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActiveCatalogIndex((prev) => Math.max(0, prev - 1));
                      } else if (e.key === "Enter" && activeCatalogProduct) {
                        e.preventDefault();
                        setManualLine((s) => ({ ...s, productId: activeCatalogProduct.id, variantId: "", quantity: 1 }));
                      }
                    }}
                  />
                  <select
                    className="text-input"
                    aria-label="Filter products by category"
                    value={catalogCategory}
                    onChange={(e) => setCatalogCategory(e.target.value)}
                    style={{ maxWidth: 260 }}
                  >
                    <option value="ALL">All categories</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="actions-row">
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="quick-code">Quick add by product code</label>
                    <input
                      id="quick-code"
                      className="text-input"
                      placeholder="SM-CODE123"
                      value={quickCode}
                      onChange={(e) => setQuickCode(e.target.value)}
                    />
                  </div>
                  <div className="field" style={{ width: 120 }}>
                    <label htmlFor="quick-qty">Qty</label>
                    <input
                      id="quick-qty"
                      className="text-input"
                      type="number"
                      min={1}
                      value={quickQuantity}
                      onChange={(e) => setQuickQuantity(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                  <ActionButton ghost onClick={() => void addByCode()}>
                    Find code
                  </ActionButton>
                </div>

                <div className="field">
                  <label htmlFor="bulk-codes">Bulk paste codes (one per line, optional qty: CODE x 2)</label>
                  <textarea
                    id="bulk-codes"
                    className="text-input"
                    rows={3}
                    placeholder={"SM-ITEM123 x 2\nSM-ITEM999 x 1"}
                    value={bulkCodeInput}
                    onChange={(e) => setBulkCodeInput(e.target.value)}
                  />
                  <div>
                    <button type="button" className="chip" onClick={() => void addBulkCodes()} disabled={isBulkAdding}>
                      {isBulkAdding ? "Processing..." : "Parse bulk codes"}
                    </button>
                  </div>
                </div>

                <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                  Showing {catalogProducts.length} of {catalogTotal} products · Page {catalogPage + 1} of {catalogPageCount}
                </p>
                {catalogError ? <p className="form-error">{catalogError}</p> : null}
                <div className="order-catalog-list">
                  {catalogLoading ? (
                    <TableSkeleton rows={3} />
                  ) : catalogProducts.length === 0 ? (
                    <p className="muted" style={{ margin: 0 }}>
                      No catalog matches your search.
                    </p>
                  ) : (
                    catalogProducts.map((product, index) => (
                      <button
                        key={product.id}
                        type="button"
                        className="order-catalog-item"
                        data-selected={manualLine.productId === product.id}
                        aria-pressed={manualLine.productId === product.id}
                        onClick={() => {
                          setManualLine((s) => ({ ...s, productId: product.id, variantId: "", quantity: 1 }));
                          setActiveCatalogIndex(index);
                        }}
                      >
                        <div className="order-item-left">
                          {getPrimaryImage(product) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={getPrimaryImage(product)}
                              alt={`${product.name} thumbnail`}
                              className="order-thumb"
                              width={48}
                              height={48}
                            />
                          ) : (
                            <div className="order-thumb-fallback">No img</div>
                          )}
                          <div>
                            <strong>{product.name}</strong>
                            <div className="muted" style={{ fontSize: "0.8rem" }}>
                              {product.productCode} · Stock {product.stock}
                            </div>
                          </div>
                        </div>
                        <span>{formatNgn(product.priceNgn)}</span>
                      </button>
                    ))
                  )}
                </div>
                <div className="actions-row" style={{ justifyContent: "space-between" }}>
                  <button
                    type="button"
                    className="chip"
                    disabled={catalogPage <= 0 || catalogLoading}
                    onClick={() => setCatalogPage((prev) => Math.max(0, prev - 1))}
                  >
                    Previous page
                  </button>
                  <button
                    type="button"
                    className="chip"
                    disabled={catalogPage + 1 >= catalogPageCount || catalogLoading}
                    onClick={() => setCatalogPage((prev) => prev + 1)}
                  >
                    Next page
                  </button>
                </div>
              </div>

              <div className="panel-stack order-summary-sticky">
                <div className="field">
                  <label htmlFor="selected-product">Selected product</label>
                  <select
                    id="selected-product"
                    className="text-input"
                    value={manualLine.productId}
                    onChange={(e) => setManualLine((s) => ({ ...s, productId: e.target.value, variantId: "" }))}
                  >
                    <option value="">Choose from loaded products</option>
                    {catalogProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.productCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="actions-row">
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="selected-variant">Variant option</label>
                    <select
                      id="selected-variant"
                      className="text-input"
                      value={manualLine.variantId}
                      onChange={(e) => setManualLine((s) => ({ ...s, variantId: e.target.value }))}
                      disabled={!selectedProduct}
                    >
                      <option value="">Default / no variant</option>
                      {selectedProduct?.variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.label} ({variant.stock} left, +{variant.extraPriceNgn.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field" style={{ width: 130 }}>
                    <label htmlFor="selected-quantity">Quantity</label>
                    <input
                      id="selected-quantity"
                      className="text-input"
                      type="number"
                      min={1}
                      max={selectedAvailableStock || undefined}
                      value={manualLine.quantity}
                      onChange={(e) => setManualLine((s) => ({ ...s, quantity: Number(e.target.value) || 1 }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addManualLine();
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="actions-row" style={{ justifyContent: "space-between" }}>
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    Unit price: <strong>{selectedProduct ? formatNgn(selectedUnitPrice) : "NGN 0"}</strong>
                    {" · "}Available: <strong>{selectedAvailableStock}</strong>
                  </div>
                  {selectedProduct ? (
                    <a
                      href={`${storefrontBase.replace(/\/$/, "")}/product/${selectedProduct.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="chip"
                    >
                      View product page
                    </a>
                  ) : null}
                </div>
                <ActionButton onClick={addManualLine} disabled={!selectedProduct || isAddingLine}>
                  {isAddingLine ? "Adding..." : "Add to cart"}
                </ActionButton>
              </div>
            </div>

            {manualLines.length > 0 ? (
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Variant</th>
                      <th>Unit price</th>
                      <th>Qty</th>
                      <th>Line total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {manualLines.map((line) => (
                      <tr key={line.key}>
                        <td>
                          <div className="order-item-left">
                            {line.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={line.imageUrl}
                                alt={`${line.productName} thumbnail`}
                                className="order-thumb"
                                width={40}
                                height={40}
                              />
                            ) : (
                              <div className="order-thumb-fallback small">No img</div>
                            )}
                            <div>
                              <strong>{line.productName}</strong>
                              <div className="muted">{line.productCode}</div>
                            </div>
                          </div>
                        </td>
                        <td>{line.variantLabel ?? "Default"}</td>
                        <td>{formatNgn(line.unitPriceNgn)}</td>
                        <td style={{ width: 150 }}>
                          <input
                            className="text-input"
                            type="number"
                            min={1}
                            max={line.maxStock || undefined}
                            value={line.quantity}
                            onChange={(e) => updateManualLineQuantity(line.key, Number(e.target.value) || 1)}
                          />
                        </td>
                        <td>{formatNgn(line.unitPriceNgn * line.quantity)}</td>
                        <td>
                          <button type="button" className="chip" onClick={() => removeManualLine(line.key)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="actions-row" style={{ justifyContent: "space-between" }}>
              <p className="section-lead" style={{ margin: 0 }}>
                Cart subtotal
              </p>
              <strong style={{ fontSize: "1.05rem" }}>{formatNgn(manualSubtotalNgn)}</strong>
            </div>

            <div className="actions-row">
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="shipping-house-no">House no.</label>
                <input
                  id="shipping-house-no"
                  className={`text-input ${fieldErrors.shippingHouseNo ? "input-invalid" : ""}`}
                  aria-invalid={!!fieldErrors.shippingHouseNo}
                  value={manualMeta.shippingHouseNo}
                  onChange={(e) => setManualMeta((s) => ({ ...s, shippingHouseNo: e.target.value }))}
                />
                {fieldErrors.shippingHouseNo ? <p className="form-error">{fieldErrors.shippingHouseNo}</p> : null}
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="shipping-street">Street</label>
                <input
                  id="shipping-street"
                  className={`text-input ${fieldErrors.shippingStreet ? "input-invalid" : ""}`}
                  aria-invalid={!!fieldErrors.shippingStreet}
                  value={manualMeta.shippingStreet}
                  onChange={(e) => setManualMeta((s) => ({ ...s, shippingStreet: e.target.value }))}
                />
                {fieldErrors.shippingStreet ? <p className="form-error">{fieldErrors.shippingStreet}</p> : null}
              </div>
            </div>
            <div className="actions-row">
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="shipping-state">State</label>
                <select
                  id="shipping-state"
                  className={`text-input ${fieldErrors.shippingState ? "input-invalid" : ""}`}
                  aria-invalid={!!fieldErrors.shippingState}
                  value={manualMeta.shippingState}
                  onChange={(e) =>
                    setManualMeta((s) => ({ ...s, shippingState: e.target.value, shippingLga: "" }))
                  }
                >
                  <option value="">Select state</option>
                  {stateLgaRows.map((row) => (
                    <option key={row.state} value={row.state}>
                      {row.state}
                    </option>
                  ))}
                </select>
                {fieldErrors.shippingState ? <p className="form-error">{fieldErrors.shippingState}</p> : null}
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="shipping-lga">Local government</label>
                <select
                  id="shipping-lga"
                  className={`text-input ${fieldErrors.shippingLga ? "input-invalid" : ""}`}
                  aria-invalid={!!fieldErrors.shippingLga}
                  value={manualMeta.shippingLga}
                  onChange={(e) => setManualMeta((s) => ({ ...s, shippingLga: e.target.value }))}
                >
                  <option value="">Select LGA</option>
                  {(stateLgaRows.find((row) => row.state === manualMeta.shippingState)?.lgas ?? []).map((lga) => (
                    <option key={lga} value={lga}>
                      {lga}
                    </option>
                  ))}
                </select>
                {fieldErrors.shippingLga ? <p className="form-error">{fieldErrors.shippingLga}</p> : null}
              </div>
            </div>
            <div className="actions-row">
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="shipping-city">City / town</label>
                <input
                  id="shipping-city"
                  className={`text-input ${fieldErrors.shippingCity ? "input-invalid" : ""}`}
                  aria-invalid={!!fieldErrors.shippingCity}
                  value={manualMeta.shippingCity}
                  onChange={(e) => setManualMeta((s) => ({ ...s, shippingCity: e.target.value }))}
                />
                {fieldErrors.shippingCity ? <p className="form-error">{fieldErrors.shippingCity}</p> : null}
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="shipping-landmark">Closest landmark (optional)</label>
                <input
                  id="shipping-landmark"
                  className="text-input"
                  value={manualMeta.shippingLandmark}
                  onChange={(e) => setManualMeta((s) => ({ ...s, shippingLandmark: e.target.value }))}
                />
              </div>
            </div>
            <div className="actions-row">
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="recipient-name">Recipient name</label>
                <input
                  id="recipient-name"
                  className={`text-input ${fieldErrors.recipientName ? "input-invalid" : ""}`}
                  aria-invalid={!!fieldErrors.recipientName}
                  value={manualMeta.recipientName}
                  onChange={(e) => setManualMeta((s) => ({ ...s, recipientName: e.target.value }))}
                />
                {fieldErrors.recipientName ? <p className="form-error">{fieldErrors.recipientName}</p> : null}
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="recipient-phone">Phone (+234XXXXXXXXXX)</label>
                <input
                  id="recipient-phone"
                  className={`text-input ${fieldErrors.recipientPhone ? "input-invalid" : ""}`}
                  aria-invalid={!!fieldErrors.recipientPhone}
                  value={manualMeta.recipientPhone}
                  onChange={(e) => setManualMeta((s) => ({ ...s, recipientPhone: e.target.value }))}
                />
                {fieldErrors.recipientPhone ? <p className="form-error">{fieldErrors.recipientPhone}</p> : null}
              </div>
            </div>
            <div className="actions-row">
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="user-id">Customer user id (optional)</label>
                <input
                  id="user-id"
                  className={`text-input ${fieldErrors.userOrGuest ? "input-invalid" : ""}`}
                  aria-invalid={!!fieldErrors.userOrGuest}
                  value={manualMeta.userId}
                  onChange={(e) => setManualMeta((s) => ({ ...s, userId: e.target.value }))}
                  placeholder="Link to registered account"
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="guest-email">Guest email (if no user id)</label>
                <input
                  id="guest-email"
                  className={`text-input ${fieldErrors.guestEmail || fieldErrors.userOrGuest ? "input-invalid" : ""}`}
                  aria-invalid={!!fieldErrors.guestEmail || !!fieldErrors.userOrGuest}
                  value={manualMeta.guestEmail}
                  onChange={(e) => setManualMeta((s) => ({ ...s, guestEmail: e.target.value }))}
                />
              </div>
            </div>
            {fieldErrors.userOrGuest ? <p className="form-error">{fieldErrors.userOrGuest}</p> : null}
            {fieldErrors.guestEmail ? <p className="form-error">{fieldErrors.guestEmail}</p> : null}
            <div className="field">
              <label htmlFor="guest-phone">Guest phone (optional)</label>
              <input
                id="guest-phone"
                className={`text-input ${fieldErrors.guestPhone ? "input-invalid" : ""}`}
                aria-invalid={!!fieldErrors.guestPhone}
                value={manualMeta.guestPhone}
                onChange={(e) => setManualMeta((s) => ({ ...s, guestPhone: e.target.value }))}
              />
              {fieldErrors.guestPhone ? <p className="form-error">{fieldErrors.guestPhone}</p> : null}
            </div>
            <div className="actions-row">
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="payment-mode">Payment</label>
                <select
                  id="payment-mode"
                  className="text-input"
                  value={manualMeta.paymentMode}
                  onChange={(e) =>
                    setManualMeta((s) => ({
                      ...s,
                      paymentMode: e.target.value as "CASH" | "ONLINE_RECONCILED",
                    }))
                  }
                >
                  <option value="CASH">Cash (recorded)</option>
                  <option value="ONLINE_RECONCILED">Online (reconciled)</option>
                </select>
              </div>
              {manualMeta.paymentMode === "ONLINE_RECONCILED" ? (
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="payment-reference">Payment reference</label>
                  <input
                    id="payment-reference"
                    className={`text-input ${fieldErrors.paymentReference ? "input-invalid" : ""}`}
                    aria-invalid={!!fieldErrors.paymentReference}
                    value={manualMeta.paymentReference}
                    onChange={(e) => setManualMeta((s) => ({ ...s, paymentReference: e.target.value }))}
                  />
                  {fieldErrors.paymentReference ? <p className="form-error">{fieldErrors.paymentReference}</p> : null}
                </div>
              ) : null}
            </div>
            {manualMeta.paymentMode === "CASH" ? (
              <div className="actions-row" style={{ flexWrap: "wrap" }}>
                <div className="field" style={{ flex: 1, minWidth: 160 }}>
                  <label htmlFor="cash-amount">Amount received (NGN)</label>
                  <input
                    id="cash-amount"
                    className={`text-input ${fieldErrors.cashAmountNgn ? "input-invalid" : ""}`}
                    aria-invalid={!!fieldErrors.cashAmountNgn}
                    inputMode="numeric"
                    value={manualMeta.cashAmountNgn}
                    onChange={(e) => setManualMeta((s) => ({ ...s, cashAmountNgn: e.target.value }))}
                  />
                  {fieldErrors.cashAmountNgn ? <p className="form-error">{fieldErrors.cashAmountNgn}</p> : null}
                </div>
                <div className="field" style={{ flex: 1, minWidth: 200 }}>
                  <label htmlFor="cash-collector">Collected by (name)</label>
                  <input
                    id="cash-collector"
                    className={`text-input ${fieldErrors.cashCollectedBy ? "input-invalid" : ""}`}
                    aria-invalid={!!fieldErrors.cashCollectedBy}
                    value={manualMeta.cashCollectedBy}
                    onChange={(e) => setManualMeta((s) => ({ ...s, cashCollectedBy: e.target.value }))}
                    placeholder="Staff or agent name"
                  />
                  {fieldErrors.cashCollectedBy ? <p className="form-error">{fieldErrors.cashCollectedBy}</p> : null}
                </div>
              </div>
            ) : null}

            <div className="order-submit-summary">
              <strong>Ready check</strong>
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                {manualItemsCount} items · {formatNgn(manualSubtotalNgn)} subtotal ·{" "}
                {manualMeta.paymentMode === "CASH" ? "Cash" : "Online reconciled"} payment
              </div>
            </div>
            <ActionButton onClick={() => setConfirmOpen(true)} disabled={isSubmittingOrder}>
              {isSubmittingOrder ? "Creating order..." : "Review and create paid order"}
            </ActionButton>
          </div>
        ) : null}
      </SurfaceCard>

      <SurfaceCard style={{ padding: "1rem" }}>
        <div className="actions-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <h2 className="section-title" style={{ fontSize: "1.2rem" }}>
            All orders
          </h2>
          <div className="actions-row">
            <input
              className="text-input"
              style={{ minWidth: 200 }}
              placeholder="Search id, email, ref…"
              value={orderSearchInput}
              onChange={(e) => {
                setPage(0);
                setOrderSearchInput(e.target.value);
              }}
            />
            <select
              className="text-input"
              value={orderStatus}
              onChange={(e) => {
                setPage(0);
                setOrderStatus(e.target.value);
              }}
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="PROCESSING">Processing</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>
        </div>
        {loading ? (
          <TableSkeleton rows={6} />
        ) : orders.length === 0 ? (
          <EmptyState title="No orders found" description="Change filters or search, or check back when new orders arrive." />
        ) : (
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Tracking</th>
                  <th>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.recipientName}</strong>
                      <div className="muted">{order.id.slice(0, 10)}</div>
                    </td>
                    <td>
                      {order.paymentGateway}
                      {order.paymentReference ? <div className="muted" style={{ fontSize: "0.78rem" }}>{order.paymentReference}</div> : null}
                    </td>
                    <td>
                      <StatusPill value={order.status} />
                    </td>
                    <td>{order.trackingNumber ?? <span className="muted">—</span>}</td>
                    <td>NGN {order.totalNgn.toLocaleString()}</td>
                    <td>
                      <div className="actions-row" style={{ flexWrap: "wrap" }}>
                        <button type="button" className="chip" onClick={() => setOrderDetail(order)}>
                          Details
                        </button>
                        <button type="button" className="chip" onClick={() => openUpdate(order)}>
                          Update
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={orderTotal}
              onPageChange={setPage}
              loading={loading}
            />
          </div>
        )}
      </SurfaceCard>

      <AdminDialog
        open={confirmOpen}
        title="Create paid order"
        onClose={() => setConfirmOpen(false)}
        footer={
          <AdminDialogActions
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => void submitManualOrder()}
            confirmLabel={isSubmittingOrder ? "Creating..." : "Create order"}
            confirmDisabled={isSubmittingOrder}
          />
        }
      >
        <div className="panel-stack" style={{ gap: 10 }}>
          <p className="muted" style={{ margin: 0 }}>
            Confirm this summary before writing the order.
          </p>
          <div className="order-submit-summary">
            <strong>{manualItemsCount} total items</strong>
            <div className="muted">{manualLines.length} cart lines</div>
            <div className="muted">Subtotal: {formatNgn(manualSubtotalNgn)}</div>
            <div className="muted">Payment: {manualMeta.paymentMode === "CASH" ? "Cash (recorded)" : "Online reconciled"}</div>
            {manualMeta.paymentMode === "CASH" ? (
              <>
                <div className="muted">
                  Amount: NGN {Number(manualMeta.cashAmountNgn || 0).toLocaleString()} · Collected by:{" "}
                  {manualMeta.cashCollectedBy || "—"}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </AdminDialog>

      <AdminDialog
        open={!!updateFor}
        title="Update order"
        onClose={() => setUpdateFor(null)}
        footer={
          <AdminDialogActions
            onCancel={() => setUpdateFor(null)}
            onConfirm={() => void applyUpdate()}
            confirmLabel="Save changes"
          />
        }
      >
        {updateFor ? (
          <div className="panel-stack" style={{ gap: 10 }}>
            <div className="field">
              <label>Status</label>
              <select
                className="text-input"
                value={updateForm.status}
                onChange={(e) => setUpdateForm((s) => ({ ...s, status: e.target.value }))}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Tracking number (optional)</label>
              <input
                className="text-input"
                value={updateForm.trackingNumber}
                onChange={(e) => setUpdateForm((s) => ({ ...s, trackingNumber: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Internal delivery note (optional)</label>
              <textarea
                className="text-input"
                rows={3}
                value={updateForm.deliveryNote}
                onChange={(e) => setUpdateForm((s) => ({ ...s, deliveryNote: e.target.value }))}
              />
            </div>
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              Order: {updateFor.id}
            </p>
          </div>
        ) : null}
      </AdminDialog>
    </div>
  );
}
