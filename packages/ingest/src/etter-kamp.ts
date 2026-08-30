import type { Archive } from "@aafkstats/schema/load";

/**
 * Hva som skal oppdateres etter at AaFK har spilt, som en ren funksjon.
 *
 * Skilt fra kommandoen fordi utvelgelsen er det som kan bli feil, og det er den
 * som må kunne prøves uten å røre nettet eller arkivet på disk.
 */

const OSLO = "Europe/Oslo";

/** Kamper arkivet tror står på terminlista, men som datoen har gått fra. */
export interface Due {
  matchId: string;
  date: string;
  season: number;
  competitionId: string;
  competitionName: string;
  opponent: string;
  /**
   * Kildens egen ID for kampen, når arkivet har den.
   *
   * Den er det eneste som holder når kampen flyttes: datoen i arkivet er da
   * ikke lenger kildens dato, og et oppslag på dato finner ingenting.
   */
  externalId?: string;
}

export function todayInOslo(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: OSLO, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

/**
 * Kampene som kan være spilt uten at arkivet vet det.
 *
 * Datoen sammenlignes i Oslo, ikke i UTC. Serveren står i UTC, og en kamp spilt
 * søndag kveld norsk tid er fortsatt «i morgen» etter serverens klokke i noen
 * timer. Uten dette ville rutinen kjørt uten å finne kampen den ble kjørt for.
 *
 * Dagens kamper er med, ikke bare gårsdagens. Rutinen kjøres om kvelden etter
 * kampen, og et strengt «før i dag» ville gjort nettopp den kjøringen tom.
 * At kampen kanskje ikke er ferdig ennå er ikke datoens jobb å avgjøre — det
 * spør vi kilden om, og den svarer sikrere enn en klokkeslettsammenligning mot
 * et avspark som kan være utsatt.
 */
export function matchesDue(archive: Archive, today: string, providerId = "fotmob"): Due[] {
  const AAFK = "aalesunds-fk";
  return archive.matches
    .filter((match) => match.status === "scheduled" && match.date <= today)
    .map((match) => {
      const opponentId = match.home.clubId === AAFK ? match.away.clubId : match.home.clubId;
      const club = archive.clubs.find((entry) => entry.id === opponentId);
      const competition = archive.competitions.find((entry) => entry.id === match.competition.id);
      const externalId = match.aliases[providerId];
      return {
        matchId: match.id,
        date: match.date,
        season: match.competition.season,
        competitionId: match.competition.id,
        competitionName: competition?.name ?? match.competition.id,
        opponent: club?.name ?? opponentId,
        externalId: externalId === undefined ? undefined : String(externalId),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Så mye en kildekamp må ha for å kunne knyttes til en kamp arkivet venter på. */
export interface SourceKey {
  externalId: string;
  date: string;
}

/**
 * Kildekampen som svarer til en kamp arkivet venter på.
 *
 * ## Feilen dette retter
 *
 * Her sto en sammenligning på dato alene. Viking–AaFK sto på terminlista til
 * 29. august 2026 og ble spilt den 30., og rutinen kjørt kvelden etter kampen
 * meldte «kilden har ikke sluttresultat ennå» — kilden hadde 2–1, men på en
 * annen dato enn den arkivet spurte om. En flyttet kamp er nettopp den kampen
 * rutinen finnes for, og var den ene den ikke kunne finne.
 *
 * Kildens ID er svaret: den følger kampen når datoen flyttes, og arkivet har
 * den allerede i `aliases` fra terminlista. Datoen er fortsatt et fall tilbake
 * for kamper arkivet ikke har noen ID på ennå.
 */
export function sourceForDue<T extends SourceKey>(due: Due, sources: T[]): T | undefined {
  if (due.externalId !== undefined) {
    const byId = sources.find((source) => source.externalId === due.externalId);
    if (byId) return byId;
  }
  return sources.find((source) => source.date === due.date);
}


/** En seriesesong som ikke er ferdigspilt, og som derfor har en tabell som endrer seg. */
export interface OngoingLeague {
  competitionId: string;
  competitionName: string;
  season: number;
  leagueId: string;
}

/**
 * Seriesesongene tabellen fortsatt kan endre seg i.
 *
 * Tabellen har ingenting med AaFKs kamper å gjøre. Den flytter seg hver gang to
 * andre lag spiller, og søndagen dette ble skrevet falt AaFK fra 14. til 15.
 * plass en time etter at vår egen kamp var ferdig og hentet. En rutine som bare
 * ser på våre kamper ville aldri oppdaget det.
 *
 * «Ikke ferdigspilt» leses av terminlista: har sesongen minst én kamp igjen som
 * ikke er spilt, kan tabellen fortsatt bevege seg. Da slutter den også av seg
 * selv når siste runde er unnagjort — uten en dato noen må vedlikeholde.
 */
export function ongoingLeagues(archive: Archive): OngoingLeague[] {
  const seasons = new Map<string, OngoingLeague>();
  for (const match of archive.matches) {
    if (match.status !== "scheduled") continue;
    const competition = archive.competitions.find((entry) => entry.id === match.competition.id);
    if (competition?.type !== "league") continue;
    const leagueId = competition.aliases?.fotmob;
    if (leagueId === undefined) continue;
    const key = `${competition.id}|${match.competition.season}`;
    seasons.set(key, {
      competitionId: competition.id,
      competitionName: competition.name,
      season: match.competition.season,
      leagueId: String(leagueId),
    });
  }
  return [...seasons.values()].sort((a, b) => a.season - b.season || a.competitionId.localeCompare(b.competitionId));
}
