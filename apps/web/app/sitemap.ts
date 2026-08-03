import type { MetadataRoute } from "next";
import { loadOpponents, loadSeasons } from "@/lib/archive";

const base = "https://aafkstats.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ["", "/sesonger", "/motstandere", "/data", "/om", "/bidra"];
  return [
    ...staticPages.map((path) => ({ url: `${base}${path}`, changeFrequency: "weekly" as const })),
    ...loadSeasons().map((season) => ({ url: `${base}${season.url}`, changeFrequency: "monthly" as const })),
    ...loadOpponents().map((opponent) => ({ url: `${base}${opponent.url}`, changeFrequency: "monthly" as const })),
  ];
}
