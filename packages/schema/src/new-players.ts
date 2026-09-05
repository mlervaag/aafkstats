import { AAFK_CLUB_ID } from "./entities.js";
import { personKey } from "./identity.js";
import type { Archive } from "./load.js";
import type { Match } from "./match.js";
import type { Person, Transfer, TransferKind } from "./person.js";
import { transferSeason } from "./person.js";

/**
 * Nye spillere i kamptroppen, og om arkivet vet hvor de kom fra.
 *
 * ## Hvorfor dette finnes
 *
 * Kamptroppene høstes inn automatisk etter hver kamp, mens overgangene føres
 * for hånd fra en kilde som må finnes først. De to kildene går derfor ut av
 * takt på nøyaktig ett punkt: et navn dukker opp i en oppstilling uten at noen
 * har ført inn hvordan spilleren kom til klubben. Det er en tom rad på
 * spillersiden og et hull i overgangshistorikken, og ingenting feiler på det —
 * `pnpm validate` kan ikke kreve en overgang som kanskje aldri er publisert.
 *
 * Kontrollen sier bare fra. Den henter ingenting og skriver ingenting; den
 * peker på debutantene og på hva som mangler bak dem, slik at et menneske
 * (eller en rutine) kan gå og lete etter kilden.
 *
 * ## Hva en «ny spiller» er
 *
 * Første gang et navn står i AaFKs egen oppstilling — start eller benk. Benken
 * er med fordi en spiller som er hentet og sitter på benken er like ny, og
 * fordi det er kamptroppen spørsmålet gjelder, ikke spilletiden.
 *
 * Navn slås sammen med `personKey()`, som er den samme nøkkelen stallen bruker.
 * «Ólafur Gudmundsson» og «Olafur Gudmundsson» er da én debutant, ikke to.
 */

/** Første gang et navn står i AaFKs kamptropp. */
export interface Debut {
  /** Nøkkelen skrivemåtene samles under. Se `personKey()`. */
  personKey: string;
  /** Skrivemåten i den første oppstillingen navnet står i. */
  name: string;
  /** Personfila navnet er ført på, når den finnes. */
  personId?: string;
  matchId: string;
  date: string;
  season: number;
  role: "start" | "bench";
}

/** Hva arkivet vet om hvordan debutanten kom til klubben. */
export type Arrival =
  /** En inngående overgang dekker debuten. */
  | { status: "documented"; transferId: string; kind: TransferKind; club: string | null; date: string }
  /**
   * Personfila har bare inngående overganger fra etter debutsesongen. Da er
   * enten datoen feil, eller så er overgangen ført på feil ankomst — en
   * spiller kan ikke ha spilt før han kom.
   */
  | { status: "later"; transferId: string; kind: TransferKind; club: string | null; date: string }
  /** Personfila finnes, men ingen har ført inn hvordan han kom. */
  | { status: "undocumented" }
  /** Navnet har ingen personfil i det hele tatt. */
  | { status: "unknown" };

export interface NewPlayer {
  debut: Debut;
  arrival: Arrival;
}

/** Slår en skrivemåte i en oppstilling opp mot personfilene. */
function personIndex(people: Person[]): Map<string, Person> {
  const index = new Map<string, Person>();
  for (const person of people) {
    for (const written of [person.name, ...person.names]) index.set(personKey(written), person);
  }
  return index;
}

/** AaFKs egen side av oppstillingen, uansett om vi spilte hjemme eller borte. */
function ourLineup(match: Match): { starters: string[]; subs: string[] } | undefined {
  return match.home.clubId === AAFK_CLUB_ID ? match.lineups?.home : match.lineups?.away;
}

/**
 * Personnøklene som allerede står i en oppstilling.
 *
 * Dette er hukommelsen rutinen måler nye kamper mot: står nøkkelen her, har
 * spilleren vært i kamptroppen før, og han er ikke ny uansett hva datoen sier.
 */
export function squadKeys(matches: Match[]): Set<string> {
  const keys = new Set<string>();
  for (const match of matches) {
    const ours = ourLineup(match);
    if (!ours) continue;
    for (const name of [...ours.starters, ...ours.subs]) {
      const key = personKey(name);
      if (key !== "") keys.add(key);
    }
  }
  return keys;
}

/**
 * Første gang hvert navn står i en oppstilling, blant kampene som sendes inn.
 *
 * `known` er navnene som ikke teller som nye. Rutinen sender inn kamptroppene
 * arkivet hadde fra før, og får da ut nøyaktig dem som er nye i denne runden.
 *
 * Kamper uten oppstilling hoppes over. De fleste kampene før 2010 har ingen, og
 * en «debut» utledet av den første kampen vi tilfeldigvis har oppstilling for
 * ville vært et tall uten dekning.
 */
export function debutsIn(matches: Match[], people: Person[], known: Set<string> = new Set()): Debut[] {
  const index = personIndex(people);
  const first = new Map<string, Debut>();

  const chronological = [...matches].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );

  for (const match of chronological) {
    const ours = ourLineup(match);
    if (!ours) continue;
    for (const [role, players] of [["start", ours.starters], ["bench", ours.subs]] as const) {
      for (const name of players) {
        const key = personKey(name);
        if (key === "" || known.has(key) || first.has(key)) continue;
        first.set(key, {
          personKey: key,
          name,
          personId: index.get(key)?.id,
          matchId: match.id,
          date: match.date,
          season: match.competition.season,
          role,
        });
      }
    }
  }

  return [...first.values()].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "nb"));
}

/** Debutantene i arkivet, tidligst først. */
export function debuts(archive: Archive): Debut[] {
  return debutsIn(archive.matches, archive.people);
}

/** Overgangen som best forklarer debuten, eller hvorfor ingen gjør det. */
export function arrivalFor(debut: Debut, person: Person | undefined): Arrival {
  if (person === undefined) return { status: "unknown" };

  const inbound = person.transfers.filter((entry) => entry.direction === "in");
  if (inbound.length === 0) return { status: "undocumented" };

  const describe = (entry: Transfer) => ({
    transferId: entry.id,
    kind: entry.kind,
    club: entry.club,
    date: entry.date,
  });

  // Sesong, ikke dato: vintervinduet fører en overgang på sesongen etter året i
  // datoen, og en overgang uten dag («høsten 1950») har ingen dato å måle mot.
  const covering = inbound
    .filter((entry) => transferSeason(entry) <= debut.season)
    .sort((a, b) => transferSeason(b) - transferSeason(a) || b.date.localeCompare(a.date));
  if (covering.length > 0) return { status: "documented", ...describe(covering[0]!) };

  const later = [...inbound].sort(
    (a, b) => transferSeason(a) - transferSeason(b) || a.date.localeCompare(b.date),
  );
  return { status: "later", ...describe(later[0]!) };
}

export interface NewPlayerOptions {
  /** Bare debuter fra og med denne datoen. Uten den: hele arkivet. */
  since?: string;
  /** Bare debuter i denne sesongen. */
  season?: number;
}

/**
 * Debutantene i vinduet, med det arkivet vet om ankomsten deres.
 *
 * Uten `since` eller `season` svarer den for hele arkivet, og da er de fleste
 * radene historiske navn uten personfil. Det er riktig svar på et annet
 * spørsmål enn rutinens; rutinen spør om de siste kampene.
 */
export function newPlayers(archive: Archive, options: NewPlayerOptions = {}): NewPlayer[] {
  return withArrival(
    debuts(archive)
      .filter((debut) => options.since === undefined || debut.date >= options.since)
      .filter((debut) => options.season === undefined || debut.season === options.season),
    archive.people,
  );
}

/**
 * De som er nye i kamptroppen i disse kampene, med det arkivet vet om ankomsten.
 *
 * Dette er spørsmålet rutinen etter kamp stiller: den har nettopp hentet noen
 * kamper, og vil vite hvem som ikke sto i noen oppstilling før. Datoen er ikke
 * kriteriet — en kamp som hentes inn i etterkant kan være gammel, og en spiller
 * som har spilt før er ikke ny selv om kampen er ny for arkivet.
 */
export function newcomers(matches: Match[], people: Person[], known: Set<string>): NewPlayer[] {
  return withArrival(debutsIn(matches, people, known), people);
}

function withArrival(found: Debut[], people: Person[]): NewPlayer[] {
  const index = new Map(people.map((person) => [person.id, person]));
  return found.map((debut) => ({
    debut,
    arrival: arrivalFor(debut, debut.personId === undefined ? undefined : index.get(debut.personId)),
  }));
}

/** Debutantene som mangler en overgang som forklarer dem. */
export function unexplained(players: NewPlayer[]): NewPlayer[] {
  return players.filter((player) => player.arrival.status !== "documented");
}
