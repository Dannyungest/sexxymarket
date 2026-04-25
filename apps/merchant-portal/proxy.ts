import { NextRequest, NextResponse } from "next/server";

const MERCHANT_TOKEN_COOKIE = "sm_merchant_access_token";
const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

function redirectToLogin(request: NextRequest, clearCookie: boolean) {
  const url = new URL("/login", request.url);
  const response = NextResponse.redirect(url);
  if (clearCookie) {
    response.cookies.set(MERCHANT_TOKEN_COOKIE, "", { path: "/", maxAge: 0, sameSite: "lax" });
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(MERCHANT_TOKEN_COOKIE)?.value;
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
    let me: { role?: string } | null = null;
    try {
      me = (await meResponse.json()) as { role?: string };
    } catch {
      return redirectToLogin(request, true);
    }
    if (!me.role || ["ADMIN", "SUPER_ADMIN"].includes(me.role)) {
      return redirectToLogin(request, true);
    }
    return NextResponse.next();
  } catch {
    return redirectToLogin(request, false);
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/products/:path*", "/verify"],
};
