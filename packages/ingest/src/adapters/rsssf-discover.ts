import { fetchText } from "../http.js";
import { parseSeasonPage, stripMarkup } from "./rsssf.js";

const BASE = "http://www.rsssf.no";

/**
 * Kartlegger hva RSSSF faktisk har, år for år, uten å skrive noe.
 *
 * Høstingen krevde tidligere at man visste filnavnet på forhånd — `Premier`,
 * `First` eller `Cup`. Det holder for 1980 og framover, men bryter sammen bakover:
 * der heter sidene `Hoved`, `Landsdel`, `Krets`, `Second`, `Third`, `Ecup`, og
 * hvilke som finnes varierer fra år til år. En adapter som må gjette filnavn
 * finner ikke det den ikke vet om.
 *
 * Like viktig: dekningen varierer i *innhold*. Årsindeksen skiller selv mellom
 * «(tables only)» og «(round by round)» — og bare den siste kan gi enkeltkamper.
 * En tabellside forteller hvor mange kamper som ble spilt, men ikke hvilke.
 *
 * Derfor klassifiseres hver side to ganger: først etter hva indeksen kaller den,
 * så etter hva som faktisk står på siden. Når de spriker, er det innholdet som
 * gjelder — etiketten er skrevet av et menneske og kan mangle.
 */

export type PageKind = "match_list" | "mixed" | "tables_only" | "unknown" | "unavailable";

export interface DiscoveredPage {
  year: number;
  /** Filnavn uten endelse, slik CLI-en tar det i `--division`. */
  page: string;
  /** Teksten indeksen bruker om siden, f.eks. «First division (tables only)». */
  label: string;
  url: string;
  /** Hva indeksen sa, før vi så på innholdet. */
  labelledAs: PageKind;
  /** Hva siden faktisk inneholder. Dette er konklusjonen. */
  kind: PageKind;
  /** Antall kamper på siden, uansett lag. Sier om parsingen traff i det hele tatt. */
  totalMatches: number;
  /** Antall AaFK-kamper som lot seg lese ut. */
  aafkMatches: number;
  /** Kamper med AaFK som ikke kunne leses, typisk fordi datoen mangler. */
  parseFailures: number;
  /** Sant når etikett og innhold er uenige. Verdt et blikk før høsting. */
  needsReview: boolean;
}

export interface DiscoveryOptions {
  from: number;
  to: number;
  refresh?: boolean;
  onProgress?: (message: string) => void;
}

/** Lenker vi aldri trenger å laste: navigasjon, ikke data. */
const SKIP = /^(\.\.|index\.html|football\.html|archive\.html)/i;

export async function discoverRange(options: DiscoveryOptions): Promise<DiscoveredPage[]> {
  const found: DiscoveredPage[] = [];
  for (let year = options.from; year <= options.to; year++) {
    const pages = await discoverYear(year, options);
    found.push(...pages);
    const withAafk = pages.filter((p) => p.aafkMatches > 0).length;
    options.onProgress?.(
      `${year}: ${pages.length} sider, ${withAafk} med AaFK-kamper`,
    );
  }
  return found;
}

export async function discoverYear(year: number, options: DiscoveryOptions): Promise<DiscoveredPage[]> {
  let index: string;
  try {
    index = await fetchText(`${BASE}/${year}/index.html`, { refresh: options.refresh });
  } catch {
    return [];
  }

  const pages: DiscoveredPage[] = [];
  for (const link of readIndexLinks(index)) {
    const url = `${BASE}/${year}/${link.file}`;
    const page = link.file.replace(/\.html$/i, "");

    let body: string;
    try {
      body = await fetchText(url, { refresh: options.refresh });
    } catch {
      pages.push({
        year, page, label: link.label, url,
        labelledAs: link.labelledAs, kind: "unavailable",
        totalMatches: 0, aafkMatches: 0, parseFailures: 0, needsReview: false,
      });
      continue;
    }

    const parsed = parseSeasonPage(body, year, page);
    const kind = classifyContent(body, parsed.total);

    pages.push({
      year,
      page,
      label: link.label,
      url,
      labelledAs: link.labelledAs,
      kind,
      totalMatches: parsed.total,
      aafkMatches: parsed.matches.length,
      parseFailures: parsed.failures.length,
      // Etiketten lover kamper som ikke finnes, eller tier om kamper som gjør det.
      // «tables_only» som viser seg å være «mixed» er forventet og trenger ingen
      // kontroll — det er nettopp den nyansen kartleggingen finnes for. Vi flagger
      // bare når etiketten lover en full kampoversikt som ikke er der, når en
      // tabellside viser seg å ha en full oversikt likevel, eller når noe feilet.
      needsReview:
        (link.labelledAs === "match_list" && kind !== "match_list" && kind !== "mixed") ||
        (link.labelledAs === "tables_only" && kind === "match_list") ||
        parsed.failures.length > 0,
    });
  }
  return pages;
}

interface IndexLink {
  file: string;
  label: string;
  labelledAs: PageKind;
}

/**
 * Leser lenkene i årsindeksen sammen med teksten rundt dem.
 *
 * Teksten er det som skiller «First division (tables only)» fra «Cup (round by
 * round)», og den står utenfor selve lenken like ofte som inni den. Derfor tas
 * hele linja med.
 */
export function readIndexLinks(html: string): IndexLink[] {
  const links: IndexLink[] = [];
  const seen = new Set<string>();

  // Del opp på linjer først, så etiketten kan leses fra samme linje som lenken.
  for (const line of stripTags(html).split("\n")) {
    for (const found of line.matchAll(/<a[^>]+href="([^"]+\.html)"[^>]*>(.*?)<\/a>/gis)) {
      const file = found[1]!;
      if (SKIP.test(file) || file.includes("/")) continue;
      if (seen.has(file)) continue;
      seen.add(file);

      const label = stripMarkup(found[2] ?? "").replace(/\s+/g, " ").trim();
      const context = stripMarkup(line).replace(/\s+/g, " ").trim();
      links.push({ file, label: label || file, labelledAs: classifyLabel(context) });
    }
  }
  return links;
}

/** Beholder taggene, men gir én linje per lenke så konteksten ikke smitter. */
function stripTags(html: string): string {
  return html.replace(/<(br|p|li|tr|td|h\d)[^>]*>/gi, "\n$&");
}

export function classifyLabel(text: string): PageKind {
  const lower = text.toLowerCase();
  if (/tables?\s*only|kun tabell/.test(lower)) return "tables_only";
  if (/round by round|runde for runde/.test(lower)) return "match_list";
  return "unknown";
}

/**
 * Klassifiserer etter innhold.
 *
 * Tre utfall, ikke to. Kartleggingen avdekket at «tables only» i indeksen ofte er
 * en sannhet med modifikasjoner: 3. divisjon i 1965 er merket slik, og *er* stort
 * sett tabeller — men nederst ligger åtte ekte kvalifiseringskamper med dato og
 * resultat. De er like gode data som alt annet.
 *
 * `mixed` finnes derfor som egen kategori. Den sier «her er det tabeller, men også
 * noen kamper verdt å hente», og det er en helt annen beskjed enn både «hele
 * sesongen ligger her» og «her finnes ingenting».
 */
export function classifyContent(html: string, totalMatches: number): PageKind {
  const text = stripMarkup(html);
  // En tabellrad er lagnavn, kamper, S/U/T, målforhold og poeng på én linje.
  const tableRows = (text.match(/^\s*\S.*?\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+-\d+\s+\d+/gm) ?? []).length;

  if (tableRows >= 5) return totalMatches >= 5 ? "mixed" : "tables_only";
  if (totalMatches >= 5) return "match_list";
  return totalMatches > 0 ? "mixed" : "unknown";
}

/** Dekningsrapport i markdown, klar til å legges i docs/data/. */
export function coverageReport(pages: DiscoveredPage[], options: { generatedAt: string }): string {
  const years = [...new Set(pages.map((p) => p.year))].sort((a, b) => a - b);
  const withAafk = pages.filter((p) => p.aafkMatches > 0);
  const totalAafk = withAafk.reduce((sum, p) => sum + p.aafkMatches, 0);
  const review = pages.filter((p) => p.needsReview);

  const rows = withAafk
    .sort((a, b) => a.year - b.year || a.page.localeCompare(b.page))
    .map((p) =>
      `| ${p.year} | \`${p.page}\` | ${p.label} | ${p.kind} | ${p.aafkMatches} | ${p.parseFailures} |`,
    );

  const kinds = new Map<PageKind, number>();
  for (const p of pages) kinds.set(p.kind, (kinds.get(p.kind) ?? 0) + 1);

  return [
    "# RSSSF — dekningskart",
    "",
    `Generert ${options.generatedAt} av \`pnpm ingest:rsssf-discover\`. Ingen data er skrevet.`,
    "",
    "Kartleggingen henter årsindeksen, følger lenkene, og klassifiserer hver side både",
    "etter hva indeksen kaller den og etter hva som faktisk står på den. Når de spriker,",
    "er det innholdet som gjelder — etiketten er skrevet av et menneske og kan mangle.",
    "",
    "## Sammendrag",
    "",
    `- Årganger undersøkt: ${years.length}${years.length ? ` (${years[0]}–${years.at(-1)})` : ""}`,
    `- Sider undersøkt: ${pages.length}`,
    ...[...kinds.entries()].map(([kind, n]) => `- Klassifisert som \`${kind}\`: ${n}`),
    `- Sider med AaFK-kamper: ${withAafk.length}`,
    `- AaFK-kamper funnet: **${totalAafk}**`,
    `- Sider som bør kontrolleres: ${review.length}`,
    "",
    "## Sider med AaFK-kamper",
    "",
    "| År | Side | Etikett i indeksen | Innhold | AaFK-kamper | Parsefeil |",
    "|---|---|---|---|---:|---:|",
    ...(rows.length ? rows : ["| – | – | – | – | 0 | 0 |"]),
    "",
    "## Sider som bør kontrolleres",
    "",
    review.length === 0
      ? "Ingen. Etikett og innhold stemmer overens overalt, og ingen kamper feilet i parsingen."
      : [
          "Etiketten og innholdet er uenige, eller kamper feilet i parsingen.",
          "",
          "| År | Side | Etikett sa | Innhold er | Parsefeil |",
          "|---|---|---|---|---:|",
          ...review.map((p) => `| ${p.year} | \`${p.page}\` | ${p.labelledAs} | ${p.kind} | ${p.parseFailures} |`),
        ].join("\n"),
    "",
    "## Merk",
    "",
    "En tabellside kan ikke gi enkeltkamper, men den kan brukes til kontroll: antall",
    "kamper, mål og poeng i en sesong må stemme med det arkivet har registrert.",
    "",
    "Denne rapporten sier hva som *finnes*, ikke hva som kan publiseres. Se",
    "rettighetsstatusen i `data/sources/rsssf.yaml`.",
    "",
  ].join("\n");
}
