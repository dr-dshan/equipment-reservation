import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Equipment Reservation",
    short_name: "Equipment",
    description: "Shared equipment reservation calendar",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f2ed",
    theme_color: "#171717",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
