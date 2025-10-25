import { NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  clearSessionCookieOptions,
} from "@/lib/auth/session";

export function POST() {
  const response = NextResponse.json({ status: "signed-out" });
  response.cookies.set(SESSION_COOKIE_NAME, "", clearSessionCookieOptions());
  response.headers.set("cache-control", "no-store");
  return response;
}

export function DELETE() {
  return POST();
}
