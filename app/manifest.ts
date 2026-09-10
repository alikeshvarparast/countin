import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: `${APP_NAME} helps groups run recurring sessions with RSVPs, waitlists, and a shared ledger.`,
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#F4EFE8",
    theme_color: "#F4EFE8",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
