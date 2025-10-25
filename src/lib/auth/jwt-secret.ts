import { config } from "../config";

export const getJwtSecret = (): string => {
  const secret = config.auth.jwtSecret;

  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error("JWT secret must be configured");
  }

  return secret;
};
