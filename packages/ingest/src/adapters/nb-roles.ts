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
 * Organisasjonsdelen et verv hører til, når siden sier hvilken.
 *
 * Side 76 i 50-årsboka lister et styre — formann, nestformann, sekretær,
 * kasserer — men det er styret i *Eldres gruppe*, ikke klubbens hovedstyre.
 * Rekka ser identisk ut. Uten `body` havner de fire i personregisteret som om
 * de ledet AaFK, og ingen validering ville sagt fra.
 *
 * Organet står sjelden i samme setning som vervet. Det står i avsnittet over,
 * som overskrift eller som emnet for stykket, så det må letes bakover.
 */
const BODIES = [
  "hovedstyret",
  "arbeidsutvalget",
  "sportsutvalget",
  "banekomiteen",
  "eldres gruppe",
  "juniorgruppa",
  "juniorgruppen",
  "damegruppa",
  "damegruppen",
  "supporterklubben",
  "old boys",
] as const;

/** Organet siden peker på, når den peker på nøyaktig ett. */
function bodiesOn(page: string | undefined): string[] {
  if (!page) return [];
  const lower = page.toLowerCase();
  const found = new Set<string>();
  for (const body of BODIES) if (lower.includes(body)) found.add(body);
  for (const hit of page.matchAll(/\b([\p{L}æøå]+(?:komiteen|komitéen|utvalget|gruppa|gruppen))\b/giu)) {
    found.add(hit[1]!.toLowerCase());
  }
  found.delete("hovedstyret");
  // «Arbeidsutvalget» treffer både lista og monsteret. Fjern det som er del av
  // et annet, slik at samme organ ikke telles to ganger.
  return [...found].filter((body) => ![...found].some((other) => other !== body && other.includes(body)));
}

/** Hvor langt bakover et organ kan stå og fortsatt gjelde vervet. */
const BODY_REACH = 400;

/**
 * Organet som gjelder for et treff, lest bakover fra det.
 *
 * Både en fast liste og et generisk mønster: klubbene lager stadig nye utvalg,
 * og «bygningskomiteen» skal fanges selv om ingen har skrevet den inn her.
 * Hovedstyret regnes ikke som et eget organ — det er standarden, og å skrive
 * det på hver rolle sier ingenting.
 */
function bodyBefore(text: string, index: number, options: ResolveRolesOptions): BodyHint | undefined {
  const window = text.slice(Math.max(0, index - BODY_REACH), index);

  const named = [...BODIES]
    .map((body) => ({ body, at: window.toLowerCase().lastIndexOf(body) }))
    .filter((hit) => hit.at !== -1)
    .sort((a, b) => b.at - a.at)[0];

  const generic = [...window.matchAll(/\b([\p{L}æøå]+(?:komiteen|komitéen|utvalget|gruppa|gruppen))\b/giu)].at(-1);

  const onPage = bodiesOn(options.pageContext);
  const chosen = named && generic
    ? (named.at >= (generic.index ?? 0) ? named.body : generic[1]!)
    : named?.body ?? generic?.[1]
      // Ingen organ i spalten. Da gjelder sidas eget, men bare nar siden peker
      // pa noyaktig ett — nevner den flere, vet vi ikke hvilket som er dette.
      ?? (onPage.length === 1 ? onPage[0] : undefined);

  if (!chosen) {
    // Siden snakker om underorganer, men vi kan ikke si hvilket vervet horer
    // til. Da er «Formann» uten videre en pastand om at han ledet klubben, og
    // den kan vi ikke sta inne for. Side 76 i 50-arsboka er et slikt tilfelle:
    // den nevner bade Eldres gruppe og Arbeidsutvalget.
    return onPage.length > 1 ? { uncertain: true } : undefined;
  }

  // OCR-en gir samme organ to skrivemåter — «Banekomiteen» og «Banekomitéen»
  // sto som 97 og 44 roller hver, som om de var to utvalg.
  const normalized = chosen.toLowerCase().replaceAll("é", "e");
  if (normalized === "hovedstyret") return undefined;
  return { body: normalized.charAt(0).toUpperCase() + normalized.slice(1) };
}

/** Organet et verv horer til, eller beskjed om at siden gjor det uklart. */
interface BodyHint {
  body?: string;
  /** Siden nevner flere organer, og vervet kan ikke regnes som klubbens. */
  uncertain?: boolean;
}

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
/**
 * Skrivemåter av klubben selv, som prefiks på et rolleord.
 *
 * «AaFK-trener» er vår; «RBK-trener» er ikke. Uten dette ble Per Joar Hansen
 * ført som trener i 2013 fra setningen «ga RBK-trener Per Joar Hansen denne
 * karakteristikken» — mens arkivets egne kampdata sier at Jan Jönsson ledet
 * laget det året.
 */
const OURS = ["aafk", "afk", "åfk", "aalesund", "aalesunds", "ålesund"];

/** Er rolleordet satt sammen med en annen klubbs navn? */
function belongsToAnother(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 40), index);
  const compound = /([\p{L}.]+)-$/u.exec(before);
  if (compound) return !OURS.includes(compound[1]!.toLowerCase().replace(/\./g, ""));
  // Et rolleord midt i et ord er ikke et rolleord.
  return /\p{L}$/u.test(before);
}

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
  /**
   * Hele siden i leserekkefølge, når rollene leses spaltevis.
   *
   * Organet et verv hører til står ofte i en annen spalte enn vervet selv: på
   * side 76 i 50-årsboka innledes stykket om Eldres gruppe i venstre spalte,
   * mens styret deres står i høyre. Leses spalten alene, finnes organet ikke.
   */
  pageContext?: string;
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
  for (const role of nameThenYear(text, options)) found.push(role);

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
      if (belongsToAnother(text, hit.index ?? 0)) continue;
      yield build(term, name, nearestYear(text, hit.index ?? 0, options), "role_then_name", options, bodyBefore(text, hit.index ?? 0, options));
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

      // Rolleordet står bakerst i treffet her, ikke fremst.
      const roleAt = (hit.index ?? 0) + hit[0].length - term.term.length;
      if (belongsToAnother(text, roleAt)) continue;

      const rest = text.slice((hit.index ?? 0) + hit[0].length);
      // «Som formann i «Frigg»» og «formann i banekomiteen» er verv i noe annet
      // enn klubben. Uten denne prøven ble Georg Halles formannsverv i Frigg
      // og Emil Sandøs verv i banekomiteen til formannsverv i AaFK.
      if (/^\s*(?:i|for)\s+(?!\d)/u.test(rest)) continue;

      yield build(term, name, followingYear(rest) ?? nearestYear(text, hit.index ?? 0, options), "name_then_role", options, bodyBefore(text, hit.index ?? 0, options));
    }
  }
}

/**
 * Årstallet som følger rett etter rolleordet.
 *
 * «Nils Jangaard ble valgt til sekretær i 1915, ble formann i 1917» — året står
 * bak, ikke foran. Leter man bare bakover, tar man årstallet fra setningen før:
 * her ga «spilte som aktiv fra 1914 til 1919» ham sekretærvervet i 1919, fire år
 * feil, og det sto som et faktum i arkivet til denne prøven kom på plass.
 */
function followingYear(rest: string): { from?: string; to: string | null } | null {
  const hit = /^\s*(?:i|fra|siden)?\s*(1[89]\d{2}|20\d{2})\b/u.exec(rest);
  return hit ? { from: hit[1]!, to: null } : null;
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
  // «Opmenn» er skrivematen i 1939-boka, for rettskrivingsreformen.
  oppmann: ["oppmenn", "oppmennene", "opmenn", "opmennene", "opmann"],
};

function headingForms(term: string): string[] {
  return [`${term}(?:ene|er|ne)?`, ...(IRREGULAR_PLURALS[term] ?? [])];
}

function headingPattern(term: string): RegExp {
  return new RegExp(`\\b(?:${headingForms(term).join("|")})\\b`, "iu");
}

/**
 * «Formenn: Sverre Mogstad 1925 og 1926 Rolf Mittet 1927 Georg Haller 1914 og 1915 …»
 *
 * Formannsrekka i jubileumsskriftet fra 1939 star ikke som tabell, men som
 * lopende tekst etter en overskrift i flertall. Det er nettopp den lista
 * piloten i #73 leste for hand pa trykt side 18, og den baerer bade navnet og
 * arstallene — «1914 og 1915» blir `from` 1914 og `to` 1915, slik piloten
 * forte den.
 *
 * Rekkevidden er begrenset til et stykke etter overskriften. Uten det ville
 * hvert navn lenger nede pa siden blitt formann.
 */
function* nameThenYear(text: string, options: ResolveRolesOptions): Generator<ResolvedRole> {
  const entry = new RegExp(`(${NAME})\\s+(\\d{4}(?:\\s*(?:og|,|–|—|-)\\s*\\d{4})*)`, "gu");

  for (const term of ROLE_TERMS) {
    const heading = new RegExp(`\\b(?:${headingForms(term.term).join("|")})\\s*:`, "giu");
    for (const start of text.matchAll(heading)) {
      const from = (start.index ?? 0) + start[0].length;
      for (const hit of text.slice(from, nextHeading(text, from)).matchAll(entry)) {
        const name = cleanName(hit[1] ?? "");
        if (!name) continue;
        const years = [...(hit[2] ?? "").matchAll(/\d{4}/g)].map((year) => year[0]);
        const first = years[0];
        if (!first) continue;
        if (options.publicationYear && Number(first) > options.publicationYear) continue;
        yield build(term, name, { from: first, to: years.length > 1 ? years.at(-1)! : null }, "name_then_year", options);
      }
    }
  }
}

/** Hvor langt etter en overskrift en rekke leses når ingen ny overskrift følger. */
const LIST_REACH = 400;

/**
 * Der en rekke slutter: ved neste rolleoverskrift, ellers etter `LIST_REACH`.
 *
 * Side 18 i 1939-boka har «Formenn:» og «Opmenn:» rett etter hverandre. Uten
 * denne grensen rakk den første overskriften ned i den andre rekka, og hvert
 * navn fikk begge vervene.
 */
function nextHeading(text: string, from: number): number {
  let end = from + LIST_REACH;
  for (const term of ROLE_TERMS) {
    const heading = new RegExp(`\\b(?:${headingForms(term.term).join("|")})\\s*:`, "giu");
    heading.lastIndex = from;
    const hit = heading.exec(text);
    if (hit && hit.index > from && hit.index < end) end = hit.index;
  }
  return end;
}

function build(
  term: RoleTerm,
  personName: string,
  period: { from?: string; to: string | null },
  rule: ResolvedRole["rule"],
  options: ResolveRolesOptions,
  hint?: BodyHint,
): ResolvedRole {
  const known = options.people.find((person) => person.forms.includes(normalize(personName)));
  const body = hint?.body;
  const strongest: ResolvedRole["confidence"] = period.from && known
    ? "high"
    : period.from || known
      ? "medium"
      : "low";
  // Et verv siden ikke plasserer, skal ikke kunne loftes automatisk.
  const confidence: ResolvedRole["confidence"] = hint?.uncertain && strongest === "high" ? "medium" : strongest;

  const id = `rolle-${createHash("sha256")
    .update(`${options.sourceId}|${options.page}|${term.title}|${normalize(personName)}|${period.from ?? ""}|${body ?? ""}`)
    .digest("hex").slice(0, 16)}`;

  return {
    id,
    page: options.page,
    ...(options.column === undefined ? {} : { column: options.column }),
    personName,
    ...(known ? { personId: known.id } : {}),
    category: term.category,
    title: term.title,
    ...(body ? { body } : {}),
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
