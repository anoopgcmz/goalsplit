import { describe, expect, it, vi, afterEach } from "vitest";
import { z } from "zod";

import { ApiError, apiFetch } from "@/lib/http";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiFetch error handling", () => {
  it("wraps network errors", async () => {
    const networkError = new TypeError("Failed to fetch");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(networkError));

    const call = apiFetch("/example");

    await expect(call).rejects.toBeInstanceOf(ApiError);
    await call.catch((error) => {
      expect(error).toMatchObject({
        status: 0,
        message: expect.stringContaining("Check your connection"),
        details: networkError,
      });
    });
  });

  it("maps 401 errors to a friendly message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Custom" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(apiFetch("/secure")).rejects.toMatchObject({
      status: 401,
      message: "You must be signed in to continue.",
    });
  });

  it("maps 500 errors to a default server message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("", {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(apiFetch("/error")).rejects.toMatchObject({
      status: 503,
      message: "Something went wrong on our end. Please try again later.",
    });
  });

  it("throws a validation error when schema parsing fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: "not-a-number" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const schema = z.object({ id: z.number() });

    await expect(apiFetch("/items", { schema })).rejects.toMatchObject({
      status: 422,
      message: "The server returned data in an unexpected format.",
    });
  });
});
