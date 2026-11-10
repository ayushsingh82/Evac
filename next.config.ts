import type { NextConfig } from "next";

// Static export: the kit must be a pile of files with no server of ours in the path.
const nextConfig: NextConfig = {
  output: "export",
  // A fixed build id makes the output byte-for-byte reproducible, so its hash can be published and checked.
  generateBuildId: async () => "evac-v1",
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
