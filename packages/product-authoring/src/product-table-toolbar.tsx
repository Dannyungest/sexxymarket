"use client";

export function ProductTableToolbar({
  query,
  categoryId,
  status,
  stockState,
  onChange,
  categories,
}: {
  query: string;
  categoryId: string;
  status: string;
  stockState: string;
  onChange: (next: Partial<{ query: string; categoryId: string; status: string; stockState: string }>) => void;
  categories: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="actions-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
      <input
        className="text-input"
        placeholder="Search by code, slug, name..."
        style={{ minWidth: 220 }}
        value={query}
        onChange={(e) => onChange({ query: e.target.value })}
      />
      <div className="actions-row">
        <select className="text-input" value={categoryId} onChange={(e) => onChange({ categoryId: e.target.value })}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select className="text-input" value={status} onChange={(e) => onChange({ status: e.target.value })}>
          <option value="">All statuses</option>
          <option value="VISIBLE">Visible</option>
          <option value="HIDDEN">Hidden</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select className="text-input" value={stockState} onChange={(e) => onChange({ stockState: e.target.value })}>
          <option value="">All stock</option>
          <option value="IN">In stock</option>
          <option value="LOW">Low stock</option>
          <option value="OUT">Out of stock</option>
        </select>
      </div>
    </div>
  );
}
