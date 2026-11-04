import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // npm run desktop:build sets this so the Windows app can carry a self-contained server
  ...(process.env.CAPSULE_DESKTOP ? { output: "standalone" as const } : {}),
  // `npm run build:static` sets this to produce the hosted (Cloudflare) build: plain files in out/
  ...(process.env.CAPSULE_STATIC ? { output: "export" as const, trailingSlash: false } : {}),
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
