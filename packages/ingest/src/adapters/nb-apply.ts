import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { stringify } from "yaml";
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
      note: "Lest maskinelt fra publikasjonen, spaltevis. Bør etterkontrolleres mot siden.",
    }].sort((a, b) => a.from.localeCompare(b.from) || a.title.localeCompare(b.title, "nb"));
    report.added += 1;
    touched.add(person.id);
  }

  for (const id of touched) {
    const person = byId.get(id)!;
    const parsed = personSchema.parse(person) satisfies Person;
    const file = resolve(root, personPath(parsed.id));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, stringify(parsed, { lineWidth: 0, defaultStringType: "PLAIN" }), "utf8");
  }

  return report;
}

function sourceRef(sourceId: string, role: ResolvedRole): { sourceId: string; page: string; fields: string[]; note: string } {
  return {
    sourceId,
    page: role.page,
    fields: ["title", "from"],
    note: `Lest fra spalte ${(role.column ?? 0) + 1} på siden (regel: ${role.rule}).`,
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
