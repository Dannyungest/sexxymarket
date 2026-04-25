export const ADMIN_TOKEN_KEY = "sm_admin_access_token";
export const ADMIN_TOKEN_COOKIE = "sm_admin_access_token";
export const ADMIN_SESSION_TOKEN_KEY = "sm_admin_session_access_token";
export const ADMIN_REFRESH_TOKEN_KEY = "sm_admin_refresh_token";
export const ADMIN_KEEP_SIGNED_IN_KEY = "sm_admin_keep_signed_in";

export function getStoredAdminToken(): string {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem(ADMIN_TOKEN_KEY) ??
    sessionStorage.getItem(ADMIN_SESSION_TOKEN_KEY) ??
    ""
  );
}

export function persistAdminSession(input: {
  accessToken: string;
  refreshToken?: string;
  keepSignedIn: boolean;
}) {
  if (typeof window === "undefined") return;
  if (input.keepSignedIn) {
    localStorage.setItem(ADMIN_TOKEN_KEY, input.accessToken);
    sessionStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
  } else {
    sessionStorage.setItem(ADMIN_SESSION_TOKEN_KEY, input.accessToken);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  }
  if (input.refreshToken) {
    localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, input.refreshToken);
  } else {
    localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
  }
  localStorage.setItem(ADMIN_KEEP_SIGNED_IN_KEY, input.keepSignedIn ? "1" : "0");
}

export function clearAdminSession() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEEP_SIGNED_IN_KEY);
    sessionStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
  }
  document.cookie = `${ADMIN_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
