import { AuthoringRequestError } from "./api-types";

type UploadResponse = {
  key: string;
  url: string;
};

export async function uploadProductImageFile(
  token: string,
  file: File,
  options: { apiBase: string; path: string },
): Promise<UploadResponse> {
  const base = options.apiBase.replace(/\/$/, "");
  const path = options.path.startsWith("/") ? options.path : `/${options.path}`;
  const body = new FormData();
  body.append("file", file, file.name);
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body,
  });
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!response.ok) {
    const message =
      typeof parsed === "object" && parsed && "message" in parsed
        ? String((parsed as { message: unknown }).message)
        : `Upload failed (${response.status})`;
    throw new AuthoringRequestError(message, response.status);
  }
  const payload = parsed as UploadResponse;
  const normalizedUrl = payload.url.startsWith("http")
    ? payload.url
    : `${base}${payload.url.startsWith("/") ? payload.url : `/${payload.url}`}`;
  return { key: payload.key, url: normalizedUrl };
}
