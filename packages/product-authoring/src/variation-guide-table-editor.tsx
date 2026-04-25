"use client";

import { ActionButton } from "@sexxymarket/ui";
import type { VariationGuideTable } from "./types";

const GUIDE_TEMPLATES: Record<string, VariationGuideTable> = {
  apparel: {
    title: "Apparel size chart",
    headers: ["Bust (cm)", "Waist (cm)", "Hip (cm)"],
    rows: [
      { label: "S", cells: ["84-88", "64-68", "90-94"] },
      { label: "M", cells: ["88-92", "68-72", "94-98"] },
      { label: "L", cells: ["92-97", "72-78", "98-104"] },
    ],
  },
  lingerie: {
    title: "Lingerie fit guide",
    headers: ["Underbust (cm)", "Cup", "Hip (cm)"],
    rows: [
      { label: "S", cells: ["68-72", "A/B", "88-94"] },
      { label: "M", cells: ["72-76", "B/C", "94-100"] },
      { label: "L", cells: ["76-82", "C/D", "100-106"] },
    ],
  },
  footwear: {
    title: "Footwear conversion chart",
    headers: ["EU", "UK", "Foot length (cm)"],
    rows: [
      { label: "38", cells: ["38", "5", "24.0"] },
      { label: "39", cells: ["39", "6", "24.6"] },
      { label: "40", cells: ["40", "7", "25.2"] },
    ],
  },
};

function normalizeTable(value?: VariationGuideTable | null): VariationGuideTable {
  return (
    value ?? {
      title: "Size chart",
      headers: ["Bust", "Waist", "Hip"],
      rows: [{ label: "S", cells: ["", "", ""] }],
    }
  );
}

export function VariationGuideTableEditor({
  value,
  onChange,
  onApplySizes,
}: {
  value?: VariationGuideTable | null;
  onChange: (next: VariationGuideTable) => void;
  onApplySizes: (sizes: string[]) => void;
}) {
  const table = normalizeTable(value);
  const sizeRows = table.rows.map((row) => row.label.trim()).filter(Boolean);

  const setCell = (rowIndex: number, cellIndex: number, nextValue: string) => {
    onChange({
      ...table,
      rows: table.rows.map((entry, index) =>
        index === rowIndex
          ? {
              ...entry,
              cells: table.headers.map((_, headerIndex) =>
                headerIndex === cellIndex
                  ? nextValue
                  : entry.cells[headerIndex] ?? "",
              ),
            }
          : entry,
      ),
    });
  };

  return (
    <div className="panel-stack" style={{ gap: 8 }}>
      <div className="actions-row" style={{ justifyContent: "space-between" }}>
        <label style={{ fontWeight: 700, fontSize: "0.9rem" }}>Variation table</label>
        <ActionButton ghost onClick={() => onApplySizes(sizeRows)}>
          Use row labels as Size options
        </ActionButton>
      </div>
      <div className="actions-row">
        <select
          className="text-input"
          defaultValue=""
          onChange={(event) => {
            const key = event.target.value;
            if (!key || !GUIDE_TEMPLATES[key]) return;
            onChange(GUIDE_TEMPLATES[key]);
            event.currentTarget.value = "";
          }}
        >
          <option value="">Apply template...</option>
          <option value="apparel">Apparel</option>
          <option value="lingerie">Lingerie</option>
          <option value="footwear">Footwear</option>
        </select>
        <span className="muted" style={{ fontSize: "0.8rem" }}>
          Size sync preview: {sizeRows.length > 0 ? sizeRows.join(", ") : "No row labels yet"}
        </span>
      </div>
      <input
        className="text-input"
        value={table.title}
        placeholder="Table title"
        onChange={(event) => onChange({ ...table, title: event.target.value })}
      />
      <div className="table-wrap">
        <table className="table" style={{ minWidth: 0 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 110 }}>Size / Label</th>
              {table.headers.map((header, headerIndex) => (
                <th key={`head-${headerIndex}`} style={{ minWidth: 120 }}>
                  <input
                    className="text-input"
                    value={header}
                    placeholder={`Column ${headerIndex + 1}`}
                    onChange={(event) =>
                      onChange({
                        ...table,
                        headers: table.headers.map((entry, index) =>
                          index === headerIndex ? event.target.value : entry,
                        ),
                        rows: table.rows.map((row) => ({
                          ...row,
                          cells:
                            row.cells.length === table.headers.length
                              ? row.cells
                              : [
                                  ...row.cells,
                                  ...Array.from(
                                    { length: table.headers.length - row.cells.length },
                                    () => "",
                                  ),
                                ],
                        })),
                      })
                    }
                  />
                </th>
              ))}
              <th style={{ width: 80 }}>Row</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                <td>
                  <input
                    className="text-input"
                    value={row.label}
                    placeholder="S / M / L"
                    onChange={(event) =>
                      onChange({
                        ...table,
                        rows: table.rows.map((entry, index) =>
                          index === rowIndex
                            ? { ...entry, label: event.target.value }
                            : entry,
                        ),
                      })
                    }
                  />
                </td>
                {table.headers.map((_, columnIndex) => (
                  <td key={`row-${rowIndex}-cell-${columnIndex}`}>
                    <input
                      className="text-input"
                      value={row.cells[columnIndex] ?? ""}
                      placeholder={`Value ${columnIndex + 1}`}
                      onChange={(event) =>
                        setCell(rowIndex, columnIndex, event.target.value)
                      }
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="chip"
                    onClick={() =>
                      onChange({
                        ...table,
                        rows: table.rows.filter((_, index) => index !== rowIndex),
                      })
                    }
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="actions-row">
        <button
          type="button"
          className="chip"
          onClick={() =>
            onChange({
              ...table,
              rows: [...table.rows, { label: "", cells: table.headers.map(() => "") }],
            })
          }
        >
          Add row
        </button>
        <button
          type="button"
          className="chip"
          onClick={() =>
            onChange({
              ...table,
              headers: [...table.headers, `Column ${table.headers.length + 1}`],
              rows: table.rows.map((row) => ({ ...row, cells: [...row.cells, ""] })),
            })
          }
        >
          Add column
        </button>
      </div>
    </div>
  );
}
