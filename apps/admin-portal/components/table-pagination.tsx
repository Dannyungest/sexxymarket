"use client";

import { ActionButton } from "@sexxymarket/ui";

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  loading,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (next: number) => void;
  loading?: boolean;
}) {
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="data-table-footer">
      <span>
        Showing {from}–{to} of {total}
      </span>
      <div className="actions-row">
        <ActionButton
          type="button"
          ghost
          disabled={loading || page <= 0}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </ActionButton>
        <span className="muted" style={{ minWidth: 48, textAlign: "center" }}>
          {page + 1} / {lastPage + 1 || 1}
        </span>
        <ActionButton
          type="button"
          ghost
          disabled={loading || page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </ActionButton>
      </div>
    </div>
  );
}
