/**
 * Prevents open redirects: only same-origin path-style strings are allowed.
 */
export function safeReturnPath(raw: string | null | undefined, fallback: string): string {
  if (!raw || typeof raw !== "string") return fallback;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//") || t.includes("://")) return fallback;
  if (t.includes("\0") || t.includes("\\")) return fallback;
  return t;
}
