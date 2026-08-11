import { createHash } from "node:crypto";
import type { KnownPerson } from "./nb-roles.js";
import type { ResolvedLineup } from "@aafkstats/schema";

/**
 * Lagoppstillinger lest ut av en spaltevis lest side.
 *
 * ## Hvorfor dette er den eneste veien til nye fakta
 *
 * Resten av det NB-materialet gir er kildebelegg for noe arkivet alt har:
 * roller på personer vi kjenner, publikasjoner som omtaler dem, sidetall til
 * kamper som står der fra før. Lagoppstillinger fra mellomkrigstiden finnes
 * derimot ikke i arkivet fra noen kilde — hverken RSSSF eller FotMob rekker
 * dit — så de er det ene stedet materialet kan legge til noe.
 *
 * ## Hvorfor de ikke løftes inn
 *
 * En oppstilling må høre til en kamp for å bety noe, og det står nesten aldri
 * på samme sted. «Seierslaget bestod fra mål til ytre venstre av: …» sier hvem
 * som spilte, men ikke mot hvem eller når. Å gjette kampen ut fra nærmeste
 * årstall ville koblet elleve navn til feil kamp — og en feil oppstilling er
 * verre enn ingen, fordi den ser like riktig ut.
 *
 * Derfor stopper dette laget her: oppstillingen leses, navnene slås opp mot
 * registeret, og resten er en redaksjonell oppgave.
 */

/** Vendingene som varsler en oppstilling. */
const TRIGGERS = [
  "laget bestod av",
  "laget besto av",
  "laget var",
  "seierslaget bestod av",
  "seierslaget besto av",
  "lagoppstillingen var",
  "lagoppstilling",
  "stilte med",
  "spilte med",
  "troppen bestod av",
  "troppen besto av",
  "mannskapet var",
];

/**
 * Færre enn dette er ikke en oppstilling.
 *
 * Et fotballag er elleve, men OCR mister navn og kilden nevner ofte bare de
 * som gjorde noe. Sju er lavt nok til å fange en delvis lest rekke, høyt nok
 * til at en setning med et par navn i ikke blir en oppstilling.
 */
const MIN_NAMES = 7;

const NAME_TOKEN = "[A-ZÆØÅÀ-Þ][\\p{L}'’.-]*";
const NAME = `${NAME_TOKEN}(?:\\s+${NAME_TOKEN}){1,3}`;

export interface ResolveLineupsOptions {
  sourceId: string;
  page: string;
  column?: number;
  people: KnownPerson[];
  publicationYear?: number;
}

/** Oppstillingene i én spalte. */
export function resolveLineups(text: string, options: ResolveLineupsOptions): ResolvedLineup[] {
  const found: ResolvedLineup[] = [];

  for (const trigger of TRIGGERS) {
    const pattern = new RegExp(`\\b${trigger.replace(/\s+/g, "\\s+")}\\b([^.]{0,600})`, "giu");
    for (const hit of text.matchAll(pattern)) {
      const names = readNames(hit[1] ?? "");
      if (names.length < MIN_NAMES) continue;

      const resolved = names.map((name) => ({
        name,
        id: options.people.find((person) => person.forms.includes(normalize(name)))?.id,
      }));
      const known = resolved.filter((entry) => entry.id !== undefined);
      const year = yearNear(text, hit.index ?? 0, options.publicationYear);

      found.push({
        id: `oppstilling-${createHash("sha256")
          .update(`${options.sourceId}|${options.page}|${names.map(normalize).join("|")}`)
          .digest("hex").slice(0, 16)}`,
        page: options.page,
        ...(options.column === undefined ? {} : { column: options.column }),
        ...(year ? { season: Number(year) } : {}),
        names,
        personIds: known.map((entry) => entry.id!),
        // Elleve navn er et helt lag. Er halvparten kjent fra før, er lesningen
        // nesten sikkert riktig selv om OCR-en har ødelagt et par av dem.
        confidence: names.length >= 11 && known.length >= names.length / 2 ? "high" : "medium",
      });
    }
  }

  return [...new Map(found.map((lineup) => [lineup.id, lineup])).values()]
    .sort((a, b) => b.names.length - a.names.length);
}

/**
 * Navnene i en oppregning.
 *
 * Rekka brytes ved det første leddet som ikke er et navn. «… Karl Løvoid og
 * Trygve Olsen. Dommeren var …» skal gi ti navn, ikke elleve med dommeren
 * som den siste.
 */
function readNames(run: string): string[] {
  const names: string[] = [];
  const pattern = new RegExp(`(${NAME})\\s*(,|\\bog\\b|$)`, "gu");

  for (const hit of run.matchAll(pattern)) {
    const name = (hit[1] ?? "").trim().replace(/[.,;:]+$/, "");
    if (!isName(name)) break;
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

const NOT_A_NAME = new Set([
  "dommeren", "dommer", "banen", "kampen", "laget", "klubben", "stillingen",
  "aalesunds", "fotballklub", "fotballklubb", "resultatet", "publikum",
]);

function isName(value: string): boolean {
  const tokens = value.split(/\s+/);
  if (tokens.length < 2 || tokens.length > 4) return false;
  if (tokens.some((token) => NOT_A_NAME.has(normalize(token)))) return false;
  if (tokens.some((token) => token.length > 3 && token === token.toUpperCase())) return false;
  return true;
}

function yearNear(text: string, index: number, publicationYear?: number): string | undefined {
  const window = text.slice(Math.max(0, index - 200), index + 200);
  const years = [...window.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map((hit) => hit[1]!);
  const year = years[0];
  if (!year) return undefined;
  if (publicationYear && Number(year) > publicationYear) return undefined;
  return year;
}

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9æøå ]+/g, "").replace(/\s+/g, " ").trim();
}
