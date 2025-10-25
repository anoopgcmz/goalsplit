import type {
  AuthUser,
  RequestOtpInput,
  VerifyOtpInput,
  VerifyOtpResponse,
} from "@/app/api/auth/schemas";

import { ApiError, fetchJson, isApiError } from "./request";

const json = (value: unknown) => JSON.stringify(value);

export const requestOtp = async (
  input: RequestOtpInput,
  signal?: AbortSignal,
): Promise<void> => {
  await fetchJson<undefined>("/api/auth/request-otp", {
    method: "POST",
    body: json(input),
    signal,
    credentials: "include",
  });
};

export const verifyOtp = async (
  input: VerifyOtpInput,
  signal?: AbortSignal,
): Promise<VerifyOtpResponse> =>
  fetchJson<VerifyOtpResponse>("/api/auth/verify-otp", {
    method: "POST",
    body: json(input),
    signal,
    credentials: "include",
  });

export const getCurrentUser = async (signal?: AbortSignal): Promise<AuthUser | null> => {
  try {
    const payload = await fetchJson<VerifyOtpResponse>("/api/me", {
      method: "GET",
      signal,
      credentials: "include",
    });

    return payload.user;
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      return null;
    }

    throw error;
  }
};

export const logout = async (signal?: AbortSignal): Promise<void> => {
  try {
    await fetchJson<{ status: string }>("/api/auth/logout", {
      method: "POST",
      signal,
      credentials: "include",
    });
  } catch (error) {
    if (isApiError(error) && error.status >= 500) {
      throw error;
    }

    if (error instanceof ApiError && error.status !== 401) {
      throw error;
    }
  }
};
