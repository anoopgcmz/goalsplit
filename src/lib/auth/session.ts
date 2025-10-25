import { createHmac, timingSafeEqual } from "crypto";

import { config } from "../config";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

interface SessionPayload {
  sub: string;
  email?: string;
  iat: number;
  exp: number;
}

interface CreateSessionTokenInput {
  userId: string;
  email?: string | null;
  maxAgeSeconds?: number;
}

export interface ValidSession {
  userId: string;
  email?: string;
  issuedAt: number;
  expiresAt: number;
}

export type SessionValidationResult =
  | { success: true; session: ValidSession }
  | { success: false; reason: "missing" | "invalid" | "expired" };

const createSignature = (data: string) =>
  createHmac("sha256", config.auth.jwtSecret).update(data).digest("base64url");

const serializePayload = (payload: SessionPayload) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

const serializeHeader = () =>
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }), "utf8").toString(
    "base64url",
  );

const parsePayload = (segment: string): SessionPayload | null => {
  try {
    const json = Buffer.from(segment, "base64url").toString("utf8");
    const data = JSON.parse(json) as Partial<SessionPayload>;

    if (typeof data.sub !== "string") {
      return null;
    }

    if (typeof data.iat !== "number" || !Number.isFinite(data.iat)) {
      return null;
    }

    if (typeof data.exp !== "number" || !Number.isFinite(data.exp)) {
      return null;
    }

    const payload: SessionPayload = {
      sub: data.sub,
      email: typeof data.email === "string" ? data.email : undefined,
      iat: data.iat,
      exp: data.exp,
    };

    return payload;
  } catch {
    return null;
  }
};

export const createSessionToken = (input: CreateSessionTokenInput): string => {
  const header = serializeHeader();
  const issuedAt = Math.floor(Date.now() / 1000);
  const maxAge = Math.max(60, input.maxAgeSeconds ?? SESSION_MAX_AGE_SECONDS);
  const payloadSegment = serializePayload({
    sub: input.userId,
    email: input.email ?? undefined,
    iat: issuedAt,
    exp: issuedAt + maxAge,
  });

  const data = `${header}.${payloadSegment}`;
  const signature = createSignature(data);

  return `${data}.${signature}`;
};

export const validateSessionToken = (
  token: string | undefined | null,
): SessionValidationResult => {
  if (!token) {
    return { success: false, reason: "missing" };
  }

  const segments = token.split(".");
  if (segments.length !== 3) {
    return { success: false, reason: "invalid" };
  }

  const [headerSegment, payloadSegment, signatureSegment] = segments;
  if (!headerSegment || !payloadSegment || !signatureSegment) {
    return { success: false, reason: "invalid" };
  }

  const data = `${headerSegment}.${payloadSegment}`;
  const expectedSignature = createSignature(data);

  try {
    const signatureBuffer = Buffer.from(signatureSegment, "base64url");
    const expectedBuffer = Buffer.from(expectedSignature, "base64url");

    if (signatureBuffer.length !== expectedBuffer.length) {
      return { success: false, reason: "invalid" };
    }

    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return { success: false, reason: "invalid" };
    }
  } catch {
    return { success: false, reason: "invalid" };
  }

  const payload = parsePayload(payloadSegment);
  if (!payload) {
    return { success: false, reason: "invalid" };
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return { success: false, reason: "expired" };
  }

  return {
    success: true,
    session: {
      userId: payload.sub,
      email: payload.email,
      issuedAt: payload.iat,
      expiresAt: payload.exp,
    },
  };
};

export const buildSessionCookieOptions = () => ({
  httpOnly: true as const,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
});

export const clearSessionCookieOptions = () => ({
  httpOnly: true as const,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 0,
});
