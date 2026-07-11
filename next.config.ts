import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV !== "production"
    ? {
        allowedDevOrigins: ["127.0.0.1"],
        assetPrefix: "http://localhost:3000",
      }
    : {}),
};

export default nextConfig;
