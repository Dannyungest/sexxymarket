import { getStoredAdminToken } from "./admin-auth";

export const getAdminApiBase = () => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const REQUEST_TIMEOUT_MS = 12000;
const RETRY_DELAYS_MS = [700, 1500, 2500];

function sleep(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export function getAdminToken(): string {
  return getStoredAdminToken();
}

export class AdminRequestError extends Error {
  constructor(
    public override message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AdminRequestError";
  }
}

/**
 * Fetches a path under the API, e.g. path `/api/auth/me`.
 */
export async function adminRequest<T = unknown>(token: string, path: string, init?: RequestInit): Promise<T> {
  const apiBase = getAdminApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  let response: Response | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      response = await fetchWithTimeout(`${apiBase}${p}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
      if (!shouldRetryStatus(response.status) || attempt === RETRY_DELAYS_MS.length) {
        break;
      }
    } catch {
      if (attempt === RETRY_DELAYS_MS.length) {
        break;
      }
    }
    await sleep(RETRY_DELAYS_MS[attempt]!);
  }
  if (!response) {
    throw new AdminRequestError(
      `Unable to reach API at ${apiBase}. It may be waking up from inactivity; please retry shortly.`,
      503,
    );
  }
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const msg =
      typeof body === "object" && body && "message" in body
        ? Array.isArray((body as { message: unknown }).message)
          ? String((body as { message: unknown[] }).message[0] ?? "Request failed")
          : String((body as { message: unknown }).message)
        : `Request failed (${response.status})`;
    throw new AdminRequestError(msg, response.status, body);
  }
  return body as T;
}
