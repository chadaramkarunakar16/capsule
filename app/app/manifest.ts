import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// Installable app + "Share → Capsule" target (Chrome / Android). Shared images open as a look to shop.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Capsule",
    short_name: "Capsule",
    description: "Your wardrobe, styled around you.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f5",
    theme_color: "#faf8f5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url", files: [{ name: "image", accept: ["image/*"] }] },
    },
  } as MetadataRoute.Manifest;
}
