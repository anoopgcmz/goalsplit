import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Required for the Docker standalone build — bundles only the files needed
  // to run the server, keeping the final image lean (~50–80 MB vs ~500 MB+).
  output: "standalone",
};

export default nextConfig;
