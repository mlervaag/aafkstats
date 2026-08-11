import { statSync } from "node:fs";
import type { MetadataRoute } from "next";
import { archivePath } from "@aafkstats/db";
import { loadMatchIndex, loadOpponents, loadSeasonYears } from "@/lib/archive";
import { getSources } from "@/lib/sources";
import { getPeople } from "@/lib/people";
import { SITE_ORIGIN } from "@/lib/site";

const base = SITE_ORIGIN;

/**
 * Når arkivet sist ble bygget.
 *
 * Alt i arkivet endrer seg samtidig, ved utrulling, så filas tidsstempel er den
 * riktige datoen for de sidene som ikke har en bedre en selv.
 */
function builtAt(): Date {
  try {
    return statSync(archivePath()).mtime;
  } catch {
    return new Date();
  }
}

/**
 * Sitemap over alt som er verdt å finne.
 *
 * Hadde tre feil. Sesong-URL-ene kom fra `seasons`, som har én rad per sesong og
 * konkurranse, så et år med serie, cup og treningskamper sto tre ganger med
 * nøyaktig samme adresse. Kampsidene manglet helt, og det er de sidene med noe
 * unikt på seg: over tusen sider ingen søkemotor visste fantes. Og ingenting
 * hadde `lastModified`, så en søkemotor måtte gjette om noe var endret.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const built = builtAt();
  // `/api-docs` er ikke en side. Den er en `redirect()` til `/data`, igjen fra
  // den gangen dokumentasjonen lå der, og svarer 307. En søkemotor som følger
  // sitemapet får da en videresending i stedet for innhold, og Search Console
  // fører den opp som «Side med omdirigering». Selve omdirigeringen skal bli
  // stående — gamle lenker utenfra skal fortsatt virke — men den hører ikke
  // hjemme i en liste over adresser vi ber om å få indeksert.
  const staticPages = ["", "/sesonger", "/motstandere", "/klubben", "/personer", "/organisasjon", "/hjemmebaner", "/kilder", "/mangler", "/data", "/om", "/bidra"];

  return [
    ...staticPages.map((path) => ({
      url: `${base}${path}`,
      lastModified: built,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })),
    // Ett år, én adresse. /sesong/1998 viser alle konkurransene det året.
    ...loadSeasonYears().map((year) => ({
      url: `${base}/sesong/${year.year}`,
      lastModified: built,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...loadOpponents().map((opponent) => ({
      url: `${base}${opponent.url}`,
      lastModified: built,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...getSources().map((source) => ({
      url: `${base}/kilder/${source.id}`,
      lastModified: built,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    })),
    ...getPeople().map((person) => ({
      url: `${base}/personer/${person.id}`,
      lastModified: built,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    })),
    // Kommende kamper er med. De har en egen side med dato og avspark, og det er
    // nettopp den opplysningen folk leter etter i dagene før en kamp.
    ...loadMatchIndex().map((match) => ({
      url: `${base}/kamp/${match.matchId}`,
      lastModified: match.lastRetrievedAt ? new Date(match.lastRetrievedAt) : built,
      changeFrequency: match.status === "scheduled" ? ("daily" as const) : ("yearly" as const),
      priority: 0.4,
    })),
  ];
}
