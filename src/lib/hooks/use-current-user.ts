import { useEffect, useState } from "react";

import type { AuthUser } from "@/app/api/auth/schemas";
import { getCurrentUser } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/request";

export type CurrentUserStatus = "loading" | "authenticated" | "unauthenticated";

export interface CurrentUserState {
  user: AuthUser | null;
  status: CurrentUserStatus;
  error: string | null;
  isLoading: boolean;
}

export const useCurrentUser = (): CurrentUserState => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<CurrentUserStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const result = await getCurrentUser(controller.signal);
        if (controller.signal.aborted) {
          return;
        }

        if (result) {
          setUser(result);
          setStatus("authenticated");
        } else {
          setUser(null);
          setStatus("unauthenticated");
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        setUser(null);
        setStatus("unauthenticated");
        if (isApiError(err)) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Unable to load the current user.");
        }
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, []);

  return { user, status, error, isLoading: status === "loading" };
};
