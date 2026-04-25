"use client";

import { useEffect, useState } from "react";
import type { Category } from "./api-types";
import type { RichDescriptionDoc, VariationGuideTable } from "./types";
import { RichDescriptionEditor, RichDescriptionPreview } from "./rich-description-editor";
import { VariationGuideTableEditor } from "./variation-guide-table-editor";

export function ProductBasicsSection({
  categories,
  value,
  categorySearch,
  onCategorySearchChange,
  onApplySizesFromGuide,
  onChange,
}: {
  categories: Category[];
  value: {
    name: string;
    slug: string;
    description: string;
    descriptionRich?: RichDescriptionDoc | null;
    variationGuide: string;
    variationGuideTable?: VariationGuideTable | null;
    priceNgn: number;
    stock: number;
    categoryId: string;
  };
  categorySearch: string;
  onCategorySearchChange: (next: string) => void;
  onApplySizesFromGuide: (sizes: string[]) => void;
  onChange: (next: Partial<typeof value>) => void;
}) {
  const [guideOpen, setGuideOpen] = useState(
    Boolean(value.variationGuide?.trim() || value.variationGuideTable),
  );

  useEffect(() => {
    if (value.variationGuide?.trim() || value.variationGuideTable) {
      setGuideOpen(true);
    }
  }, [value.variationGuide, value.variationGuideTable]);

  return (
    <div className="panel-stack">
      <div className="field">
        <label>Name *</label>
        <input className="text-input" value={value.name} onChange={(e) => onChange({ name: e.target.value })} />
        <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>
          Use a clear luxury storefront title shoppers can trust.
        </p>
      </div>
      <div className="field">
        <label>Slug (optional)</label>
        <input className="text-input" value={value.slug} onChange={(e) => onChange({ slug: e.target.value })} />
        <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>
          Leave empty to auto-generate from name.
        </p>
      </div>
      <div className="field">
        <label>Description *</label>
        <RichDescriptionEditor
          value={value.descriptionRich}
          onChange={(next) => {
            const plain = next.blocks
              .flatMap((block) => (block.type === "bullets" ? block.items ?? [] : [block.text ?? ""]))
              .map((entry) => entry.trim())
              .filter(Boolean)
              .join("\n");
            onChange({ descriptionRich: next, description: plain });
          }}
        />
        <div className="surface-card" style={{ padding: "0.7rem", background: "var(--ui-card-soft)" }}>
          <p className="muted" style={{ margin: "0 0 0.35rem", fontSize: "0.8rem" }}>
            Storefront preview
          </p>
          <RichDescriptionPreview value={value.descriptionRich} />
        </div>
        <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>
          Description length: {value.description.trim().length} characters (minimum 24 for publish).
        </p>
      </div>
      <div className="field">
        <div className="actions-row" style={{ justifyContent: "space-between" }}>
          <label style={{ margin: 0 }}>Variation guide (optional)</label>
          <button
            type="button"
            className="chip"
            onClick={() => {
              const nextOpen = !guideOpen;
              setGuideOpen(nextOpen);
              if (!nextOpen) {
                onChange({ variationGuide: "", variationGuideTable: null });
              }
            }}
          >
            {guideOpen ? "Hide size guide" : "Add size guide"}
          </button>
        </div>
        {guideOpen ? (
          <div className="panel-stack" style={{ gap: 8 }}>
            <textarea
              className="text-input"
              rows={3}
              value={value.variationGuide}
              onChange={(e) => onChange({ variationGuide: e.target.value })}
              placeholder="Optional notes for fit, measurement method, or fabric stretch"
            />
            <VariationGuideTableEditor
              value={value.variationGuideTable}
              onApplySizes={onApplySizesFromGuide}
              onChange={(next) => onChange({ variationGuideTable: next })}
            />
          </div>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
            Keep this hidden when you do not need size guidance.
          </p>
        )}
      </div>
      <div className="actions-row">
        <div className="field" style={{ flex: 1 }}>
          <label>Base price (NGN)</label>
          <input
            type="number"
            className="text-input"
            min={100}
            value={value.priceNgn}
            onChange={(e) => onChange({ priceNgn: Number(e.target.value) || 0 })}
          />
          <p className="muted" style={{ margin: 0, fontSize: "0.76rem" }}>
            Minimum publishable base price: 100 NGN.
          </p>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Base stock (for non-variant products)</label>
          <input
            type="number"
            className="text-input"
            min={0}
            value={value.stock}
            onChange={(e) => onChange({ stock: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Category *</label>
          <input
            className="text-input"
            placeholder="Search category"
            value={categorySearch}
            onChange={(e) => onCategorySearchChange(e.target.value)}
          />
          <select className="text-input" value={value.categoryId} onChange={(e) => onChange({ categoryId: e.target.value })}>
            <option value="">Select category</option>
            {(categorySearch.trim() ? categories.filter((c) => c.name.toLowerCase().includes(categorySearch.toLowerCase())) : categories).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
