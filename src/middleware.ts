import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getJwtSecret } from "@/lib/auth/jwt-secret";

const SESSION_COOKIE_NAME = "session";
const PUBLIC_PATHS = new Set(["/login", "/robots.txt"]);
const PUBLIC_PREFIXES = ["/api/auth", "/shared/accept", "/_next"];
const FAVICON_PREFIX = "/favicon";

const JWT_SECRET = getJwtSecret();

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let cachedKeyPromise: Promise<CryptoKey> | null = null;

const getHmacKey = () => {
  if (!cachedKeyPromise) {
    cachedKeyPromise = crypto.subtle.importKey(
      "raw",
      textEncoder.encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
  }

  return cachedKeyPromise;
};

const base64UrlToUint8Array = (input: string): Uint8Array => {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (base64.length % 4)) % 4;
  const padded = base64.padEnd(base64.length + paddingLength, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const decodeBase64UrlSegment = (segment: string): string | null => {
  try {
    const bytes = base64UrlToUint8Array(segment);
    return textDecoder.decode(bytes);
  } catch {
    return null;
  }
};

const verifySignature = async (data: string, signature: string) => {
  try {
    const key = await getHmacKey();
    const signatureBytes = base64UrlToUint8Array(signature);
    const dataBytes = textEncoder.encode(data);

    return crypto.subtle.verify("HMAC", key, signatureBytes, dataBytes);
  } catch {
    return false;
  }
};

interface SessionPayload {
  sub?: unknown;
  exp?: unknown;
  iat?: unknown;
  email?: unknown;
}

const isValidSessionToken = async (token: string | undefined | null) => {
  if (!token) {
    return false;
  }

  const segments = token.split(".");
  if (segments.length !== 3) {
    return false;
  }

  const [headerSegment, payloadSegment, signatureSegment] = segments;

  if (!headerSegment || !payloadSegment || !signatureSegment) {
    return false;
  }

  const data = `${headerSegment}.${payloadSegment}`;
  const isSignatureValid = await verifySignature(data, signatureSegment);

  if (!isSignatureValid) {
    return false;
  }

  const payloadText = decodeBase64UrlSegment(payloadSegment);
  if (!payloadText) {
    return false;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(payloadText) as SessionPayload;
  } catch {
    return false;
  }

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    return false;
  }

  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    return false;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  if (payload.exp <= currentTime) {
    return false;
  }

  if (payload.iat !== undefined && (typeof payload.iat !== "number" || !Number.isFinite(payload.iat))) {
    return false;
  }

  return true;
};

const isPublicPath = (pathname: string) => {
  if (PUBLIC_PATHS.has(pathname)) {
    return true;
  }

  if (pathname.startsWith(FAVICON_PREFIX)) {
    return true;
  }

  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (request.method === "OPTIONS") {
    return NextResponse.next();
  }

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (await isValidSessionToken(token)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (await isValidSessionToken(token)) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/goals/:path*",
    "/account/:path*",
    "/shared/:path*",
    "/logout",
    "/api/goals/:path*",
    "/api/shared/:path*",
    "/api/contributions/:path*",
    "/api/me/:path*",
    "/api/analytics/:path*",
  ],
};
