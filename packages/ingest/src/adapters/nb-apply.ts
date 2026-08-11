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

export interface ApplyReport {
  /** Nye roller lagt på en person som fantes fra før. */
  added: number;
  /** Roller som alt sto der, og som nå har publikasjonen som kilde i tillegg. */
  corroborated: number;
  /** Resolusjoner som ikke var sikre nok, eller som mangler person eller år. */
  skipped: number;
}

/** En resolusjon sammen med publikasjonen den ble lest i. */
export interface RoleFinding {
  sourceId: string;
  role: ResolvedRole;
}

export async function applyResolvedRoles(archive: Archive, findings: RoleFinding[], root: string): Promise<ApplyReport> {
  const report: ApplyReport = { added: 0, corroborated: 0, skipped: 0 };
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
      && candidate.title.toLowerCase() === role.title.toLowerCase()
      && candidate.from === role.from);

    if (existing) {
      if (existing.sources.some((source) => source.sourceId === sourceId && source.page === role.page)) continue;
      existing.sources = [...existing.sources, sourceRef(sourceId, role)];
      report.corroborated += 1;
      touched.add(person.id);
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
