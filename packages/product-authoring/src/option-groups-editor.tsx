/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { ActionButton } from "@sexxymarket/ui";
import type { ProductOptionDraft } from "./types";
import { AuthoringRequestError } from "./api-types";
import { useProductAuthoringApi } from "./authoring-api-context";
import { uploadProductImageFile } from "./product-image-upload";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function OptionGroupsEditor({
  options,
  onChange,
}: {
  options: ProductOptionDraft[];
  onChange: (next: ProductOptionDraft[]) => void;
}) {
  const api = useProductAuthoringApi();
  const optionsRef = useRef(options);
  const [uploadingValueIds, setUploadingValueIds] = useState<string[]>([]);
  const [uploadNotes, setUploadNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const duplicateOptionNames = new Set(
    options
      .map((option) => option.name.trim().toLowerCase())
      .filter(Boolean)
      .filter((name, index, list) => list.indexOf(name) !== index),
  );

  const updateOptions = (next: ProductOptionDraft[]) => {
    optionsRef.current = next;
    onChange(next);
  };

  const patchOptionById = (
    optionId: string,
    updater: (option: ProductOptionDraft) => ProductOptionDraft,
  ) => {
    const next = optionsRef.current.map((option) =>
      option.id === optionId ? updater(option) : option,
    );
    updateOptions(next);
  };

  const patchValueById = (
    optionId: string,
    valueId: string,
    updater: (value: ProductOptionDraft["values"][number]) => ProductOptionDraft["values"][number],
  ) => {
    patchOptionById(optionId, (option) => ({
      ...option,
      values: option.values.map((value) => (value.id === valueId ? updater(value) : value)),
    }));
  };

  const [expandedOptionIds, setExpandedOptionIds] = useState<Set<string>>(() => new Set());

  const toggleOptionExpanded = (optionId: string) => {
    setExpandedOptionIds((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  };

  const addOption = () => {
    const newId = uid("opt");
    updateOptions([
      ...optionsRef.current,
      {
        id: newId,
        name: "",
        displayType: "TEXT",
        guideText: "",
        values: [{ id: uid("val"), value: "", imageUrl: "", storageKey: null, altText: "" }],
      },
    ]);
    setExpandedOptionIds((prev) => new Set(prev).add(newId));
  };

  const addPresetOption = (type: "color" | "size") => {
    const newId = uid("opt");
    const template =
      type === "color"
        ? {
            id: newId,
            name: "Color",
            displayType: "SWATCH" as const,
            guideText: "Select your preferred shade.",
            values: ["Black", "White", "Red", "Blue"].map((value) => ({
              id: uid("val"),
              value,
              imageUrl: "",
              storageKey: null,
              altText: `${value} swatch`,
            })),
          }
        : {
            id: newId,
            name: "Size",
            displayType: "SIZE" as const,
            guideText: "Pick the fit that matches you best.",
            values: ["S", "M", "L", "XL", "XXL"].map((value) => ({
              id: uid("val"),
              value,
              imageUrl: "",
              storageKey: null,
              altText: `${value} size`,
            })),
          };
    updateOptions([...optionsRef.current, template]);
    setExpandedOptionIds((prev) => new Set(prev).add(newId));
  };

  return (
    <div className="panel-stack">
      <div className="actions-row" style={{ justifyContent: "space-between" }}>
        <h3 className="section-title" style={{ fontSize: "1rem", margin: 0 }}>
          Option groups
        </h3>
        <div className="actions-row">
          <ActionButton ghost onClick={() => addPresetOption("color")}>
            Add color preset
          </ActionButton>
          <ActionButton ghost onClick={() => addPresetOption("size")}>
            Add size preset
          </ActionButton>
          <ActionButton ghost onClick={addOption}>
            Add option group
          </ActionButton>
        </div>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
        For visual options like color, add high-quality images per value so buyers can preview the exact look.
      </p>
      <div className="surface-card" style={{ padding: "0.65rem", background: "var(--ui-card-soft)" }}>
        <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
          Quick guides:
        </p>
        <div className="actions-row" style={{ flexWrap: "wrap", marginTop: 6 }}>
          <span className="chip">Color example: Black, White, Red, Nude</span>
          <span className="chip">Size example: S, M, L, XL, XXL</span>
          <span className="chip">Pack example: 1pc, 3pcs, 5pcs</span>
        </div>
      </div>
      {options.map((option, optionIndex) => {
        const isOpen = expandedOptionIds.has(option.id);
        const summaryName = option.name.trim() || `Option group ${optionIndex + 1}`;
        return (
        <div key={option.id} className="surface-card" style={{ padding: "0.8rem" }}>
          <button
            type="button"
            onClick={() => toggleOptionExpanded(option.id)}
            className="text-input"
            style={{
              width: "100%",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              cursor: "pointer",
              marginBottom: isOpen ? 8 : 0,
              background: "var(--ui-surface)",
            }}
          >
            <span>
              <span className="route-eyebrow" style={{ fontSize: "0.68rem", display: "block" }}>
                Option group {optionIndex + 1}
              </span>
              <strong style={{ fontSize: "0.9rem" }}>{summaryName}</strong>
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                {" "}
                · {option.displayType} · {option.values.length} value{option.values.length === 1 ? "" : "s"}
              </span>
            </span>
            <span className="muted" aria-hidden style={{ fontSize: "0.75rem" }}>
              {isOpen ? "Hide" : "Edit"}
            </span>
          </button>
          {isOpen ? (
          <>
          <div className="actions-row">
            <div className="field" style={{ flex: 1 }}>
              <label>Option name</label>
              <input
                className="text-input"
                value={option.name}
                onChange={(e) => patchOptionById(option.id, (current) => ({ ...current, name: e.target.value }))}
              />
              {duplicateOptionNames.has(option.name.trim().toLowerCase()) ? (
                <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--ui-danger)" }}>
                  Duplicate option name. Use unique group names.
                </p>
              ) : null}
            </div>
            <div className="field" style={{ width: 180 }}>
              <label>Display type</label>
              <select
                className="text-input"
                value={option.displayType}
                onChange={(e) =>
                  patchOptionById(option.id, (current) => ({
                    ...current,
                    displayType: e.target.value as ProductOptionDraft["displayType"],
                  }))
                }
              >
                <option value="TEXT">Text</option>
                <option value="SWATCH">Swatch</option>
                <option value="SIZE">Size</option>
                <option value="DIMENSION">Dimension</option>
                <option value="PACK">Pack</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Guide text (shown to buyers)</label>
            <input
              className="text-input"
              value={option.guideText}
              onChange={(e) => patchOptionById(option.id, (current) => ({ ...current, guideText: e.target.value }))}
            />
          </div>
          <div className="panel-stack" style={{ gap: 6 }}>
            {option.values.map((value) => (
              <div key={value.id} className="surface-card" style={{ padding: "0.6rem", background: "var(--ui-card-soft)" }}>
                <div className="actions-row" style={{ alignItems: "flex-start" }}>
                  <div className="field" style={{ flex: 1, minWidth: 220 }}>
                    <label>Value</label>
                    <input
                      className="text-input"
                      placeholder="e.g. Black, XL, 6 inches"
                      value={value.value}
                      onChange={(e) =>
                        patchValueById(option.id, value.id, (current) => ({ ...current, value: e.target.value }))
                      }
                    />
                    {option.values
                      .map((entry) => entry.value.trim().toLowerCase())
                      .filter(Boolean)
                      .filter((entry, index, list) => list.indexOf(entry) !== index)
                      .includes(value.value.trim().toLowerCase()) ? (
                      <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--ui-danger)" }}>
                        Duplicate value in this option group.
                      </p>
                    ) : null}
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 150 }}>
                    <label>Code</label>
                    <input
                      className="text-input"
                      placeholder="Optional SKU code"
                      value={value.code ?? ""}
                      onChange={(e) =>
                        patchValueById(option.id, value.id, (current) => ({ ...current, code: e.target.value }))
                      }
                    />
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 210 }}>
                    <label>Image alt text</label>
                    <input
                      className="text-input"
                      placeholder="Optional accessibility label"
                      value={value.altText ?? ""}
                      onChange={(e) =>
                        patchValueById(option.id, value.id, (current) => ({ ...current, altText: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="actions-row" style={{ marginTop: 8 }}>
                  <label className="chip" style={{ cursor: "pointer" }}>
                    Upload image
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.currentTarget.value = "";
                        if (!file) return;
                        const token = api.getToken();
                        if (!token) {
                          api.toast({ kind: "error", message: "Session missing. Please sign in again." });
                          return;
                        }
                        setUploadingValueIds((prev) => (prev.includes(value.id) ? prev : [...prev, value.id]));
                        setUploadNotes((prev) => ({ ...prev, [value.id]: `Uploading ${file.name}...` }));
                        patchValueById(option.id, value.id, (current) => ({
                          ...current,
                          imageUrl: URL.createObjectURL(file),
                        }));
                        void uploadProductImageFile(token, file, {
                          apiBase: api.getApiBase(),
                          path: api.productImageUploadPath,
                        })
                          .then((uploaded) => {
                            patchValueById(option.id, value.id, (current) => ({
                              ...current,
                              imageUrl: uploaded.url,
                              storageKey: uploaded.key,
                            }));
                            setUploadNotes((prev) => ({ ...prev, [value.id]: `${value.value || "Option value"} image ready` }));
                          })
                          .catch((error) => {
                            const message =
                              error instanceof AuthoringRequestError
                                ? error.message
                                : `Image upload failed for ${value.value || "option value"}.`;
                            setUploadNotes((prev) => ({ ...prev, [value.id]: message }));
                            api.toast({ kind: "error", message });
                          })
                          .finally(() => {
                            setUploadingValueIds((prev) => prev.filter((id) => id !== value.id));
                          });
                      }}
                    />
                  </label>
                  {value.imageUrl ? (
                    <button
                      type="button"
                      className="chip"
                      onClick={() => {
                        patchValueById(option.id, value.id, (current) => ({
                          ...current,
                          imageUrl: "",
                          storageKey: null,
                        }));
                        setUploadNotes((prev) => ({ ...prev, [value.id]: "Image removed" }));
                      }}
                    >
                      Remove image
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="chip"
                    onClick={() => {
                      patchOptionById(option.id, (current) => ({
                        ...current,
                        values: current.values.filter((entry) => entry.id !== value.id),
                      }));
                    }}
                  >
                    Remove value
                  </button>
                  {uploadingValueIds.includes(value.id) ? (
                    <span className="muted" style={{ fontSize: "0.78rem" }}>
                      Uploading...
                    </span>
                  ) : null}
                  {uploadNotes[value.id] ? (
                    <span
                      className="muted"
                      style={{
                        fontSize: "0.76rem",
                        color: uploadNotes[value.id].toLowerCase().includes("failed")
                          ? "var(--ui-danger)"
                          : "var(--ui-muted)",
                      }}
                    >
                      {uploadNotes[value.id]}
                    </span>
                  ) : null}
                </div>
                {value.imageUrl ? (
                  <div style={{ marginTop: 8 }}>
                    <img
                      src={value.imageUrl}
                      alt={value.altText || value.value || "Option preview"}
                      width={58}
                      height={58}
                      style={{ borderRadius: 8, objectFit: "cover", border: "1px solid var(--ui-border)" }}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="actions-row" style={{ marginTop: 8, justifyContent: "space-between" }}>
            <button
              type="button"
              className="chip"
              onClick={() => {
                patchOptionById(option.id, (current) => ({
                  ...current,
                  values: [
                    ...current.values,
                    { id: uid("val"), value: "", imageUrl: "", storageKey: null, altText: "" },
                  ],
                }));
              }}
            >
              Add value
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => {
                updateOptions(optionsRef.current.filter((entry) => entry.id !== option.id));
                setExpandedOptionIds((prev) => {
                  const next = new Set(prev);
                  next.delete(option.id);
                  return next;
                });
              }}
            >
              Remove option group
            </button>
          </div>
          </>
          ) : null}
        </div>
        );
      })}
      {options.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No option group yet. Add Color/Size/Unit groups for configurable products.
        </p>
      ) : null}
    </div>
  );
}
