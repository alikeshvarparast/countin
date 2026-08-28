import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "random-intensity-blog-knock.trycloudflare.com",
    "ops.localhost",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
      allowedOrigins: [
        "*.trycloudflare.com",
        "random-intensity-blog-knock.trycloudflare.com",
        "ops.localhost",
      ],
    },
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
