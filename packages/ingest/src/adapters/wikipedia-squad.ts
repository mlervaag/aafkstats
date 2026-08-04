import type { PlayingPosition } from "@aafkstats/schema";
import { fetchJson } from "../http.js";

/**
 * Spillerstallen fra norsk Wikipedia.
 *
 * ## Hva denne kilden er god for, og hva den ikke er
 *
 * Lagoppstillingene i arkivet sier hvem som spilte. De sier ingenting om hvem
 * personen er: draktnummer, posisjon og nasjonalitet finnes ikke i dem, og to
 * navn som ligner kan ikke skilles fra hverandre.
 *
 * Wikipedias stallmal har alle tre. Den avgjør også spørsmålet arkivet ikke
 * kunne svare på selv: «Mathias Kristensen» med nummer 14 fra Danmark og
 * «Mathias Christensen» med nummer 21 fra Grønland står i samme stall, og er to
 * menn.
 *
 * Det den ikke gir, er hvem som spilte når. Norsk Wikipedia har ingen
 * sesongartikler for AaFK — bare klubbartikkelen, og den viser stallen slik den
 * er i dag. Kampene forblir derfor kilden til hvem som var med et gitt år.
 *
 * ## Hvorfor vi leser gamle revisjoner
 *
 * Stallen fra 2018 finnes ikke på sida lenger, men den finnes i historikken.
 * `?rvstart=<år>-12-31&rvdir=older` gir den siste revisjonen før nyttår, altså
 * stallen slik den sto ved sesongslutt. Malen ble tatt i bruk et sted mellom
 * 2013 og 2018; eldre revisjoner gir ingen treff, og det er riktig svar.
 *
 * ## Rettigheter
 *
 * Teksten på Wikipedia er CC BY-SA og smitter. Det vi leser her er ikke tekst:
 * navn, nummer, posisjon og nasjonalitet er fakta. Merknadsfeltene i artikkelen
 * er prosa og røres ikke.
 */

const API = "https://no.wikipedia.org/w/api.php";
const ARTICLE = "Aalesunds Fotballklubb";

/** Posisjonskodene malen bruker. Alt annet lar vi stå tomt framfor å gjette. */
const POSITIONS: Record<string, PlayingPosition> = {
  K: "keeper",
  F: "forsvar",
  MB: "midtbane",
  A: "angrep",
  // Malen har vært innom lengre former.
  MF: "midtbane",
  FW: "angrep",
  GK: "keeper",
  DF: "forsvar",
};

export interface WikipediaPlayer {
  name: string;
  number?: number;
  position?: PlayingPosition;
  nationality?: string;
}

export interface SquadRevision {
  /** Revisjonens tidsstempel, som blir `retrievedAt` på kilden. */
  timestamp: string;
  revisionId: number;
  players: WikipediaPlayer[];
}

/**
 * Leser `{{Fs player|no=14|nat=Danmark|name=[[Mathias Kristensen]]|pos=MB}}`.
 *
 * Navnet kan være en lenke med visningstekst: `[[Ólafur Guðmundsson (islandsk
 * fotballspiller)|Ólafur Gudmundsson]]`. Da er det visningsteksten som er
 * navnet — parentesen bak er Wikipedias egen disambiguering, ikke en del av det
 * personen heter.
 */
export function parseSquadTemplate(wikitext: string): WikipediaPlayer[] {
  const players: WikipediaPlayer[] = [];

  for (const match of wikitext.matchAll(/\{\{Fs player\s*\|([^}]*)\}\}/gi)) {
    const fields = new Map<string, string>();
    for (const part of match[1]!.split("|")) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      fields.set(part.slice(0, eq).trim().toLowerCase(), part.slice(eq + 1).trim());
    }

    const name = readName(fields.get("name") ?? "");
    // Malen har tomme rader som spalteskille. De har verken navn eller nummer.
    if (name === "") continue;

    const number = Number(fields.get("no"));
    const position = POSITIONS[(fields.get("pos") ?? "").toUpperCase()];
    const nationality = fields.get("nat");

    players.push({
      name,
      ...(Number.isInteger(number) && number >= 1 && number <= 99 ? { number } : {}),
      ...(position ? { position } : {}),
      ...(nationality ? { nationality } : {}),
    });
  }

  return players;
}

function readName(raw: string): string {
  const link = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(raw);
  const name = link ? (link[2] ?? link[1]!) : raw;
  return name.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

interface RevisionResponse {
  query?: {
    pages?: Record<string, {
      revisions?: { revid: number; timestamp: string; slots?: { main?: { "*"?: string } } }[];
    }>;
  };
}

/**
 * Stallen slik den sto ved utgangen av en sesong.
 *
 * `undefined` når artikkelen ikke hadde stallmalen på det tidspunktet. Det er
 * ikke en feil: malen ble tatt i bruk underveis, og en tom stall for 2013 er et
 * ærlig svar på at kilden ikke hadde den.
 */
export async function fetchSquadAt(
  season: number,
  options: { refresh?: boolean } = {},
): Promise<SquadRevision | undefined> {
  const url = `${API}?action=query&prop=revisions&titles=${encodeURIComponent(ARTICLE)}`
    + `&rvlimit=1&rvstart=${season}-12-31T23:59:59Z&rvdir=older`
    + "&rvprop=ids%7Ctimestamp%7Ccontent&rvslots=main&format=json&formatversion=1";

  const body = await fetchJson<RevisionResponse>(url, { refresh: options.refresh });
  const page = Object.values(body.query?.pages ?? {})[0];
  const revision = page?.revisions?.[0];
  const wikitext = revision?.slots?.main?.["*"];
  if (!revision || !wikitext) return undefined;

  const players = parseSquadTemplate(wikitext);
  if (players.length === 0) return undefined;

  return { timestamp: revision.timestamp.slice(0, 10), revisionId: revision.revid, players };
}

/**
 * Innholdet under én overskrift.
 *
 * Mellomrommene rundt overskriftsteksten er ikke til å stole på: artikkelen har
 * både «== Spillerstall ==» og «== Hovedtrenere==» på samme side. Et eksakt
 * strengsøk fant den ene og ikke den andre.
 *
 * Avgrensningen er nødvendig fordi radleseren ellers plukker opp rader fra alle
 * tabeller på sida.
 */
export function sectionNamed(wikitext: string, heading: string): string | undefined {
  const start = new RegExp(`^==\\s*${heading}\\s*==\\s*$`, "im").exec(wikitext);
  if (!start) return undefined;
  const rest = wikitext.slice(start.index + start[0].length);
  const end = /^==[^=]/m.exec(rest);
  return end ? rest.slice(0, end.index) : rest;
}

/** Lenka som skal stå i `sources[].url`, med revisjonen festet. */
export function revisionUrl(revisionId: number): string {
  return `https://no.wikipedia.org/w/index.php?title=${encodeURIComponent(ARTICLE)}&oldid=${revisionId}`;
}

export interface WikipediaCoachSpell {
  name: string;
  fromSeason: number;
  toSeason: number | null;
}

/**
 * Trenertabellen i klubbartikkelen.
 *
 * Kampdataene gir nøyaktige perioder, men bare fra 2010, som er der
 * lagoppstillingene starter. Denne tabellen rekker til 2001, og den er grovere:
 * den oppgir årstall, ikke datoer, og den utelater vikarene. Christian Johnsen
 * står som «2023–24»; at Marius Bøe og Sindre Eid hadde laget imellom, vet bare
 * kampene.
 *
 * De to utfyller derfor hverandre og skal ikke slås sammen til én sannhet:
 * periodene herfra er oppgitte, periodene fra kampene er utledet.
 *
 * Merknadskolonnen leses ikke. Den er prosa, og prosa på Wikipedia er CC BY-SA.
 */
export function parseCoachTable(wikitext: string): WikipediaCoachSpell[] {
  const spells: WikipediaCoachSpell[] = [];

  for (const row of wikitext.split("|-").slice(1)) {
    // «2001–2005», «2008», «2024–». Bindestreken er en tankestrek i kilden.
    const years = /^\s*\|\s*(\d{4})\s*(?:[–-]\s*(\d{2,4})?)?/.exec(row);
    const link = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(row);
    if (!years || !link) continue;

    const from = Number(years[1]);
    const raw = years[2];
    // «2023–24» betyr 2024, ikke år 24.
    const to = raw === undefined
      ? (row.includes("–") || row.includes("-") ? null : from)
      : Number(raw.length === 2 ? `${String(from).slice(0, 2)}${raw}` : raw);

    // Lenka kan peke på en disambigueringsside: [[Christian Johnsen
    // (fotballtrener)|Christian Johnsen]]. Visningsteksten er navnet.
    const name = (link[2] ?? link[1]!).replace(/\s+/g, " ").trim();
    if (name === "" || !Number.isInteger(from)) continue;

    spells.push({ name, fromSeason: from, toSeason: to === null || Number.isInteger(to) ? to : null });
  }

  return spells;
}

/** Trenertabellen slik den står i dag. */
export async function fetchCoachTable(options: { refresh?: boolean } = {}): Promise<{
  timestamp: string;
  revisionId: number;
  spells: WikipediaCoachSpell[];
} | undefined> {
  const url = `${API}?action=query&prop=revisions&titles=${encodeURIComponent(ARTICLE)}`
    + "&rvlimit=1&rvprop=ids%7Ctimestamp%7Ccontent&rvslots=main&format=json&formatversion=1";
  const body = await fetchJson<RevisionResponse>(url, { refresh: options.refresh });
  const page = Object.values(body.query?.pages ?? {})[0];
  const revision = page?.revisions?.[0];
  const wikitext = revision?.slots?.main?.["*"];
  if (!revision || !wikitext) return undefined;

  const section = sectionNamed(wikitext, "Hovedtrenere");
  if (section === undefined) return undefined;

  return {
    timestamp: revision.timestamp.slice(0, 10),
    revisionId: revision.revid,
    spells: parseCoachTable(section),
  };
}
