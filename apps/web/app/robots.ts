import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * Hva som skal krypes.
 *
 * API-rutene er utelatt fordi de ikke er sider: `/api/chat` koster et
 * modellkall per forespørsel, og `/api/search` og `/api/nb-image` svarer med
 * data som allerede står på sidene. En robot som krøp dem, ville brukt opp
 * kryssbudsjettet på svar det ikke finnes noen søketreff for.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl(),
  };
}
