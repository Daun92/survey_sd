import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/r/:token",
        destination: "/respond/:token",
      },
    ];
  },
};

export default nextConfig;
