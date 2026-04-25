import { fallbackCategories } from "./fallback-data";
import type { Category, Product, Review, ReviewEligibility, ReviewSummary } from "./storefront-types";

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
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

function messageFromErrorBody(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const m = (body as { message: unknown }).message;
    if (Array.isArray(m) && m.length) return m.map(String).join(" ");
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${apiBase}/api${path}`;
  let response: Response | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      response = await fetchWithTimeout(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
        cache: "no-store",
      });
      if (!shouldRetryStatus(response.status) || attempt === RETRY_DELAYS_MS.length) {
        break;
      }
    } catch (error) {
      if (attempt === RETRY_DELAYS_MS.length) {
        break;
      }
    }
    await sleep(RETRY_DELAYS_MS[attempt]!);
  }
  if (!response) {
    throw new Error(
      `Unable to reach API at ${apiBase}. It may be waking up from inactivity; please retry in a few seconds.`,
    );
  }
  if (!response.ok) {
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    throw new Error(messageFromErrorBody(body, `Request failed (${response.status}): ${path}`));
  }
  return (await response.json()) as T;
}

export async function getProducts(): Promise<Product[]> {
  try {
    return await fetchJson<Product[]>("/catalog/products");
  } catch {
    return [];
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    return await fetchJson<Category[]>("/catalog/categories");
  } catch {
    return fallbackCategories;
  }
}

export async function getProduct(idOrSlug: string): Promise<Product | null> {
  try {
    return await fetchJson<Product>(`/catalog/products/${idOrSlug}`);
  } catch {
    return null;
  }
}

export async function getReviews(productId: string): Promise<Review[]> {
  try {
    return await fetchJson<Review[]>(`/reviews/product/${productId}`);
  } catch {
    return [];
  }
}

export async function getReviewSummary(productId: string): Promise<ReviewSummary> {
  try {
    return await fetchJson<ReviewSummary>(`/reviews/product/${productId}/summary`);
  } catch {
    return { averageRating: 0, totalReviews: 0 };
  }
}

export async function getEligibility(productId: string, token: string): Promise<ReviewEligibility> {
  return fetchJson<ReviewEligibility>(`/reviews/eligibility/${productId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function submitReview(
  payload: { productId: string; orderId: string; rating: number; comment: string },
  token: string,
) {
  return fetchJson("/reviews", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean;
  mustChangePassword: boolean;
};

export async function login(payload: { email: string; password: string }) {
  return fetchJson<{
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function register(payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}) {
  return fetchJson<{ success: boolean; message: string; email: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyEmail(token: string) {
  return fetchJson<{
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  }>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function resendVerification(accessToken: string) {
  return fetchJson<{ success: boolean; message: string }>("/auth/resend-verification", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function getMe(accessToken: string) {
  return fetchJson<AuthUser & { firstName: string; lastName: string; phone?: string | null }>("/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function changePassword(
  accessToken: string,
  payload: { currentPassword: string; newPassword: string },
) {
  return fetchJson<{
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  }>("/auth/change-password", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
}

export async function requestPasswordReset(email: string) {
  return fetchJson<{ success: boolean; message: string }>("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(payload: {
  email: string;
  code: string;
  newPassword: string;
}) {
  return fetchJson<{ success: boolean; message: string }>("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createOrder(
  payload: {
    items: Array<{ productId: string; quantity: number; variantId?: string }>;
    shippingAddress: string;
    shippingState: string;
    shippingCity: string;
    recipientName: string;
    recipientPhone: string;
    guestEmail?: string;
    guestPhone?: string;
  },
  token?: string,
) {
  let response: Response | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      response = await fetchWithTimeout(`${apiBase}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        cache: "no-store",
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
    throw new Error(
      `Unable to reach API at ${apiBase}. It may be waking up from inactivity; please retry in a few seconds.`,
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
    const msg = messageFromErrorBody(body, `Order could not be created (${response.status})`);
    throw new Error(msg);
  }
  return body as { paymentLink?: string; id: string; paymentReference?: string | null };
}

export type PublicOrderReceipt = {
  id: string;
  status: "PENDING" | "PAID" | "PROCESSING" | "DELIVERED" | "CANCELLED" | "REFUNDED";
  paymentReference: string | null;
  totalNgn: number;
  subtotalNgn: number;
  deliveryFeeNgn: number;
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  shippingState: string;
  shippingCity: string;
  trackingNumber: string | null;
  createdAt: string;
  items: {
    name: string;
    imageUrl: string;
    quantity: number;
    lineTotalNgn: number;
    variantLabel: string | null;
  }[];
};

export async function getOrderReceiptByTxRef(txRef: string) {
  const q = encodeURIComponent(txRef.trim());
  return fetchJson<PublicOrderReceipt>(`/orders/receipt?txRef=${q}`);
}

export type SavedRecipient = {
  id: string;
  userId: string;
  label: string | null;
  recipientName: string;
  recipientPhone: string;
  houseNo: string;
  street: string;
  landmark: string;
  shippingState: string;
  shippingLga: string;
  shippingCity: string;
  createdAt: string;
  updatedAt: string;
};

function fetchJsonAuthed<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  return fetchJson<T>(path, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
    },
  });
}

export function listSavedRecipients(token: string) {
  return fetchJsonAuthed<SavedRecipient[]>("/saved-recipients", token);
}

export function createSavedRecipient(
  token: string,
  payload: {
    label?: string;
    recipientName: string;
    recipientPhone: string;
    houseNo: string;
    street: string;
    landmark?: string;
    shippingState: string;
    shippingLga: string;
    shippingCity: string;
  },
) {
  return fetchJsonAuthed<SavedRecipient>("/saved-recipients", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteSavedRecipient(token: string, id: string) {
  const response = await fetch(`${apiBase}/api/saved-recipients/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    throw new Error(messageFromErrorBody(body, `Request failed: DELETE saved-recipient (${response.status})`));
  }
}
