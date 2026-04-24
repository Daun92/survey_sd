import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "@base-ui/react",
      "cmdk",
      "sonner",
      "clsx",
      "class-variance-authority",
      "tailwind-merge",
    ],
  },
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
