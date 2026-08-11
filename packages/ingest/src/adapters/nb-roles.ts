import { createHash } from "node:crypto";
import type { ResolvedRole } from "@aafkstats/schema";

type RoleCategory = ResolvedRole["category"];

/**
 * Roller lest ut av en spaltevis lest side.
 *
 * ## Regelen som bærer det meste
 *
 * Jubileumsbøkene og medlemsbladene skriver styrer på én måte:
 *
 *     Formann, Øivind Haagensen, nestformann, Einar Helseth, sekretær,
 *     Carl Gaaseide, kasserer, Elias Roald, styremedlem, Jørgen Hollevik.
 *
 * Tittelen står foran navnet, og lista går videre uten annet skille enn komma.
 * Leser man den riktig, faller fem verv ut av én setning. Leser man den på
 * tvers av en spalte, forskyves hvert navn ett hakk.
 *
 * ## Hva som ikke gjøres her
 *
 * Ingenting slås sammen med arkivet. Resolveren sier hva siden sier; det er
 * `--apply` som avgjør om det blir en ny rolle, en kilde på en rolle som alt
 * finnes, eller ingenting. Løpende tekst returneres aldri — bare navn, tittel,
 * årstall og sidetall.
 */

interface RoleTerm {
  /** Skrivemåten i teksten, med de lengste først så «nestformann» slår «formann». */
  term: string;
  title: string;
  category: RoleCategory;
}

/** Rekkefølgen er signifikant: lengste treff vinner. */
export const ROLE_TERMS: RoleTerm[] = [
  { term: "sportslig leder", title: "Sportslig leder", category: "sporting_staff" },
  { term: "daglig leder", title: "Daglig leder", category: "administration" },
  { term: "administrerende direktør", title: "Administrerende direktør", category: "administration" },
  { term: "nestformann", title: "Nestformann", category: "board" },
  { term: "styremedlem", title: "Styremedlem", category: "board" },
  { term: "varamedlem", title: "Varamedlem", category: "board" },
  { term: "æresmedlem", title: "Æresmedlem", category: "honorary" },
  { term: "styreleder", title: "Styreleder", category: "board" },
  { term: "hovedtrener", title: "Hovedtrener", category: "coach" },
  { term: "materialforvalter", title: "Materialforvalter", category: "sporting_staff" },
  { term: "sekretær", title: "Sekretær", category: "administration" },
  { term: "kasserer", title: "Kasserer", category: "administration" },
  { term: "oppmann", title: "Oppmann", category: "sporting_staff" },
  { term: "direktør", title: "Direktør", category: "administration" },
  { term: "formann", title: "Formann", category: "board" },
  { term: "trener", title: "Trener", category: "coach" },
];

/**
 * Ord som ser ut som navn for en stor forbokstav, men ikke er det.
 *
 * Lista er kort med vilje. Hvert ledd her fjerner treff, og et navn som slipper
 * gjennom kan rettes; et navn som stilltiende forsvinner kan ingen se.
 */
const NOT_A_NAME = new Set([
  "aalesunds", "aalesund", "ålesund", "klubben", "klubbens", "styret", "styrets", "stiftelsen",
  "hovedstyret", "arbeidsutvalget", "laget", "lagets", "norges", "fotballforbund", "fotballklub",
  "fotballklubb", "fotballklubben", "medlemsblad", "hvilken", "hvem", "den", "det", "denne",
  "dette", "der", "her", "han", "hun", "som", "ble", "var", "har", "til", "for", "med", "og",
  "gruppe", "gruppen", "komité", "komiteen", "møtet", "årsmøtet", "sesongen", "kretsen",
]);

const NAME_TOKEN = "[A-ZÆØÅÀ-Þ][\\p{L}'’.-]*";

/**
 * Rolleordet skrevet slik at det treffer uansett forbokstav — uten `i`-flagg.
 *
 * Flagget ville gjort hele mønsteret case-insensitivt, også navnedelen, og da
 * blir «med» og «satt» gyldige navneledd. Første versjon leste «med Ola
 * Nordmann» som navnet, og treffet falt ut igjen i navnekontrollen: vervet
 * forsvant uten at noe sa fra.
 */
function anyCase(term: string): string {
  return [...term].map((letter) => {
    const upper = letter.toUpperCase();
    return upper === letter ? escapeRegExp(letter) : `[${upper}${letter}]`;
  }).join("");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const NAME = `${NAME_TOKEN}(?:\\s+(?:van|von|de|da|di|le|la)\\s+|\\s+)?(?:${NAME_TOKEN}(?:\\s+${NAME_TOKEN})?(?:\\s+${NAME_TOKEN})?)`;

export interface KnownPerson {
  id: string;
  name: string;
  /** Alle skrivemåter, normalisert. */
  forms: string[];
}

export interface ResolveRolesOptions {
  sourceId: string;
  page: string;
  column?: number;
  /** Personregisteret, så et treff kan avstemmes i stedet for å bli en ny person. */
  people: KnownPerson[];
  /** Publikasjonens eget år. Brukes aldri som rollens år — bare til å forkaste umulige årstall. */
  publicationYear?: number;
}

/**
 * Rollene i én spalte.
 *
 * `lines` brukes til radregelen (formannsrekker står som «1917 Nils Jangaard»),
 * `text` til setningsreglene. De to ser på samme spalte.
 */
export function resolveRoles(lines: string[], text: string, options: ResolveRolesOptions): ResolvedRole[] {
  const found: ResolvedRole[] = [];
  for (const role of yearRows(lines, options)) found.push(role);
  for (const role of roleThenName(text, options)) found.push(role);
  for (const role of nameThenRole(text, options)) found.push(role);

  // Samme verv kan treffes av to regler. Behold det sterkeste treffet per
  // person, tittel og år — ellers teller den samme opplysningen dobbelt.
  const best = new Map<string, ResolvedRole>();
  for (const role of found) {
    const key = `${normalize(role.personName)}|${role.title}|${role.from ?? ""}`;
    const current = best.get(key);
    if (!current || rank(role) > rank(current)) best.set(key, role);
  }
  return [...best.values()].sort((a, b) => a.personName.localeCompare(b.personName, "nb") || a.title.localeCompare(b.title, "nb"));
}

/** «Formann, Øivind Haagensen, nestformann, Einar Helseth, …» */
function* roleThenName(text: string, options: ResolveRolesOptions): Generator<ResolvedRole> {
  for (const term of ROLE_TERMS) {
    const pattern = new RegExp(`\\b${anyCase(term.term)}\\b[\\s,:.]+(${NAME})`, "gu");
    for (const hit of text.matchAll(pattern)) {
      const name = cleanName(hit[1] ?? "");
      if (!name) continue;
      yield build(term, name, nearestYear(text, hit.index ?? 0, options), "role_then_name", options);
    }
  }
}

/** «… med Georg Haller som dens første formann» */
function* nameThenRole(text: string, options: ResolveRolesOptions): Generator<ResolvedRole> {
  for (const term of ROLE_TERMS) {
    const pattern = new RegExp(`(${NAME})\\s+(?:som|ble|var)\\b[^.;]{0,40}?\\b${anyCase(term.term)}\\b`, "gu");
    for (const hit of text.matchAll(pattern)) {
      const name = cleanName(hit[1] ?? "");
      if (!name) continue;
      yield build(term, name, nearestYear(text, hit.index ?? 0, options), "name_then_role", options);
    }
  }
}

/**
 * «1917 Nils Jangaard» og «1918—19 Georg Haller».
 *
 * Formannsrekkene står som tabell, én rad per år. Det var en slik rad piloten
 * i #73 leste for hånd på side 18 i 1939-boka, og den er den eneste regelen
 * her som gir både `from` og `to` uten å gjette.
 */
function* yearRows(lines: string[], options: ResolveRolesOptions): Generator<ResolvedRole> {
  // «formann» blir «formenn» og «formennene» i flertall. Uten de formene
  // finner overskriftsprøven ingen formannsrekke å lese radene under.
  const heading = ROLE_TERMS.find((term) => lines.some((line) => headingPattern(term.term).test(line)));
  if (!heading) return;

  const row = new RegExp(`^(\\d{4})(?:\\s*[-–—]\\s*(\\d{2,4}))?[\\s.:]+(${NAME})$`, "u");
  for (const line of lines) {
    const hit = row.exec(line.trim());
    if (!hit) continue;
    const name = cleanName(hit[3] ?? "");
    if (!name) continue;
    const from = hit[1]!;
    const to = hit[2] ? (hit[2].length === 2 ? `${from.slice(0, 2)}${hit[2]}` : hit[2]) : null;
    yield build(heading, name, { from, to }, "year_row", options);
  }
}

const IRREGULAR_PLURALS: Record<string, string[]> = {
  formann: ["formenn", "formennene"],
  nestformann: ["nestformenn", "nestformennene"],
  oppmann: ["oppmenn", "oppmennene"],
};

function headingPattern(term: string): RegExp {
  const forms = [`${term}(?:ene|er|ne)?`, ...(IRREGULAR_PLURALS[term] ?? [])];
  return new RegExp(`\\b(?:${forms.join("|")})\\b`, "iu");
}

function build(
  term: RoleTerm,
  personName: string,
  period: { from?: string; to: string | null },
  rule: ResolvedRole["rule"],
  options: ResolveRolesOptions,
): ResolvedRole {
  const known = options.people.find((person) => person.forms.includes(normalize(personName)));
  const confidence: ResolvedRole["confidence"] = period.from && known
    ? "high"
    : period.from || known
      ? "medium"
      : "low";

  const id = `rolle-${createHash("sha256")
    .update(`${options.sourceId}|${options.page}|${term.title}|${normalize(personName)}|${period.from ?? ""}`)
    .digest("hex").slice(0, 16)}`;

  return {
    id,
    page: options.page,
    ...(options.column === undefined ? {} : { column: options.column }),
    personName,
    ...(known ? { personId: known.id } : {}),
    category: term.category,
    title: term.title,
    ...(period.from ? { from: period.from } : {}),
    to: period.to,
    confidence,
    rule,
  };
}

/**
 * Årstallet som hører til et treff.
 *
 * Bare år som står foran treffet og nær nok til å kunne gjelde det samme.
 * Uten en avstandsgrense ville et årstall øverst på siden fulgt med på hvert
 * eneste verv lenger nede, og rollen fått et `from` ingen kilde står inne for.
 */
function nearestYear(text: string, index: number, options: ResolveRolesOptions): { from?: string; to: string | null } {
  const window = text.slice(Math.max(0, index - 160), index);
  const years = [...window.matchAll(/\b(18[5-9]\d|19\d{2}|20\d{2})\b/g)].map((hit) => hit[1]!);
  const year = years.at(-1);
  if (!year) return { to: null };
  if (options.publicationYear && Number(year) > options.publicationYear) return { to: null };
  return { from: year, to: null };
}

function cleanName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim().replace(/[.,;:]+$/, "");
  const tokens = name.split(" ");
  if (tokens.length < 2 || tokens.length > 4) return null;
  if (tokens.some((token) => NOT_A_NAME.has(normalize(token)))) return null;
  if (ROLE_TERMS.some((term) => normalize(name).includes(term.term))) return null;
  // Versaler er overskrift eller bildetekst, ikke et navn i løpende tekst.
  if (tokens.some((token) => token.length > 3 && token === token.toUpperCase())) return null;
  if (tokens.some((token) => token.length > 2 && !/^[A-ZÆØÅÀ-Þ]/u.test(token) && !/^(van|von|de|da|di|le|la)$/i.test(token))) return null;
  return name;
}

function rank(role: ResolvedRole): number {
  const confidence = role.confidence === "high" ? 3 : role.confidence === "medium" ? 2 : 1;
  // En tabellrad er sikrere enn en setning: den oppgir året uttrykkelig.
  return confidence * 10 + (role.rule === "year_row" ? 3 : role.rule === "role_then_name" ? 2 : 1);
}

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9æøå ]+/g, "").replace(/\s+/g, " ").trim();
}

/** Personregisteret på formen resolveren trenger. */
export function knownPeople(people: Array<{ id: string; name: string; names: string[] }>): KnownPerson[] {
  return people.map((person) => ({
    id: person.id,
    name: person.name,
    forms: [person.name, ...person.names].map(normalize),
  }));
}
