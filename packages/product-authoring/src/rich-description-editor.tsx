"use client";

import type { KeyboardEvent } from "react";
import { ActionButton } from "@sexxymarket/ui";
import type { RichDescriptionBlock, RichDescriptionDoc } from "./types";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeDoc(input?: RichDescriptionDoc | null): RichDescriptionDoc {
  if (!input?.blocks?.length) {
    return { blocks: [{ id: uid("blk"), type: "paragraph", text: "" }] };
  }
  return {
    blocks: input.blocks.map((block) => ({
      ...block,
      id: block.id || uid("blk"),
      items: block.type === "bullets" ? block.items ?? [""] : undefined,
    })),
  };
}

export function RichDescriptionEditor({
  value,
  onChange,
}: {
  value?: RichDescriptionDoc | null;
  onChange: (next: RichDescriptionDoc) => void;
}) {
  const doc = normalizeDoc(value);

  const patchBlock = (blockId: string, updater: (block: RichDescriptionBlock) => RichDescriptionBlock) => {
    onChange({
      blocks: doc.blocks.map((block) => (block.id === blockId ? updater(block) : block)),
    });
  };

  const removeBlock = (blockId: string) => {
    const next = doc.blocks.filter((block) => block.id !== blockId);
    onChange({ blocks: next.length > 0 ? next : [{ id: uid("blk"), type: "paragraph", text: "" }] });
  };

  const moveBlock = (blockId: string, direction: -1 | 1) => {
    const i = doc.blocks.findIndex((block) => block.id === blockId);
    if (i < 0) return;
    const j = i + direction;
    if (j < 0 || j >= doc.blocks.length) return;
    const next = [...doc.blocks];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange({ blocks: next });
  };

  const addBlock = (type: RichDescriptionBlock["type"]) => {
    onChange({
      blocks: [
        ...doc.blocks,
        {
          id: uid("blk"),
          type,
          text: "",
          items: type === "bullets" ? [""] : undefined,
          bold: false,
        },
      ],
    });
  };

  const handleKeyboardFormatShortcut = (
    event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
    blockId: string,
  ) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      patchBlock(blockId, (current) => ({
        ...current,
        bold: !current.bold,
      }));
    }
    if (key === "i") {
      event.preventDefault();
      patchBlock(blockId, (current) => ({
        ...current,
        italic: !current.italic,
      }));
    }
  };

  return (
    <div className="panel-stack" style={{ gap: 8 }}>
      <div className="actions-row" style={{ justifyContent: "space-between" }}>
        <label style={{ fontWeight: 700, fontSize: "0.9rem" }}>Description studio *</label>
        <div className="actions-row">
          <ActionButton ghost onClick={() => addBlock("heading")}>Add heading</ActionButton>
          <ActionButton ghost onClick={() => addBlock("paragraph")}>Add paragraph</ActionButton>
          <ActionButton ghost onClick={() => addBlock("bullets")}>Add bullets</ActionButton>
        </div>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
        Use toolbar controls or shortcuts: <strong>Ctrl/Cmd+B</strong> for bold, <strong>Ctrl/Cmd+I</strong> for italic.
      </p>
      {doc.blocks.map((block) => (
        <div key={block.id} className="surface-card" style={{ padding: "0.65rem", background: "var(--ui-card-soft)" }}>
          <div className="actions-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <div className="actions-row">
              <strong style={{ fontSize: "0.84rem" }}>{block.type.toUpperCase()}</strong>
              <button
                type="button"
                className="chip"
                aria-pressed={!!block.bold}
                onClick={() =>
                  patchBlock(block.id, (current) => ({
                    ...current,
                    bold: !current.bold,
                  }))
                }
              >
                B
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={!!block.italic}
                onClick={() =>
                  patchBlock(block.id, (current) => ({
                    ...current,
                    italic: !current.italic,
                  }))
                }
              >
                I
              </button>
              <select
                className="text-input"
                style={{ minWidth: 140 }}
                value={block.type}
                onChange={(event) =>
                  patchBlock(block.id, (current) => ({
                    ...current,
                    type: event.target.value as RichDescriptionBlock["type"],
                    items:
                      event.target.value === "bullets"
                        ? (current.items?.length ? current.items : [""])
                        : undefined,
                  }))
                }
              >
                <option value="heading">Heading</option>
                <option value="paragraph">Paragraph</option>
                <option value="bullets">Bullets</option>
              </select>
            </div>
            <div className="actions-row" style={{ gap: 4 }}>
              <button
                type="button"
                className="chip"
                title="Move up"
                aria-label="Move block up"
                disabled={doc.blocks.findIndex((b) => b.id === block.id) === 0}
                onClick={() => moveBlock(block.id, -1)}
              >
                Up
              </button>
              <button
                type="button"
                className="chip"
                title="Move down"
                aria-label="Move block down"
                disabled={doc.blocks.findIndex((b) => b.id === block.id) === doc.blocks.length - 1}
                onClick={() => moveBlock(block.id, 1)}
              >
                Down
              </button>
              <button type="button" className="chip" onClick={() => removeBlock(block.id)}>
                Remove
              </button>
            </div>
          </div>
          {block.type === "bullets" ? (
            <div className="panel-stack" style={{ gap: 6, marginTop: 6 }}>
              {(block.items ?? [""]).map((item, itemIndex) => (
                <input
                  key={`${block.id}-${itemIndex}`}
                  className="text-input"
                  value={item}
                  placeholder={`Bullet ${itemIndex + 1}`}
                  onKeyDown={(event) => handleKeyboardFormatShortcut(event, block.id)}
                  onChange={(event) =>
                    patchBlock(block.id, (current) => ({
                      ...current,
                      items: (current.items ?? [""]).map((entry, index) =>
                        index === itemIndex ? event.target.value : entry,
                      ),
                    }))
                  }
                />
              ))}
              <div>
                <button
                  type="button"
                  className="chip"
                  onClick={() =>
                    patchBlock(block.id, (current) => ({
                      ...current,
                      items: [...(current.items ?? []), ""],
                    }))
                  }
                >
                  Add bullet
                </button>
              </div>
            </div>
          ) : (
            <textarea
              className="text-input"
              rows={block.type === "heading" ? 2 : 4}
              style={{ marginTop: 6 }}
              value={block.text ?? ""}
              placeholder={block.type === "heading" ? "Heading text" : "Write content"}
              onKeyDown={(event) => handleKeyboardFormatShortcut(event, block.id)}
              onChange={(event) =>
                patchBlock(block.id, (current) => ({
                  ...current,
                  text: event.target.value,
                }))
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function RichDescriptionPreview({ value }: { value?: RichDescriptionDoc | null }) {
  const doc = normalizeDoc(value);
  return (
    <div className="panel-stack" style={{ gap: 8 }}>
      {doc.blocks.map((block) => {
        const textStyle = {
          fontWeight: block.bold ? 700 : undefined,
          fontStyle: block.italic ? "italic" : undefined,
        } as const;
        if (block.type === "heading") {
          return (
            <h4 key={block.id} style={{ margin: 0, ...textStyle }}>
              {block.text || "Heading preview"}
            </h4>
          );
        }
        if (block.type === "bullets") {
          return (
            <ul key={block.id} style={{ margin: 0, paddingInlineStart: "1.1rem", ...textStyle }}>
              {(block.items ?? []).filter((item) => item.trim()).map((item, index) => (
                <li key={`${block.id}-item-${index}`}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={block.id} style={{ margin: 0, color: "var(--ui-muted)", lineHeight: 1.55, ...textStyle }}>
            {block.text || "Paragraph preview"}
          </p>
        );
      })}
    </div>
  );
}
