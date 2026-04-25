/* eslint-disable react-hooks/set-state-in-effect,react-hooks/refs,react-hooks/exhaustive-deps */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton, SurfaceCard } from "@sexxymarket/ui";
import type { AdminListing, Category, ProductReadiness, ProductRevision } from "./api-types";
import { AuthoringRequestError } from "./api-types";
import { useProductAuthoringApi } from "./authoring-api-context";
import { ProductBasicsSection } from "./product-basics-section";
import { MediaUploader } from "./media-uploader";
import { OptionGroupsEditor } from "./option-groups-editor";
import { VariantCombinationsEditor } from "./variant-combinations-editor";
import { GuideHintButton } from "./guide-hint-button";
import type {
  ProductMediaDraft,
  ProductOptionDraft,
  ProductVariantDraft,
  RichDescriptionDoc,
  VariationGuideTable,
} from "./types";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function listingToDraft(listing: AdminListing) {
  const options: ProductOptionDraft[] =
    listing.options?.map((option) => ({
      id: option.id,
      name: option.name,
      displayType: (option.displayType as ProductOptionDraft["displayType"]) ?? "TEXT",
      guideText: option.guideText ?? "",
      values: option.values.map((value) => ({
        id: value.id,
        value: value.value,
        code: value.code ?? undefined,
        imageUrl: value.imageUrl ?? undefined,
        storageKey: value.storageKey ?? null,
        altText: value.altText ?? undefined,
      })),
    })) ?? [];
  const variants: ProductVariantDraft[] = (listing.variants ?? []).map((variant) => ({
    id: variant.id,
    sku: variant.sku ?? "",
    extraPriceNgn: variant.extraPriceNgn,
    stock: variant.stock,
    isActive: variant.isActive ?? true,
    selections:
      variant.optionValues?.map((entry) => ({
        optionName: entry.optionValue.option.name,
        value: entry.optionValue.value,
      })) ?? [],
  }));
  const media: ProductMediaDraft[] = (listing.images ?? []).map((image, index) => ({
    id: image.id ?? uid("media"),
    imageUrl: image.imageUrl,
    storageKey: image.storageKey ?? null,
    altText: image.altText ?? "",
    sortOrder: image.sortOrder ?? index,
    isPrimary: image.isPrimary ?? index === 0,
    variantId: image.variantId ?? undefined,
  }));
  return { options, variants, media };
}

type LifecycleAction = "SAVE_DRAFT" | "SUBMIT_REVIEW" | "PUBLISH" | "AUTOSAVE";
type StageId = "basics" | "media" | "options" | "variants" | "review";

type SectionErrors = Record<StageId, string[]>;

const EMPTY_SECTION_ERRORS: SectionErrors = {
  basics: [],
  media: [],
  options: [],
  variants: [],
  review: [],
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function buildLocalSectionErrors(input: {
  basics: {
    name: string;
    description: string;
    categoryId: string;
    priceNgn: number;
  };
  media: ProductMediaDraft[];
  options: ProductOptionDraft[];
  variants: ProductVariantDraft[];
}): SectionErrors {
  const errors: SectionErrors = {
    basics: [],
    media: [],
    options: [],
    variants: [],
    review: [],
  };

  if (!input.basics.name.trim()) errors.basics.push("Name is required.");
  if (!input.basics.categoryId) errors.basics.push("Category is required.");
  if (!input.basics.description.trim()) errors.basics.push("Description is required.");
  if (input.basics.description.trim().length < 24) {
    errors.basics.push("Description must be at least 24 characters.");
  }
  if (input.basics.priceNgn < 100) {
    errors.basics.push("Base price must be at least 100 NGN.");
  }

  if (input.media.length === 0) {
    errors.media.push("Add at least one product image.");
  }
  const primary = input.media.find((entry) => entry.isPrimary);
  if (!primary) errors.media.push("Select a primary image.");
  if (!primary?.altText?.trim()) {
    errors.media.push("Primary image alt text is required.");
  }

  if (input.options.length === 0) {
    errors.options.push("Add at least one option group (for premium setup).");
  }
  const optionNameSet = new Set<string>();
  input.options.forEach((option) => {
    const optionName = option.name.trim();
    if (!optionName) {
      errors.options.push("Every option group needs a name.");
      return;
    }
    const optionKey = normalizeKey(optionName);
    if (optionNameSet.has(optionKey)) {
      errors.options.push(`Duplicate option group: ${optionName}.`);
    }
    optionNameSet.add(optionKey);
    const valueSet = new Set<string>();
    const filledValues = option.values.filter((entry) => entry.value.trim());
    if (filledValues.length === 0) {
      errors.options.push(`Option "${optionName}" needs at least one value.`);
    }
    filledValues.forEach((value) => {
      const valueKey = normalizeKey(value.value);
      if (valueSet.has(valueKey)) {
        errors.options.push(`Duplicate value "${value.value}" in ${optionName}.`);
      }
      valueSet.add(valueKey);
    });
  });

  if (input.variants.length === 0) {
    errors.variants.push("Add at least one variant combination.");
  }
  const comboSet = new Set<string>();
  const skuSet = new Set<string>();
  input.variants.forEach((variant, index) => {
    if (variant.stock < 0) {
      errors.variants.push(`Variant ${index + 1} stock cannot be negative.`);
    }
    if (!variant.selections.length) {
      errors.variants.push(`Variant ${index + 1} needs at least one option selection.`);
    }
    const invalidSelection = variant.selections.find(
      (selection) => !selection.optionName.trim() || !selection.value.trim(),
    );
    if (invalidSelection) {
      errors.variants.push(`Variant ${index + 1} has incomplete selections.`);
    }
    const comboKey = variant.selections
      .map((selection) => `${normalizeKey(selection.optionName)}:${normalizeKey(selection.value)}`)
      .sort()
      .join("|");
    if (comboKey && comboSet.has(comboKey)) {
      errors.variants.push(`Variant ${index + 1} duplicates another combination.`);
    }
    comboSet.add(comboKey);
    const sku = variant.sku.trim();
    if (sku) {
      if (!/^[a-z0-9][a-z0-9._-]{2,79}$/i.test(sku)) {
        errors.variants.push(`Variant ${index + 1} SKU format is invalid.`);
      }
      const skuKey = normalizeKey(sku);
      if (skuSet.has(skuKey)) {
        errors.variants.push(`Variant ${index + 1} SKU duplicates another variant.`);
      }
      skuSet.add(skuKey);
    }
  });

  return {
    basics: Array.from(new Set(errors.basics)),
    media: Array.from(new Set(errors.media)),
    options: Array.from(new Set(errors.options)),
    variants: Array.from(new Set(errors.variants)),
    review: Array.from(new Set(errors.review)),
  };
}

export function ProductAuthoringStudio({
  productId,
  productsListHref = "/products",
}: {
  productId?: string;
  productsListHref?: string;
}) {
  const router = useRouter();
  const api = useProductAuthoringApi();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [revisions, setRevisions] = useState<ProductRevision[]>([]);
  const [editingProduct, setEditingProduct] = useState<AdminListing | null>(null);
  const [authoringErrors, setAuthoringErrors] = useState<string[]>([]);
  const [basics, setBasics] = useState({
    name: "",
    slug: "",
    description: "",
    descriptionRich: null as RichDescriptionDoc | null,
    variationGuide: "",
    variationGuideTable: null as VariationGuideTable | null,
    priceNgn: 1000,
    stock: 0,
    categoryId: "",
  });
  const [media, setMedia] = useState<ProductMediaDraft[]>([]);
  const [options, setOptions] = useState<ProductOptionDraft[]>([]);
  const [variants, setVariants] = useState<ProductVariantDraft[]>([]);
  const [openStage, setOpenStage] = useState<StageId>("basics");
  const [readiness, setReadiness] = useState<ProductReadiness | null>(null);
  const [validatingReadiness, setValidatingReadiness] = useState(false);
  const snapshotRef = useRef("");
  const autosaveRef = useRef<number | null>(null);

  const draftStorageKey = useMemo(
    () => `admin-product-draft-${productId ?? "new"}`,
    [productId],
  );

  const hydrateFromListing = useCallback((listing: AdminListing) => {
    setEditingProduct(listing);
    setCategorySearch(listing.category?.name ?? "");
    setBasics({
      name: listing.name,
      slug: listing.slug,
      description: listing.description,
      descriptionRich: (listing.descriptionRich as RichDescriptionDoc | null) ?? null,
      variationGuide: listing.variationGuide ?? "",
      variationGuideTable: (listing.variationGuideTable as VariationGuideTable | null) ?? null,
      priceNgn: listing.priceNgn,
      stock: listing.stock,
      categoryId: listing.categoryId,
    });
    const draft = listingToDraft(listing);
    setOptions(draft.options);
    setVariants(draft.variants);
    setMedia(draft.media);
  }, []);

  const load = useCallback(async () => {
    const token = api.getToken();
    if (!token) return;
    setLoading(true);
    try {
      const [categoryResponse, listingResponse] = await Promise.all([
        fetch(`${api.getApiBase().replace(/\/$/, "")}/api/catalog/categories`),
        productId ? api.getProductById(productId) : Promise.resolve(null),
      ]);
      if (categoryResponse.ok) {
        setCategories((await categoryResponse.json()) as Category[]);
      }
      if (listingResponse) {
        hydrateFromListing(listingResponse);
        const revisionList = await api.request<ProductRevision[]>(
          `/api/catalog/products/${listingResponse.id}/revisions`,
        );
        setRevisions(Array.isArray(revisionList) ? revisionList : []);
      } else {
        const saved = localStorage.getItem(draftStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as {
            basics: typeof basics;
            media: ProductMediaDraft[];
            options: ProductOptionDraft[];
            variants: ProductVariantDraft[];
          };
          setBasics(parsed.basics);
          setMedia(parsed.media);
          setOptions(parsed.options);
          setVariants(parsed.variants);
        }
      }
    } catch (error) {
      api.toast({
        kind: "error",
        message: error instanceof AuthoringRequestError ? error.message : "Failed to load authoring studio.",
      });
    } finally {
      setLoading(false);
    }
  }, [api, draftStorageKey, hydrateFromListing, productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const applySizesFromGuide = (sizes: string[]) => {
    const normalized = Array.from(new Set(sizes.map((item) => item.trim()).filter(Boolean)));
    if (normalized.length === 0) return;
    setOptions((prev) => {
      const existingIndex = prev.findIndex((option) => option.displayType === "SIZE" || option.name.trim().toLowerCase() === "size");
      const sizeOption: ProductOptionDraft = {
        id: existingIndex >= 0 ? prev[existingIndex].id : uid("opt"),
        name: existingIndex >= 0 ? prev[existingIndex].name : "Size",
        displayType: "SIZE",
        guideText: existingIndex >= 0 ? prev[existingIndex].guideText : "Select preferred size",
        values: normalized.map((size) => {
          const existingValue = existingIndex >= 0 ? prev[existingIndex].values.find((entry) => entry.value.trim().toLowerCase() === size.toLowerCase()) : undefined;
          return {
            id: existingValue?.id ?? uid("val"),
            value: size,
            code: existingValue?.code ?? undefined,
            imageUrl: existingValue?.imageUrl ?? "",
            storageKey: existingValue?.storageKey ?? null,
            altText: existingValue?.altText ?? "",
          };
        }),
      };
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = sizeOption;
        return next;
      }
      return [...prev, sizeOption];
    });
  };

  const buildPayload = (lifecycleAction: LifecycleAction) => {
    const slug =
      basics.slug.trim() ||
      basics.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    return {
      name: basics.name.trim(),
      slug,
      description: basics.description.trim(),
      descriptionRich: basics.descriptionRich ?? undefined,
      variationGuide: basics.variationGuide.trim() || undefined,
      variationGuideTable: basics.variationGuideTable ?? undefined,
      priceNgn: basics.priceNgn,
      stock: basics.stock,
      categoryId: basics.categoryId,
      requiresManualApproval: false,
      lifecycleAction,
      autosaveCheckpointId: `${Date.now()}`,
      autosaveVersion: editingProduct?.autosaveVersion ?? 0,
      media: media.map((item, index) => ({
        imageUrl: item.imageUrl,
        storageKey: item.storageKey,
        altText: item.altText,
        sortOrder: index,
        isPrimary: item.isPrimary,
        variantId: item.variantId,
      })),
      options: options
        .filter((option) => option.name.trim().length > 0)
        .map((option, optionIndex) => ({
          name: option.name.trim(),
          displayType: option.displayType,
          guideText: option.guideText.trim() || undefined,
          sortOrder: optionIndex,
          values: option.values
            .map((value, valueIndex) => ({
              value: value.value.trim(),
              code: value.code?.trim() || undefined,
              imageUrl: value.imageUrl || undefined,
              storageKey: value.storageKey || undefined,
              altText: value.altText?.trim() || undefined,
              sortOrder: valueIndex,
            }))
            .filter((value) => value.value),
        })),
      variants: variants.map((variant) => ({
        sku: variant.sku.trim() || undefined,
        extraPriceNgn: variant.extraPriceNgn,
        stock: variant.stock,
        isActive: variant.isActive,
        selections: variant.selections.filter((selection) => selection.optionName.trim() && selection.value.trim()),
      })),
    };
  };

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        basics,
        media,
        options,
        variants,
      }),
    [basics, media, options, variants],
  );
  const isDirty = snapshotRef.current !== "" && snapshotRef.current !== currentSnapshot;

  useEffect(() => {
    if (!loading && snapshotRef.current === "") {
      snapshotRef.current = currentSnapshot;
    }
  }, [currentSnapshot, loading]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const save = async (lifecycleAction: LifecycleAction, silent = false) => {
    const token = api.getToken();
    if (!token) {
      api.toast({ kind: "error", message: "Session missing. Please sign in again." });
      return;
    }
    try {
      setSaving(true);
      const payload = buildPayload(lifecycleAction);
      const response = productId
        ? await api.request<AdminListing>(`/api/catalog/products/${productId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await api.request<AdminListing>("/api/catalog/products", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      snapshotRef.current = currentSnapshot;
      localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          basics,
          media,
          options,
          variants,
        }),
      );
      if (!silent) {
        api.toast({
          kind: "success",
          message:
            lifecycleAction === "PUBLISH"
              ? "Product published."
              : lifecycleAction === "SUBMIT_REVIEW"
                ? "Product moved to review."
                : "Draft saved.",
        });
      }
      setEditingProduct(response);
      if (!productId) {
        const base = productsListHref.replace(/\/$/, "");
        router.push(`${base}/${response.id}/edit`);
      } else {
        const revisionList = await api.request<ProductRevision[]>(
          `/api/catalog/products/${response.id}/revisions`,
        );
        setRevisions(Array.isArray(revisionList) ? revisionList : []);
      }
      setAuthoringErrors([]);
    } catch (error) {
      const details =
        error instanceof AuthoringRequestError && typeof error.details === "object" && error.details
          ? (error.details as { errors?: Array<{ message?: string }> })
          : null;
      const errors = details?.errors?.map((entry) => entry.message ?? "").filter(Boolean) ?? [];
      setAuthoringErrors(errors);
      api.toast({
        kind: "error",
        message: error instanceof AuthoringRequestError ? error.message : "Unable to save product.",
      });
    } finally {
      setSaving(false);
    }
  };

  const previewReadiness = useCallback(async (silent = true) => {
    const token = api.getToken();
    if (!token) return null;
    try {
      setValidatingReadiness(true);
      const payload = buildPayload("AUTOSAVE");
      const query = editingProduct?.authoringStatus
        ? `?currentStatus=${editingProduct.authoringStatus}`
        : "";
      const response = await api.request<ProductReadiness>(
        `/api/catalog/products/readiness/preview${query}`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      setReadiness(response);
      if (!silent) {
        api.toast({
          kind: response.canPublish ? "success" : "error",
          message: response.canPublish
            ? "Validation passed: ready to publish."
            : "Validation found blockers. Resolve highlighted issues.",
        });
      }
      return response;
    } catch (error) {
      if (!silent) {
        api.toast({
          kind: "error",
          message:
            error instanceof AuthoringRequestError
              ? error.message
              : "Unable to run validation.",
        });
      }
      return null;
    } finally {
      setValidatingReadiness(false);
    }
  }, [api, buildPayload, editingProduct?.authoringStatus]);

  useEffect(() => {
    if (loading) return;
    if (autosaveRef.current) window.clearInterval(autosaveRef.current);
    autosaveRef.current = window.setInterval(() => {
      localStorage.setItem(
        draftStorageKey,
        JSON.stringify({ basics, media, options, variants }),
      );
      if (productId && isDirty) {
        void save("AUTOSAVE", true);
      }
    }, 20000);
    return () => {
      if (autosaveRef.current) window.clearInterval(autosaveRef.current);
    };
  }, [basics, draftStorageKey, isDirty, loading, media, options, productId, variants]);

  useEffect(() => {
    if (loading) return;
    const timer = window.setTimeout(() => {
      void previewReadiness(true);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [basics, loading, media, options, previewReadiness, variants]);

  const rollbackToRevision = async (revisionId: string) => {
    const token = api.getToken();
    if (!token || !editingProduct) return;
    try {
      const restored = await api.request<AdminListing>(`/api/catalog/products/${editingProduct.id}/rollback`, {
        method: "POST",
        body: JSON.stringify({ revisionId }),
      });
      hydrateFromListing(restored);
      snapshotRef.current = JSON.stringify({
        basics: {
          name: restored.name,
          slug: restored.slug,
          description: restored.description,
          descriptionRich: (restored.descriptionRich as RichDescriptionDoc | null) ?? null,
          variationGuide: restored.variationGuide ?? "",
          variationGuideTable: (restored.variationGuideTable as VariationGuideTable | null) ?? null,
          priceNgn: restored.priceNgn,
          stock: restored.stock,
          categoryId: restored.categoryId,
        },
        media: listingToDraft(restored).media,
        options: listingToDraft(restored).options,
        variants: listingToDraft(restored).variants,
      });
      api.toast({ kind: "success", message: "Rolled back to selected revision." });
    } catch (error) {
      api.toast({
        kind: "error",
        message: error instanceof AuthoringRequestError ? error.message : "Rollback failed.",
      });
    }
  };

  const stages = useMemo(
    () =>
      [
        { id: "basics" as const, title: "Basics" },
        { id: "media" as const, title: "Media" },
        { id: "options" as const, title: "Color & Size" },
        { id: "variants" as const, title: "Variants" },
        { id: "review" as const, title: "Review" },
      ] satisfies Array<{ id: StageId; title: string }>,
    [],
  );
  const completion = useMemo(
    () => {
      const localErrors = buildLocalSectionErrors({
        basics,
        media,
        options,
        variants,
      });
      return {
        basics:
          localErrors.basics.length === 0 &&
          (readiness?.statuses.basics ?? true),
        media:
          localErrors.media.length === 0 &&
          (readiness?.statuses.media ?? true),
        options:
          localErrors.options.length === 0 &&
          (readiness?.statuses.options ?? true),
        variants:
          localErrors.variants.length === 0 &&
          (readiness?.statuses.variants ?? true),
        review:
          localErrors.basics.length === 0 &&
          localErrors.media.length === 0 &&
          localErrors.options.length === 0 &&
          localErrors.variants.length === 0 &&
          authoringErrors.length === 0 &&
          readiness?.statuses.review === true,
      };
    },
    [authoringErrors.length, basics, media, options, readiness?.statuses, variants],
  );
  const sectionErrors = useMemo(() => {
    const local = buildLocalSectionErrors({ basics, media, options, variants });
    if (!readiness) return local;
    const merge = (a: string[], b: string[]) => Array.from(new Set([...a, ...b]));
    return {
      basics: merge(local.basics, readiness.errors.basics),
      media: merge(local.media, readiness.errors.media),
      options: merge(local.options, readiness.errors.options),
      variants: merge(local.variants, readiness.errors.variants),
      review: merge(local.review, readiness.errors.review),
    };
  }, [basics, media, options, readiness, variants]);
  const completedCount = stages.filter((stage) => completion[stage.id]).length;

  const goToNextStage = (current: StageId) => {
    const index = stages.findIndex((stage) => stage.id === current);
    const next = stages[index + 1];
    if (next) setOpenStage(next.id);
  };
  const unlockedStages = useMemo(() => {
    const unlocked: StageId[] = ["basics"];
    if (completion.basics) unlocked.push("media");
    if (completion.basics && completion.media) unlocked.push("options");
    if (completion.basics && completion.media && completion.options) {
      unlocked.push("variants");
    }
    if (
      completion.basics &&
      completion.media &&
      completion.options &&
      completion.variants
    ) {
      unlocked.push("review");
    }
    return unlocked;
  }, [completion]);

  return (
    <div className="panel-stack">
      <SurfaceCard style={{ padding: "1rem" }}>
        <div className="actions-row" style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <div>
            <p className="route-eyebrow" style={{ margin: 0 }}>
              Focused authoring
            </p>
            <h1 className="section-title" style={{ marginTop: 4, marginBottom: 0 }}>
              {productId ? "Edit product" : "Create product"}
            </h1>
          </div>
          <ActionButton ghost onClick={() => router.push(productsListHref)}>
            Back to products
          </ActionButton>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Complete each section to unlock the next stage, then publish with confidence.
        </p>
        <div className="actions-row" style={{ marginTop: 8, flexWrap: "wrap" }}>
          {stages.map((stage, index) => (
            <button
              key={stage.id}
              type="button"
              className="chip"
              aria-pressed={openStage === stage.id}
              disabled={!unlockedStages.includes(stage.id)}
              onClick={() => {
                if (!unlockedStages.includes(stage.id)) return;
                setOpenStage(stage.id);
              }}
            >
              {index + 1}. {stage.title} {completion[stage.id] ? "✓" : ""}
            </button>
          ))}
          <span className="muted" style={{ marginLeft: "auto" }}>
            Progress: {completedCount}/{stages.length}
          </span>
        </div>
      </SurfaceCard>

      <SurfaceCard style={{ padding: "0.9rem" }}>
        <div
          className="actions-row"
          style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: 8 }}
        >
          <h3 className="section-title" style={{ margin: 0, fontSize: "1rem" }}>
            1. Product basics
          </h3>
          <div className="actions-row" style={{ flexWrap: "wrap" }}>
            <GuideHintButton
              label="Guide"
              title="Product name, description, and category"
            >
              <p style={{ margin: 0 }}>Use a clear title and a rich description: headings, short paragraphs, and bullet lists. Minimum length applies for publishing.</p>
              <p style={{ margin: 0 }}>Pick the right category; slug can be left blank to auto-generate. Base price and stock are your defaults before variant overrides.</p>
            </GuideHintButton>
            {completion.basics ? (
              <span className="chip">Completed</span>
            ) : (
              <span className="chip">In progress</span>
            )}
            <ActionButton ghost onClick={() => setOpenStage("basics")}>
              {openStage === "basics" ? "Open" : "Edit"}
            </ActionButton>
          </div>
        </div>
        {openStage === "basics" ? (
          <>
            <div style={{ marginTop: 10 }}>
              <ProductBasicsSection
                categories={categories}
                value={basics}
                categorySearch={categorySearch}
                onCategorySearchChange={setCategorySearch}
                onApplySizesFromGuide={applySizesFromGuide}
                onChange={(next) => setBasics((prev) => ({ ...prev, ...next }))}
              />
            </div>
            <div className="actions-row" style={{ marginTop: 8, justifyContent: "flex-end" }}>
              <ActionButton
                ghost
                onClick={() => goToNextStage("basics")}
                disabled={!completion.basics}
              >
                Complete basics & continue
              </ActionButton>
            </div>
            {sectionErrors.basics.length > 0 ? (
              <ul style={{ margin: "0.4rem 0 0", paddingInlineStart: "1rem" }}>
                {sectionErrors.basics.slice(0, 3).map((error) => (
                  <li key={error} style={{ fontSize: "0.82rem", color: "var(--ui-danger)" }}>{error}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </SurfaceCard>

      <SurfaceCard style={{ padding: "0.9rem" }}>
        <div
          className="actions-row"
          style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: 8 }}
        >
          <h3 className="section-title" style={{ margin: 0, fontSize: "1rem" }}>
            2. Media
          </h3>
          <div className="actions-row" style={{ flexWrap: "wrap" }}>
            <GuideHintButton label="Guide" title="Product images">
              <p style={{ margin: 0 }}>Add at least one high-quality image. Set one as primary; link extras to a variant if needed (e.g. color swatch).</p>
              <p style={{ margin: 0 }}>Alt text helps accessibility and search — describe what the shopper sees, not the file name.</p>
            </GuideHintButton>
            {completion.media ? (
              <span className="chip">Completed</span>
            ) : (
              <span className="chip">In progress</span>
            )}
            <ActionButton ghost onClick={() => setOpenStage("media")}>
              {openStage === "media" ? "Open" : "Edit"}
            </ActionButton>
          </div>
        </div>
        {openStage === "media" ? (
          <>
            <div style={{ marginTop: 10 }}>
              <MediaUploader media={media} onChange={setMedia} />
            </div>
            <div className="actions-row" style={{ marginTop: 8, justifyContent: "flex-end" }}>
              <ActionButton
                ghost
                onClick={() => goToNextStage("media")}
                disabled={!completion.media}
              >
                Complete media & continue
              </ActionButton>
            </div>
            {sectionErrors.media.length > 0 ? (
              <ul style={{ margin: "0.4rem 0 0", paddingInlineStart: "1rem" }}>
                {sectionErrors.media.slice(0, 3).map((error) => (
                  <li key={error} style={{ fontSize: "0.82rem", color: "var(--ui-danger)" }}>{error}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </SurfaceCard>

      <SurfaceCard style={{ padding: "0.9rem" }}>
        <div
          className="actions-row"
          style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: 8 }}
        >
          <h3 className="section-title" style={{ margin: 0, fontSize: "1rem" }}>
            3. Color & size options
          </h3>
          <div className="actions-row" style={{ flexWrap: "wrap" }}>
            <GuideHintButton label="Guide" title="Option groups (color, size, pack)">
              <p style={{ margin: 0 }}>Each <strong>option group</strong> is one dimension (e.g. Color, Size). Shoppers pick one value per group.</p>
              <p style={{ margin: 0 }}>Use <strong>Swatch</strong> for colors with images; <strong>Size</strong> for fit labels. Open a group to edit; presets add common color or size value sets.</p>
              <p style={{ margin: 0 }}>Avoid duplicate group names or duplicate values in the same group — they will block publish.</p>
            </GuideHintButton>
            {completion.options ? (
              <span className="chip">Completed</span>
            ) : (
              <span className="chip">In progress</span>
            )}
            <ActionButton ghost onClick={() => setOpenStage("options")}>
              {openStage === "options" ? "Open" : "Edit"}
            </ActionButton>
          </div>
        </div>
        {openStage === "options" ? (
          <>
            <div style={{ marginTop: 10 }}>
              <OptionGroupsEditor options={options} onChange={setOptions} />
            </div>
            <div className="actions-row" style={{ marginTop: 8, justifyContent: "flex-end" }}>
              <ActionButton
                ghost
                onClick={() => goToNextStage("options")}
                disabled={!completion.options}
              >
                Complete options & continue
              </ActionButton>
            </div>
            {sectionErrors.options.length > 0 ? (
              <ul style={{ margin: "0.4rem 0 0", paddingInlineStart: "1rem" }}>
                {sectionErrors.options.slice(0, 3).map((error) => (
                  <li key={error} style={{ fontSize: "0.82rem", color: "var(--ui-danger)" }}>{error}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </SurfaceCard>

      <SurfaceCard style={{ padding: "0.9rem" }}>
        <div
          className="actions-row"
          style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: 8 }}
        >
          <h3 className="section-title" style={{ margin: 0, fontSize: "1rem" }}>
            4. Variant combinations
          </h3>
          <div className="actions-row" style={{ flexWrap: "wrap" }}>
            <GuideHintButton
              label="Guide"
              title="Variants, SKUs, and bulk apply"
            >
              <p style={{ margin: 0 }}>Each row is one sellable combination (e.g. Red + M). Use <em>Generate combinations</em> after your option groups are filled.</p>
              <p style={{ margin: 0 }}>Then use bulk fields + <em>Apply to all</em> for a fast first pass, and edit individual rows for exceptions.</p>
            </GuideHintButton>
            {completion.variants ? (
              <span className="chip">Completed</span>
            ) : (
              <span className="chip">In progress</span>
            )}
            <ActionButton ghost onClick={() => setOpenStage("variants")}>
              {openStage === "variants" ? "Open" : "Edit"}
            </ActionButton>
          </div>
        </div>
        {openStage === "variants" ? (
          <>
            <div style={{ marginTop: 10 }}>
              <VariantCombinationsEditor options={options} variants={variants} onChange={setVariants} />
            </div>
            <div className="actions-row" style={{ marginTop: 8, justifyContent: "flex-end" }}>
              <ActionButton
                ghost
                onClick={() => goToNextStage("variants")}
                disabled={!completion.variants}
              >
                Complete variants & continue
              </ActionButton>
            </div>
            {sectionErrors.variants.length > 0 ? (
              <ul style={{ margin: "0.4rem 0 0", paddingInlineStart: "1rem" }}>
                {sectionErrors.variants.slice(0, 3).map((error) => (
                  <li key={error} style={{ fontSize: "0.82rem", color: "var(--ui-danger)" }}>{error}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </SurfaceCard>

      <SurfaceCard style={{ padding: "0.9rem" }}>
        <div
          className="actions-row"
          style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: 8 }}
        >
          <h3 className="section-title" style={{ margin: 0, fontSize: "1rem" }}>
            5. Review and publish
          </h3>
          <div className="actions-row" style={{ flexWrap: "wrap" }}>
            <GuideHintButton label="Guide" title="Review, submit, and publish">
              <p style={{ margin: 0 }}>Use <strong>Validate</strong> to see readiness and blockers. <strong>Submit review</strong> when the catalog team should moderate.</p>
              <p style={{ margin: 0 }}><strong>Publish</strong> is only available when the backend reports the listing as ready. Fix any listed errors, then try again.</p>
            </GuideHintButton>
            <ActionButton ghost onClick={() => setOpenStage("review")}>
              {openStage === "review" ? "Open" : "Edit"}
            </ActionButton>
          </div>
        </div>
        {openStage === "review" ? (
          <div style={{ marginTop: 10 }}>
            <p className="muted" style={{ marginTop: 0 }}>
              Confirm details before publishing.
            </p>
            <div className="actions-row" style={{ flexWrap: "wrap" }}>
              <span className="chip">Name: {basics.name || "Missing"}</span>
              <span className="chip">Category: {basics.categoryId ? "Selected" : "Missing"}</span>
              <span className="chip">Media: {media.length}</span>
              <span className="chip">Options: {options.length}</span>
              <span className="chip">Variants: {variants.length}</span>
            </div>
            <div style={{ marginTop: 8 }}>
              {Object.entries(sectionErrors)
                .flatMap(([, list]) => list)
                .slice(0, 8)
                .map((error) => (
                  <p key={error} style={{ margin: 0, fontSize: "0.82rem", color: "var(--ui-danger)" }}>
                    - {error}
                  </p>
                ))}
            </div>
          </div>
        ) : null}
      </SurfaceCard>

      {revisions.length > 0 ? (
        <SurfaceCard style={{ padding: "0.9rem" }}>
          <h3 className="section-title" style={{ marginTop: 0, fontSize: "1rem" }}>
            Revision history
          </h3>
          <div className="panel-stack" style={{ gap: 6 }}>
            {revisions.map((revision) => (
              <div key={revision.id} className="actions-row" style={{ justifyContent: "space-between" }}>
                <span className="muted">
                  #{revision.revisionNumber} - {revision.action}
                </span>
                <ActionButton ghost onClick={() => void rollbackToRevision(revision.id)}>
                  Rollback
                </ActionButton>
              </div>
            ))}
          </div>
        </SurfaceCard>
      ) : null}

      {authoringErrors.length > 0 ? (
        <SurfaceCard style={{ padding: "0.8rem", border: "1px solid var(--ui-danger)" }}>
          <div role="alert">
          <p style={{ margin: 0, fontWeight: 700 }}>Please resolve the following errors:</p>
          <ul style={{ marginBottom: 0 }}>
            {authoringErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
          </div>
        </SurfaceCard>
      ) : null}

      <div
        className="surface-card"
        style={{
          position: "sticky",
          bottom: 12,
          zIndex: 30,
          padding: "0.75rem",
          border: "1px solid var(--ui-border)",
        }}
      >
        <div className="actions-row" style={{ justifyContent: "space-between" }}>
          <span className="muted">{isDirty ? "Unsaved changes" : "All changes saved"}</span>
          <div className="actions-row">
            <ActionButton ghost isLoading={saving} onClick={() => void save("SAVE_DRAFT")}>
              Save draft
            </ActionButton>
            <ActionButton
              ghost
              isLoading={saving}
              disabled={!readiness?.canSubmitReview}
              onClick={() => void save("SUBMIT_REVIEW")}
            >
              Submit review
            </ActionButton>
            <ActionButton ghost isLoading={validatingReadiness} onClick={() => void previewReadiness(false)}>
              {validatingReadiness ? "Validating..." : "Validate"}
            </ActionButton>
            <ActionButton
              isLoading={saving}
              disabled={!readiness?.canPublish}
              loadingText="Publishing..."
              onClick={() => void save("PUBLISH")}
            >
              Publish
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
