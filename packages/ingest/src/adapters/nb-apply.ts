import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isMap, isSeq, parseDocument, stringify } from "yaml";
import { person as personSchema, personPath } from "@aafkstats/schema";
import type { Person, ResolvedRole } from "@aafkstats/schema";
import type { Archive } from "@aafkstats/schema/load";

/**
 * Løfter resolverte roller inn i personfilene.
 *
 * ## Hva som slippes gjennom
 *
 * Bare roller som er sikre *og* peker på en person arkivet alt har. En rolle
 * uten årstall kan ikke bli en rolle — skjemaet krever `from` — og et navn
 * arkivet ikke kjenner ville blitt en ny personfil bygget på OCR. Det siste er
 * nettopp der feilene kommer inn: av 630 navn i kandidatlaget fantes 14 fra
 * før, og 16 % av resten var OCR-fragmenter som «AAFK-lag. Klubbens».
 *
 * Resten blir liggende i `resolvedRoles` med sin egen confidence, søkbar, til
 * et menneske eller en senere kjøring tar dem.
 *
 * ## Hvorfor den alltid leter etter en rolle som finnes fra før
 *
 * De samme vervene kommer fra flere kanter: piloten leste dem for hånd fra
 * jubileumsboka, aafk.no-høstingen legger inn formannsrekker og hedersmerker,
 * og denne kjøringen leser dem fra medlemsbladene. Treffer to kilder samme
 * verv, skal det bli én rolle med to kilder — ikke to roller.
 */

/**
 * Titler som er samme verv med to navn.
 *
 * «Formann» ble til «styreleder» da klubben moderniserte språket, og
 * jubileumsboka bruker det nye ordet om en mann aafk.no fører med det gamle.
 * Uten denne lista ble Arnstein Johansen stående med begge for 1998, som om
 * han hadde to verv.
 */
/**
 * Verv der to samtidige innehavere ikke gir mening.
 *
 * Trener er ikke ett av dem. Trenerrekka på side 351 i Tango siden 1914 har to
 * navn på 1961, 1975, 1984, 1993 og 2008 — bytte midt i sesongen er vanlig.
 */
const SINGULAR = new Set(["board", "administration", "sporting_staff"]);

const SAME_OFFICE: Record<string, string> = {
  styreleder: "formann",
  nestleder: "nestformann",
  varaformann: "nestformann",
};

/** Årene en rolle dekker, fra og med til og med. */
function span(from: string, to: string | null): string[] {
  const first = Number(from.slice(0, 4));
  const last = to ? Number(to.slice(0, 4)) : first;
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first || last - first > 40) return [String(first)];
  return Array.from({ length: last - first + 1 }, (_, step) => String(first + step));
}

/**
 * Er vervet klubbens eget, eller et underorgans?
 *
 * `body` skiller dem — men «Hovedstyret» er ikke et underorgan, det *er*
 * klubben. aafk.no-høstingen setter det uttrykkelig på formannsrekka, og en
 * prøve som bare spør om `body` finnes, leste den som «gjelder ikke klubben».
 * Da kunne en formann fra et medlemsblad legge seg oppå den uten at noe sa fra.
 */
function clubWide(body: string | undefined): boolean {
  return body === undefined || body.toLowerCase() === "hovedstyret";
}

function office(title: string): string {
  const key = title.toLowerCase();
  return SAME_OFFICE[key] ?? key;
}

export interface ApplyReport {
  /** Nye roller lagt på en person som fantes fra før. */
  added: number;
  /** Roller som alt sto der, og som nå har publikasjonen som kilde i tillegg. */
  corroborated: number;
  /** Resolusjoner som ikke var sikre nok, eller som mangler person eller år. */
  skipped: number;
  /**
   * Roller som ville skapt en selvmotsigelse i arkivet.
   *
   * To formenn samme år kan ikke begge stemme, og en «Formann» ved siden av en
   * «Formann i banekomiteen» samme år er nesten sikkert den samme opplysningen
   * lest uten leddet som forklarer den. Ingen av delene kan maskinen avgjøre,
   * så de holdes utenfor og telles her.
   */
  conflicting: number;
}

/** En resolusjon sammen med publikasjonen den ble lest i. */
export interface RoleFinding {
  sourceId: string;
  role: ResolvedRole;
}

export async function applyResolvedRoles(archive: Archive, findings: RoleFinding[], root: string): Promise<ApplyReport> {
  const report: ApplyReport = { added: 0, corroborated: 0, skipped: 0, conflicting: 0 };

  /** Hvem som allerede innehar et klubbverv et gitt år. */
  const heldBy = new Map<string, string>();
  for (const person of archive.people) {
    for (const role of person.roles) {
      if (!clubWide(role.body) || !SINGULAR.has(role.category)) continue;
      for (const year of span(role.from, role.to)) heldBy.set(`${office(role.title)}|${year}`, person.id);
    }
  }
  const byId = new Map(archive.people.map((person) => [person.id, structuredClone(person)]));
  const touched = new Set<string>();

  for (const { sourceId, role } of bySourceOrder(findings)) {
    const person = role.personId ? byId.get(role.personId) : undefined;
    if (!person || role.confidence !== "high" || !role.from) {
      report.skipped += 1;
      continue;
    }

    const existing = person.roles.find((candidate) =>
      candidate.category === role.category
      && office(candidate.title) === office(role.title)
      && candidate.from === role.from);

    if (existing) {
      if (existing.sources.some((source) => source.sourceId === sourceId && source.page === role.page)) continue;
      existing.sources = [...existing.sources, sourceRef(sourceId, role)];
      report.corroborated += 1;
      touched.add(person.id);
      continue;
    }

    // Et mer presist verv samme år er den samme opplysningen, lest med leddet
    // som forklarer den. «Formann i banekomiteen» slår «Formann».
    const year = role.from.slice(0, 4);
    const moreSpecific = person.roles.some((candidate) =>
      candidate.from.slice(0, 4) === year
      && candidate.title.toLowerCase() !== role.title.toLowerCase()
      && candidate.title.toLowerCase().startsWith(`${role.title.toLowerCase()} `));
    // To personer kan ikke ha samme klubbverv samme år.
    // Hele perioden må være ledig, ikke bare startåret. «Sigurd Nørve
    // 1946-1949» og «Per Anker Eriksen 1948» har ulike startår og ville begge
    // sluppet gjennom en prøve på år alene — samtidig som de sier at klubben
    // hadde to formenn i 1948.
    const takenBy = !clubWide(role.body) || !SINGULAR.has(role.category)
      ? undefined
      : span(role.from, role.to).map((each) => heldBy.get(`${office(role.title)}|${each}`)).find((id) => id !== undefined);
    if (moreSpecific || (takenBy !== undefined && takenBy !== person.id)) {
      report.conflicting += 1;
      continue;
    }

    person.roles = [...person.roles, {
      id: roleId(person, role),
      category: role.category,
      title: role.title,
      ...(role.body ? { body: role.body } : {}),
      from: role.from,
      to: role.to,
      sources: [sourceRef(sourceId, role)],
      note: "Lest maskinelt fra publikasjonen. Bør etterkontrolleres mot den oppgitte siden.",
    }].sort((a, b) => a.from.localeCompare(b.from) || a.title.localeCompare(b.title, "nb"));
    report.added += 1;
    if (clubWide(role.body) && SINGULAR.has(role.category)) {
      for (const each of span(role.from, role.to)) heldBy.set(`${office(role.title)}|${each}`, person.id);
    }
    touched.add(person.id);
  }

  for (const id of touched) {
    const person = byId.get(id)!;
    // Kontroller mot skjemaet før noe skrives. Skrivingen selv går gjennom
    // dokumentet på disk, ikke gjennom dette objektet.
    personSchema.parse(person) satisfies Person;
    const file = resolve(root, personPath(person.id));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, await rewrite(file, person), "utf8");
  }

  return report;
}

/**
 * Skriver personfila med formateringen den alt har.
 *
 * En full omskriving ville vært enklere, men personfilene er skrevet av flere
 * verktøy med hver sin stil — aafk.no-høstingen bruker kompakt flytstil, de
 * eldre bruker blokkstil — og en omskriving blåser opp hele fila. Da drukner de
 * to nye rollene i tre hundre linjer omformatering, og diffen er den eneste
 * kontrollen et datarepo har.
 *
 * Derfor: rør bare `roles`, og bare de nodene som faktisk er endret.
 */
async function rewrite(file: string, person: Person): Promise<string> {
  if (!existsSync(file)) return stringify(person, { lineWidth: 0, defaultStringType: "PLAIN" });

  const doc = parseDocument(await readFile(file, "utf8"));
  const roles = doc.get("roles");
  if (!isSeq(roles)) return stringify(person, { lineWidth: 0, defaultStringType: "PLAIN" });

  const byRoleId = new Map<string, unknown>();
  for (const item of roles.items) {
    if (isMap(item)) byRoleId.set(String(item.get("id")), item);
  }

  for (const role of person.roles) {
    const node = byRoleId.get(role.id);
    if (node === undefined) {
      // Sett den inn kronologisk. Rollene i disse filene står etter årstall, og
      // en ny rolle på slutten ville brutt den rekkefølgen uten å gjøre diffen
      // det minste mindre.
      const at = roles.items.findIndex((item) => isMap(item) && String(item.get("from")) > role.from);
      const created = doc.createNode(role);
      if (at === -1) roles.add(created);
      else roles.items.splice(at, 0, created);
      continue;
    }
    if (!isMap(node)) continue;
    // Rollen fantes fra før; det eneste som kan ha endret seg er kildelista.
    const sources = node.get("sources");
    if (isSeq(sources) && sources.items.length < role.sources.length) {
      for (const source of role.sources.slice(sources.items.length)) sources.add(doc.createNode(source));
    }
  }

  // Rollene som ikke er rørt beholder stilen sin, men flytsamlinger blir
  // re-formatert av serialisereren uansett innstilling: originalen har
  // «{ id: … }» med luft og «[title, from]» uten, og de to følger samme flagg.
  // Linjene blir like i innhold, ikke i tegnsetting.
  const sources = doc.get("sources");
  if (person.sources.length > 0) {
    if (!isSeq(sources)) doc.set("sources", doc.createNode(person.sources));
    else if (sources.items.length < person.sources.length) {
      const present = new Set(sources.items.map((item) => (isMap(item) ? String(item.get("sourceId")) : "")));
      for (const source of person.sources) {
        if (!present.has(source.sourceId)) sources.add(doc.createNode(source));
      }
    }
  }

  return doc.toString({ lineWidth: 0, defaultStringType: "PLAIN" });
}

function sourceRef(sourceId: string, role: ResolvedRole): { sourceId: string; page: string; fields: string[]; note: string } {
  // Spaltenummeret finnes bare når rollen kom fra en ALTO-side. De to bøkene
  // uten ALTO leses gjennom fulltekstsøket, der det ikke er noen spalte å vise
  // til — og et notat som sier «spalte 1» om en tekst som aldri ble lest
  // spaltevis, er en påstand kilden ikke dekker.
  const where = role.column === undefined
    ? "fulltekstsøkets kontekst"
    : `spalte ${role.column + 1} på siden`;
  return {
    sourceId,
    page: role.page,
    fields: role.to === null ? ["title", "from"] : ["title", "from", "to"],
    note: `Lest maskinelt fra ${where} (regel: ${role.rule}).`,
  };
}

/**
 * En rolle-ID som er stabil for personen, slik at to kjøringer ikke lager to
 * roller for samme verv.
 */
function roleId(person: Person, role: ResolvedRole): string {
  const base = `${slugPart(role.title)}-${role.from!.slice(0, 4)}`;
  if (!person.roles.some((existing) => existing.id === base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!person.roles.some((existing) => existing.id === candidate)) return candidate;
  }
}

function slugPart(value: string): string {
  return value.toLowerCase()
    .replaceAll("æ", "ae").replaceAll("ø", "o").replaceAll("å", "a")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Sikreste først, så en svakere lesning ikke legger seg foran en sterkere. */
function bySourceOrder(findings: RoleFinding[]): RoleFinding[] {
  const weight = { high: 0, medium: 1, low: 2 } as const;
  return [...findings].sort((a, b) =>
    weight[a.role.confidence] - weight[b.role.confidence] || a.role.id.localeCompare(b.role.id));
}

/**
 * Publikasjonene som omtaler en person, ført som kilder på personen.
 *
 * ## Hva som kan gå galt, og hva som ikke kan
 *
 * En `person_mention` med høy sikkerhet er et navn OCR-en fant og som
 * `candidatesForPage` alt har slått opp mot personregisteret. OCR-støy kan
 * derfor ikke skape et nytt faktum her: enten kjente vi navnet fra før, eller
 * så ble det ingen kobling.
 *
 * Men et navnetreff skiller ikke to personer som heter det samme. Arne Hansen
 * spilte i 1986; medlemsbladene fra 1961 til 1976 omtaler en annen Arne Hansen,
 * og uten en prøve på tid ble alle seksten ført på ham. En tredjedel av
 * koblingene i første forsøk var slike.
 *
 * Derfor kreves det at publikasjonen ikke er eldre enn personen selv. Prøven er
 * ensidig med vilje: en jubileumsbok fra 2013 omtaler selvsagt spillere fra
 * 1920-tallet, og skal få lov. Det motsatte er umulig.
 *
 * Omtalen sier heller ingenting om hva personen gjorde. Den sier at
 * publikasjonen omtaler ham, og det er nettopp det en kildehenvisning betyr.
 *
 * ## Én henvisning per publikasjon
 *
 * Lauritz Giske er nevnt på 283 sider. Én henvisning per side ville gjort
 * personfila ulesbar uten å si mer enn at bladene skrev om ham. Derfor
 * aggregeres de til én per publikasjon, med den første siden han står på.
 */
export interface MentionFinding {
  personId: string;
  sourceId: string;
  page: string;
  /** Publikasjonens utgivelsesår, når kilden oppgir det. */
  sourceYear?: number;
}

/**
 * Hvor mange år før en person er kjent i arkivet en publikasjon kan omtale ham.
 *
 * Et medlemsblad skriver om juniorlaget før noen står i A-stallen, så det må
 * være litt slark. Seksten år, som mellom de to Arne Hansen-ene, er ikke slark.
 */
const LEAD_YEARS = 5;

/** Det tidligste året arkivet vet om personen. */
function earliestYear(person: Person): number | undefined {
  const years = [
    ...person.squadNumbers.map((entry) => entry.season),
    ...person.coachSpells.map((spell) => spell.fromSeason),
    ...person.roles.map((role) => Number(role.from.slice(0, 4))),
  ].filter((year) => Number.isFinite(year));
  return years.length > 0 ? Math.min(...years) : undefined;
}

export async function applyPersonMentions(
  archive: Archive,
  mentions: MentionFinding[],
  root: string,
): Promise<{ added: number; people: number; anachronistic: number }> {
  const first = new Map<string, MentionFinding>();
  for (const mention of mentions) {
    const key = `${mention.personId}|${mention.sourceId}`;
    const current = first.get(key);
    if (!current || Number(mention.page) < Number(current.page)) first.set(key, mention);
  }

  const byId = new Map(archive.people.map((person) => [person.id, structuredClone(person)]));
  const touched = new Set<string>();
  let added = 0;
  let anachronistic = 0;

  for (const mention of [...first.values()].sort((a, b) => a.personId.localeCompare(b.personId) || a.sourceId.localeCompare(b.sourceId))) {
    const person = byId.get(mention.personId);
    if (!person) continue;

    const earliest = earliestYear(person);
    if (mention.sourceYear !== undefined && earliest !== undefined && mention.sourceYear < earliest - LEAD_YEARS) {
      anachronistic += 1;
      continue;
    }

    // En publikasjon som alt er ført på personen — fra en rolle eller en
    // tidligere kjøring — skal ikke få en henvisning til.
    if (person.sources.some((source) => source.sourceId === mention.sourceId)) continue;
    if (person.roles.some((role) => role.sources.some((source) => source.sourceId === mention.sourceId))) continue;

    person.sources = [...person.sources, {
      sourceId: mention.sourceId,
      page: mention.page,
      // Tom med vilje: en omtale dekker ingen felt på personen. Den sier at
      // publikasjonen skriver om ham, ikke hva den påstår.
      fields: [],
      note: "Navnet er gjenkjent maskinelt i publikasjonen og slått opp mot registeret.",
    }].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
    added += 1;
    touched.add(person.id);
  }

  for (const id of touched) {
    const person = byId.get(id)!;
    personSchema.parse(person) satisfies Person;
    const file = resolve(root, personPath(person.id));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, await rewrite(file, person), "utf8");
  }

  return { added, people: touched.size, anachronistic };
}
