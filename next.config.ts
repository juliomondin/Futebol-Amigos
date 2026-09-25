import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["@libsql/client", "@libsql/hrana-client", "@libsql/core"],
};

export default nextConfig;
