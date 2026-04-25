"use client";

import { ActionButton } from "@sexxymarket/ui";
import type { ProductOptionDraft, ProductVariantDraft } from "./types";
import { useMemo, useState } from "react";
import { GuideHintButton } from "./guide-hint-button";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildSelectionTemplate(options: ProductOptionDraft[]) {
  return options
    .filter((option) => option.name.trim() && option.values.length > 0)
    .map((option) => ({
      optionName: option.name.trim(),
      value: option.values[0]?.value ?? "",
    }));
}

function generateSelectionCombinations(options: ProductOptionDraft[]) {
  const optionDefs = options
    .filter((option) => option.name.trim() && option.values.some((value) => value.value.trim()))
    .map((option) => ({
      optionName: option.name.trim(),
      values: option.values.map((value) => value.value.trim()).filter(Boolean),
    }));
  if (optionDefs.length === 0) return [];
  let combinations: Array<Array<{ optionName: string; value: string }>> = [[]];
  optionDefs.forEach((definition) => {
    combinations = combinations.flatMap((current) =>
      definition.values.map((value) => [...current, { optionName: definition.optionName, value }]),
    );
  });
  return combinations;
}

export function VariantCombinationsEditor({
  options,
  variants,
  onChange,
}: {
  options: ProductOptionDraft[];
  variants: ProductVariantDraft[];
  onChange: (next: ProductVariantDraft[]) => void;
}) {
  const [bulkStock, setBulkStock] = useState("0");
  const [bulkExtraPrice, setBulkExtraPrice] = useState("0");
  const [bulkPrefix, setBulkPrefix] = useState("");

  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    variants.forEach((variant) => {
      const key = variant.selections
        .map((selection) => `${selection.optionName.toLowerCase()}:${selection.value.toLowerCase()}`)
        .sort()
        .join("|");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return new Set(Array.from(counts.entries()).filter((entry) => entry[1] > 1).map((entry) => entry[0]));
  }, [variants]);
  const duplicateSkuSet = useMemo(() => {
    const counts = new Map<string, number>();
    variants.forEach((variant) => {
      const sku = variant.sku.trim().toLowerCase();
      if (!sku) return;
      counts.set(sku, (counts.get(sku) ?? 0) + 1);
    });
    return new Set(Array.from(counts.entries()).filter((entry) => entry[1] > 1).map((entry) => entry[0]));
  }, [variants]);

  const generateAll = () => {
    const combos = generateSelectionCombinations(options);
    if (combos.length === 0) return;
    const existingKeys = new Set(
      variants.map((variant) =>
        variant.selections
          .map((selection) => `${selection.optionName.toLowerCase()}:${selection.value.toLowerCase()}`)
          .sort()
          .join("|"),
      ),
    );
    const created = combos
      .filter((combo) => {
        const key = combo
          .map((selection) => `${selection.optionName.toLowerCase()}:${selection.value.toLowerCase()}`)
          .sort()
          .join("|");
        return !existingKeys.has(key);
      })
      .map((combo) => ({
        id: uid("var"),
        sku: "",
        extraPriceNgn: 0,
        stock: 0,
        isActive: true,
        selections: combo,
      }));
    if (created.length === 0) return;
    onChange([...variants, ...created]);
  };

  const addVariant = () => {
    onChange([
      ...variants,
      {
        id: uid("var"),
        sku: "",
        extraPriceNgn: 0,
        stock: 0,
        isActive: true,
        selections: buildSelectionTemplate(options),
      },
    ]);
  };

  const applyBulk = () => {
    const stock = Math.max(0, Number(bulkStock) || 0);
    const extra = Number(bulkExtraPrice) || 0;
    onChange(
      variants.map((variant, index) => ({
        ...variant,
        stock,
        extraPriceNgn: extra,
        sku: bulkPrefix.trim() ? `${bulkPrefix.trim()}-${index + 1}` : variant.sku,
      })),
    );
  };

  return (
    <div className="panel-stack">
      <div className="actions-row" style={{ justifyContent: "space-between" }}>
        <h3 className="section-title" style={{ fontSize: "1rem", margin: 0 }}>
          Variant combinations
        </h3>
        <div className="actions-row">
          <ActionButton ghost onClick={generateAll}>
            Generate combinations
          </ActionButton>
          <ActionButton ghost onClick={addVariant}>
            Add combination
          </ActionButton>
        </div>
      </div>
      <div className="surface-card" style={{ padding: "0.7rem" }}>
        <div className="actions-row" style={{ marginBottom: 8, flexWrap: "wrap" }}>
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem", flex: "1 1 200px" }}>
            Bulk-apply stock, extra price, and optional SKU prefix to every variant row.
          </p>
          <GuideHintButton
            label="How this works"
            title="Variant workflow: generate, bulk-apply, then fine-tune"
          >
            <p style={{ margin: 0 }}>
              <strong>Step 1 — Build option groups</strong> in the previous step (e.g. Color × Size) with clear value names.
            </p>
            <p style={{ margin: 0 }}>
              <strong>Step 2 — Generate combinations</strong> creates one row per unique mix (e.g. Red + M, Red + L). If you
              add combinations manually, each row should match a unique selection set.
            </p>
            <p style={{ margin: 0 }}>
              <strong>Step 3 — Bulk apply (optional):</strong> set <em>Bulk stock</em> to e.g. <code>12</code>,{" "}
              <em>Bulk extra price</em> to add on top of base price (e.g. <code>500</code> for premium sizes), and{" "}
              <em>SKU prefix</em> such as <code>LUX-</code>. Click <em>Apply to all</em> to fill every row — SKUs become{" "}
              <code>LUX-1</code>, <code>LUX-2</code>, etc.
            </p>
            <p style={{ margin: 0 }}>
              <strong>Step 4 — Fine-tune</strong> per row: fix stock for slow movers, adjust extra price, or set explicit SKUs
              before publish.
            </p>
          </GuideHintButton>
        </div>
        <div className="actions-row" style={{ flexWrap: "wrap" }}>
          <div className="field" style={{ width: 130 }}>
            <label>Bulk stock</label>
            <input className="text-input" value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} type="number" min={0} />
          </div>
          <div className="field" style={{ width: 160 }}>
            <label>Bulk extra price</label>
            <input className="text-input" value={bulkExtraPrice} onChange={(e) => setBulkExtraPrice(e.target.value)} type="number" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>SKU prefix (optional)</label>
            <input className="text-input" value={bulkPrefix} onChange={(e) => setBulkPrefix(e.target.value)} />
          </div>
          <ActionButton ghost onClick={applyBulk}>
            Apply to all
          </ActionButton>
        </div>
      </div>
      {variants.map((variant, variantIndex) => (
        <div key={variant.id} className="surface-card" style={{ padding: "0.8rem" }}>
          <div className="actions-row" style={{ justifyContent: "space-between" }}>
            <strong style={{ fontSize: "0.85rem" }}>Variant #{variantIndex + 1}</strong>
            {duplicateKeys.has(
              variant.selections
                .map((selection) => `${selection.optionName.toLowerCase()}:${selection.value.toLowerCase()}`)
                .sort()
                .join("|"),
            ) ? (
              <span className="chip" style={{ color: "var(--ui-danger)" }}>
                Conflict: duplicate combination
              </span>
            ) : (
              <span className="chip">Valid</span>
            )}
          </div>
          <div className="actions-row">
            <div className="field" style={{ flex: 1 }}>
              <label>SKU</label>
              <input
                className="text-input"
                value={variant.sku}
                onChange={(e) => {
                  const next = [...variants];
                  next[variantIndex] = { ...variant, sku: e.target.value };
                  onChange(next);
                }}
              />
              {variant.sku.trim() && !/^[a-z0-9][a-z0-9._-]{2,79}$/i.test(variant.sku.trim()) ? (
                <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--ui-danger)" }}>
                  SKU must be 3-80 chars using letters, numbers, dot, underscore, or dash.
                </p>
              ) : null}
              {duplicateSkuSet.has(variant.sku.trim().toLowerCase()) ? (
                <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--ui-danger)" }}>
                  Duplicate SKU detected.
                </p>
              ) : null}
            </div>
            <div className="field" style={{ width: 150 }}>
              <label>Extra price (NGN)</label>
              <input
                type="number"
                className="text-input"
                value={variant.extraPriceNgn}
                onChange={(e) => {
                  const next = [...variants];
                  next[variantIndex] = { ...variant, extraPriceNgn: Number(e.target.value) || 0 };
                  onChange(next);
                }}
              />
            </div>
            <div className="field" style={{ width: 130 }}>
              <label>Stock</label>
              <input
                type="number"
                className="text-input"
                value={variant.stock}
                min={0}
                onChange={(e) => {
                  const next = [...variants];
                  next[variantIndex] = { ...variant, stock: Math.max(0, Number(e.target.value) || 0) };
                  onChange(next);
                }}
              />
            </div>
          </div>
          <div className="panel-stack" style={{ gap: 6 }}>
            {variant.selections.map((selection, selectionIndex) => {
              const option = options.find((entry) => entry.name.trim() === selection.optionName);
              return (
                <div key={`${selection.optionName}-${selectionIndex}`} className="actions-row">
                  <div className="field" style={{ flex: 1, minWidth: 180 }}>
                    <label>{selection.optionName}</label>
                    <select
                      className="text-input"
                      value={selection.value}
                      onChange={(e) => {
                        const next = [...variants];
                        const selections = [...variant.selections];
                        selections[selectionIndex] = { ...selection, value: e.target.value };
                        next[variantIndex] = { ...variant, selections };
                        onChange(next);
                      }}
                    >
                      {(option?.values ?? []).map((value) => (
                        <option key={value.id} value={value.value}>
                          {value.value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="actions-row" style={{ justifyContent: "space-between", marginTop: 8 }}>
            <label className="actions-row" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={variant.isActive}
                onChange={(e) => {
                  const next = [...variants];
                  next[variantIndex] = { ...variant, isActive: e.target.checked };
                  onChange(next);
                }}
              />
              Active
            </label>
            <button
              type="button"
              className="chip"
              onClick={() => onChange(variants.filter((_, idx) => idx !== variantIndex))}
            >
              Remove combination
            </button>
          </div>
        </div>
      ))}
      {variants.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No variants configured. For single-option products, you can publish without combinations.
        </p>
      ) : null}
    </div>
  );
}
