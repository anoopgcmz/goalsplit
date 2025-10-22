import type { AuthUser } from "@/app/api/auth/schemas";

import { mockUsers } from "./data";
import { deepClone, simulateNetworkLatency } from "./helpers";

const fallbackUser: AuthUser = mockUsers[0] ?? {
  id: "user-anon",
  email: "guest@example.com",
  name: "Guest User",
};

export const mockAuthAdapter = {
  async getCurrentUser(signal?: AbortSignal): Promise<AuthUser> {
    await simulateNetworkLatency(signal, 200);
    return deepClone(fallbackUser);
  },
};
