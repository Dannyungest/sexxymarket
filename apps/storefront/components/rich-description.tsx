"use client";

type RichDoc = {
  blocks?: Array<{
    type?: string;
    text?: string;
    items?: string[];
    bold?: boolean;
    italic?: boolean;
  }>;
};

export function RichDescription({ doc, fallback }: { doc?: RichDoc | null; fallback: string }) {
  const blocks = doc?.blocks?.length ? doc.blocks : null;
  if (!blocks) {
    return <p style={{ margin: 0, color: "var(--ui-muted)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{fallback}</p>;
  }
  return (
    <div className="panel-stack" style={{ gap: 8 }}>
      {blocks.map((block, index) => {
        const textStyle = {
          fontWeight: block.bold ? 700 : undefined,
          fontStyle: block.italic ? "italic" : undefined,
        } as const;
        if (block.type === "heading") {
          return (
            <h3 key={`rich-${index}`} style={{ margin: 0, fontSize: "1.05rem", ...textStyle }}>
              {block.text}
            </h3>
          );
        }
        if (block.type === "bullets") {
          return (
            <ul key={`rich-${index}`} style={{ margin: 0, paddingInlineStart: "1.2rem", ...textStyle }}>
              {(block.items ?? []).filter((item) => item.trim()).map((item, itemIndex) => (
                <li key={`rich-${index}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={`rich-${index}`} style={{ margin: 0, color: "var(--ui-muted)", lineHeight: 1.55, ...textStyle }}>
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

export function VariationGuideTable({
  table,
}: {
  table?: { title: string; headers: string[]; rows: Array<{ label: string; cells: string[] }> } | null;
}) {
  if (!table || !table.rows?.length || !table.headers?.length) return null;
  return (
    <div className="table-wrap">
      <p className="route-eyebrow" style={{ margin: 0 }}>
        {table.title || "Variation table"}
      </p>
      <table className="table" style={{ minWidth: 0, marginTop: 6 }}>
        <thead>
          <tr>
            <th>Size</th>
            {table.headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`${row.label}-${rowIndex}`}>
              <td><strong>{row.label}</strong></td>
              {table.headers.map((_, index) => (
                <td key={`${row.label}-${index}`}>{row.cells[index] ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
