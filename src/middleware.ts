import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "session";
const PROTECTED_PREFIXES = ["/dashboard", "/goals", "/account", "/logout"];

const isProtectedPath = (pathname: string) => {
  if (pathname === "/") {
    return true;
  }

  return PROTECTED_PREFIXES.some((prefix) => {
    if (pathname === prefix) {
      return true;
    }
    return pathname.startsWith(`${prefix}/`);
  });
};

const buildRedirectUrl = (request: NextRequest, target: string) => {
  const url = new URL(target, request.url);
  url.searchParams.delete("next");
  return url;
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);

  if (pathname.startsWith("/login")) {
    if (hasSession) {
      return NextResponse.redirect(buildRedirectUrl(request, "/dashboard"));
    }
    return NextResponse.next();
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    const destination = hasSession ? "/dashboard" : "/login";
    const url = new URL(destination, request.url);
    if (!hasSession) {
      url.searchParams.delete("next");
    }
    return NextResponse.redirect(url);
  }

  if (hasSession) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  const nextParam = `${pathname}${request.nextUrl.search}`;
  if (nextParam !== "/") {
    loginUrl.searchParams.set("next", nextParam);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/goals/:path*", "/account/:path*", "/logout"],
};
