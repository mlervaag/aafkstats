import { AAFK_CLUB_ID } from "./entities.js";
import { personKey } from "./identity.js";
import type { Archive } from "./load.js";
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

/**
 * Debutantene i arkivet, tidligst først.
 *
 * Kamper uten oppstilling hopper den over. De fleste kampene før 2010 har
 * ingen, og en «debut» utledet av den første kampen vi tilfeldigvis har
 * oppstilling for ville vært et tall uten dekning.
 */
export function debuts(archive: Archive): Debut[] {
  const index = personIndex(archive.people);
  const first = new Map<string, Debut>();

  const chronological = [...archive.matches].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );

  for (const match of chronological) {
    const ours = match.home.clubId === AAFK_CLUB_ID ? match.lineups?.home : match.lineups?.away;
    if (!ours) continue;
    for (const [role, players] of [["start", ours.starters], ["bench", ours.subs]] as const) {
      for (const name of players) {
        const key = personKey(name);
        if (key === "" || first.has(key)) continue;
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
  const index = new Map(archive.people.map((person) => [person.id, person]));
  return debuts(archive)
    .filter((debut) => options.since === undefined || debut.date >= options.since)
    .filter((debut) => options.season === undefined || debut.season === options.season)
    .map((debut) => ({
      debut,
      arrival: arrivalFor(debut, debut.personId === undefined ? undefined : index.get(debut.personId)),
    }));
}

/** Debutantene som mangler en overgang som forklarer dem. */
export function unexplained(players: NewPlayer[]): NewPlayer[] {
  return players.filter((player) => player.arrival.status !== "documented");
}
