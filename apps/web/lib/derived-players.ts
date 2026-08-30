import { all, open } from "@aafkstats/db";
import {
  getDerivedPlayers,
  type DerivedPlayer,
} from "@aafkstats/query/services/derived-players";

export {
  getDerivedPlayers,
  getPlayersWithoutMatches,
  type DerivedPlayer,
  type PlayerWithoutMatches,
} from "@aafkstats/query/services/derived-players";

/**
 * Spillere arkivet kjenner fra lagoppstillingene, uten at noen har skrevet en
 * personfil for dem.
 *
 * ## Feilen dette retter
 *
 * Personregisteret valgte på «har noen skrevet en fil», ikke på «hva arkivet
 * vet». Michael Barrantes står med 134 kamper og 48 mål i arkivet og hadde
 * ingen side i det hele tatt. Det samme gjaldt Mostafa Abdellaoue (44 mål) og
 * Leke James (42 mål). Samtidig hadde 116 av de 227 personfilene ikke én eneste
 * kamp, fordi et styreverv er nok til å få en fil.
 *
 * Registeret var altså mest fullt av folk uten kampdata, mens spillerne arkivet
 * vet aller mest om, var usynlige.
 *
 * ## Hvorfor utledet framfor 107 tomme filer
 *
 * `person.ts` sier at registeret ikke er en liste over alle som har spilt: «En
 * fil lages når det er noe å si.» Den regelen står. Den handler om *filer*, og
 * det som endres her er at en fil ikke lenger er en forutsetning for å være
 * synlig.
 *
 * Det er samme grep som `source_results`: et resultat som er dokumentert, men
 * ikke kan bli en kanonisk kamp, blir verken kastet eller gjettet på plass. Det
 * får sin egen, svakere status. En spiller som bare er kjent fra
 * lagoppstillinger har nøyaktig samme form, og skal behandles likt.
 *
 * ## Hva en utledet side har lov til å påstå
 *
 * Bare det lagoppstillingene viser: sesonger, kamper, starter og mål. Ingen
 * nasjonalitet, posisjon, draktnummer eller Wikidata — de kommer fra
 * personfila, og finnes den ikke, vet arkivet det ikke. En utledet side som
 * gjettet på nasjonalitet ville vært en påstand uten kilde.
 *
 * Identiteten hviler dessuten på `personKey`, som slår sammen skrivemåter. To
 * ulike personer med samme normaliserte navn ville delt side. Risikoen finnes
 * allerede i stallvisningen, men den blir mer synlig med en egen adresse, og
 * det er en grunn til at siden ikke skal si mer enn den vet.
 */

/**
 * Alle spillere uten personfil, flest kamper først.
 *
 * En ID som allerede tilhører en personfil slippes. Det skal ikke kunne skje —
 * en spiller hvis `person_key` finnes i `core_person_names` får `person_id` satt
 * og er dermed ikke utledet — men filnavnet er valgt for hånd og trenger ikke
 * være `slugify(navnet)`. Skulle de to likevel kollidere, er det personfila som
 * eier adressen, og den utledede sida som skal vike. `derived-players.test.ts`
 * feiler hvis det inntreffer, slik at det oppdages i stedet for å bli en side
 * som stille overskriver en annen.
 */
export function getDerivedPlayerById(id: string): DerivedPlayer | undefined {
  return getDerivedPlayers().find((player) => player.id === id);
}

export interface DerivedPlayerSeason {
  season: number;
  appearances: number;
  starts: number;
  goals: number;
}

/** Sesongene, nyeste først, slik personsida allerede viser dem. */
export function getDerivedPlayerSeasons(personKey: string): DerivedPlayerSeason[] {
  const db = open();
  try {
    return all<DerivedPlayerSeason>(
      db,
      `SELECT season, appearances, starts, goals
         FROM squad
        WHERE person_key = ? AND person_id IS NULL
        ORDER BY season DESC`,
      personKey,
    );
  } finally {
    db.close();
  }
}

/** Skrivemåtene kildene bruker om denne spilleren, til bruk i et bidrag. */
export function getDerivedPlayerNameForms(personKey: string): string[] {
  const db = open();
  try {
    return all<{ name: string }>(
      db,
      `SELECT DISTINCT name FROM core_appearances WHERE person_key = ? ORDER BY name`,
      personKey,
    ).map((row) => row.name);
  } finally {
    db.close();
  }
}

/**
 * Personfiler som ser ut som spillere, men som ingen kamp er koblet til.
 *
 * Den motsatte feilen av den over, og den har allerede en forklaring på
 * personsida («Kampkoblinger mangler»). Den sto bare ingen steder samlet.
 *
 * En fil med posisjon eller draktnummer er ført som spiller av et menneske. Har
 * den likevel null kamper, er det som regel fordi kilden skriver navnet
 * annerledes enn fila, og da er dette den samme jobben som `names[]` løser.
 * Skyldes det i stedet at spilleren er fra før 2010, som er der
 * lagoppstillingene starter, er det ingen feil, og da er raden en opplysning om
 * hva arkivet ikke rekker.
 */
/**
 * De utledede spillerne i registerets egen form, så personlista kan vise dem.
 *
 * Feltene som bare kommer fra en personfil står som null eller null-verdi.
 * Katalogen filtrerer og søker på nettopp de feltene, og en utledet spiller
 * havner riktig under «Spillere» fordi `appearances` er over null.
 */
export function derivedAsSummaries(): PersonSummaryLike[] {
  return getDerivedPlayers().map((player) => ({
    id: player.id,
    name: player.name,
    nationality: null,
    position: null,
    first_season: player.firstSeason,
    last_season: player.lastSeason,
    appearances: player.appearances,
    starts: player.starts,
    role_count: 0,
    first_role_year: null,
    last_role_year: null,
    role_categories: [],
  }));
}

interface PersonSummaryLike {
  id: string;
  name: string;
  nationality: string | null;
  position: string | null;
  first_season: number | null;
  last_season: number | null;
  appearances: number;
  starts: number;
  role_count: number;
  first_role_year: string | null;
  last_role_year: string | null;
  role_categories: string[];
}

/** Antall utledede spillere, uten å laste hele lista. */
export function countDerivedPlayers(): number {
  return getDerivedPlayers().length;
}
