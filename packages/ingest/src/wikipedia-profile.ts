import { AAFK_CLUB_ID, isLongerNameForm, person as personSchema, personKey, slugify } from "@aafkstats/schema";
import type { Person } from "@aafkstats/schema";
import type { Archive } from "@aafkstats/schema/load";
import type { WikipediaProfile } from "./adapters/wikipedia-profile.js";

export interface PlayerTarget {
  id: string;
  name: string;
  existing?: Person;
  lineupForms: string[];
}

export interface ProfilePlan {
  person: Person;
  create: boolean;
  changes: string[];
  conflicts: string[];
}

/**
 * Finner bare en eksakt arkividentitet. Ingen Wikipedia-tittel får skape en
 * person alene; navnet må allerede finnes som person-ID/navneform eller i en
 * AaFK-oppstilling.
 */
export function resolvePlayerTarget(archive: Archive, query: string): PlayerTarget {
  const normalized = personKey(query);
  const existing = archive.people.find((candidate) => candidate.id === query)
    ?? archive.people.find((candidate) => [candidate.name, ...candidate.names]
      .some((name) => personKey(name) === normalized));
  const lineupForms = aafkLineupNames(archive)
    .filter((name) => personKey(name) === normalized)
    .filter((name, index, all) => all.indexOf(name) === index);

  if (existing) {
    const isPlayer = existing.position !== undefined
      || existing.squadNumbers.length > 0
      || existing.roles.some((role) => role.category === "player")
      || [existing.name, ...existing.names].some((name) =>
        aafkLineupNames(archive).some((lineupName) => personKey(lineupName) === personKey(name)));
    if (!isPlayer) throw new Error(`«${query}» finnes, men er ikke registrert som spiller`);
    return { id: existing.id, name: existing.name, existing, lineupForms };
  }

  if (lineupForms.length === 0) {
    throw new Error(`fant ikke «${query}» som person eller i en AaFK-lagoppstilling`);
  }
  const name = mostCompleteName(lineupForms);
  const id = slugify(personKey(name));
  const collision = archive.people.find((candidate) => candidate.id === id);
  if (collision) throw new Error(`«${name}» ville fått ID-en til ${collision.name}; avklar identiteten manuelt`);
  return { id, name, lineupForms };
}

/** Lager en deterministisk filplan uten å overskrive eksisterende fakta. */
export function planWikipediaProfile(target: PlayerTarget, profile: WikipediaProfile): ProfilePlan {
  const articleName = profile.title.replace(/\s+\([^)]*\)\s*$/, "").trim();
  const sameName = personKey(articleName) === personKey(target.name);
  const longerForm = isLongerNameForm(target.name, articleName) || isLongerNameForm(articleName, target.name);
  if (!sameName && !longerForm) {
    throw new Error(
      `Wikipedia-tittelen «${profile.title}» kan ikke knyttes sikkert til «${target.name}». `
      + "Legg inn alias manuelt først hvis dette faktisk er samme person.",
    );
  }

  const base: Person = target.existing ?? {
    id: target.id,
    name: target.name,
    names: [],
    squadNumbers: [],
    coachSpells: [],
    roles: [],
    providers: [],
    sources: [],
    conflicts: [],
    note: "Kampaktiviteten er utledet av lagoppstillingene, ikke av denne personfila.",
  };
  const changes: string[] = [];
  const conflicts: string[] = [];
  const names = [...base.names];

  if (longerForm && ![base.name, ...names].some((name) => personKey(name) === personKey(articleName))) {
    names.push(articleName);
    changes.push(`navneform: ${articleName}`);
  }

  const position = missingOrConflict("posisjon", base.position, profile.position, changes, conflicts);
  const nationality = missingOrConflict("nasjonalitet", base.nationality, profile.nationality, changes, conflicts);
  const wikidata = missingOrConflict("Wikidata", base.wikidata, profile.wikidata, changes, conflicts);

  if (!target.existing) changes.unshift(`ny personfil: ${target.id}`);
  if (target.existing && changes.length === 0) {
    return { person: base, create: false, changes, conflicts };
  }

  const sourceFields = [
    ...(target.existing ? [] : ["name"]),
    ...(position !== base.position ? ["position"] : []),
    ...(nationality !== base.nationality ? ["nationality"] : []),
    ...(wikidata !== base.wikidata ? ["wikidata"] : []),
    ...(names.length !== base.names.length ? ["names"] : []),
  ];
  const providers = sourceFields.length === 0 ? base.providers : [
    ...base.providers.filter((provider) => provider.url !== profile.url),
    {
      providerId: "wikipedia",
      url: profile.url,
      retrievedAt: profile.timestamp,
      fields: sourceFields,
      note: "Fakta fra spillerprofilens infoboks og sideegenskaper. Artikkelteksten er ikke gjengitt.",
    },
  ];

  return {
    person: personSchema.parse({ ...base, names, position, nationality, wikidata, providers }),
    create: target.existing === undefined,
    changes,
    conflicts,
  };
}

function missingOrConflict<T extends string>(
  label: string,
  existing: T | undefined,
  incoming: T | undefined,
  changes: string[],
  conflicts: string[],
): T | undefined {
  if (incoming === undefined) return existing;
  if (existing === undefined) {
    changes.push(`${label}: ${incoming}`);
    return incoming;
  }
  if (personKey(existing) !== personKey(incoming)) {
    conflicts.push(`${label}: arkivet har «${existing}», Wikipedia viser «${incoming}»`);
  }
  return existing;
}

function aafkLineupNames(archive: Archive): string[] {
  const names: string[] = [];
  for (const match of archive.matches) {
    const lineup = match.home.clubId === AAFK_CLUB_ID ? match.lineups?.home : match.lineups?.away;
    if (!lineup) continue;
    names.push(...lineup.starters, ...lineup.subs);
  }
  return names;
}

function mostCompleteName(forms: string[]): string {
  return [...forms].sort((a, b) => {
    const words = personKey(b).split(" ").length - personKey(a).split(" ").length;
    return words || b.length - a.length || a.localeCompare(b, "nb-NO");
  })[0]!;
}
