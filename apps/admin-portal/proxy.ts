import { NextRequest, NextResponse } from "next/server";

const ADMIN_TOKEN_COOKIE = "sm_admin_access_token";
const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);
const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

function redirectToLogin(request: NextRequest, clearCookie: boolean) {
  const url = new URL("/login", request.url);
  const response = NextResponse.redirect(url);
  if (clearCookie) {
    response.cookies.set(ADMIN_TOKEN_COOKIE, "", { path: "/", maxAge: 0, sameSite: "lax" });
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) {
    return redirectToLogin(request, true);
  }

  try {
    const meResponse = await fetch(`${apiBase}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!meResponse.ok) {
      return redirectToLogin(request, true);
    }
    const me = (await meResponse.json()) as { role?: string };
    if (!me.role || !ADMIN_ROLES.has(me.role)) {
      return redirectToLogin(request, true);
    }
    return NextResponse.next();
  } catch {
    return redirectToLogin(request, false);
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/orders/:path*", "/merchants/:path*", "/products/:path*", "/users/:path*", "/admins/:path*"],
};
