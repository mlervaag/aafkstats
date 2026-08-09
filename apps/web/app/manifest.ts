import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "AaFK-arkivet",
    short_name: "AaFK-arkivet",
    description: "Uoffisielt, søkbart arkiv over Aalesunds Fotballklubbs kamphistorikk.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f2e9",
    theme_color: "#f7f2e9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
