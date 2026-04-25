export function StatusPill({
  value,
}: {
  value: string;
}) {
  const normalized = value.toUpperCase();
  const variant =
    normalized === "APPROVED" ||
    normalized === "DELIVERED" ||
    normalized === "PAID" ||
    normalized === "ACTIVE"
      ? "success"
      : normalized === "REJECTED" ||
          normalized === "BLACKLISTED" ||
          normalized === "CANCELLED" ||
          normalized === "REFUNDED" ||
          normalized === "BLOCKED" ||
          normalized === "INACTIVE"
        ? "danger"
        : "warn";

  return <span className={`status-pill ${variant}`}>{normalized}</span>;
}
