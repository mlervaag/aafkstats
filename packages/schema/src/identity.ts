/**
 * Klubbidentitet: én definisjon, brukt av alle som må avgjøre om to navn er
 * samme klubb.
 *
 * ## Hvorfor dette ligger i skjemapakken
 *
 * Funksjonen bodde i `@aafkstats/ingest`, som er der klubber blir til. Men den
 * som skal *oppdage* at to klubber er samme klubb, er valideringen — og den
 * ligger her. To kopier av regelen ville drevet fra hverandre, og da ville
 * innhøstingen laget identiteter valideringen ikke gjenkjente.
 *
 * ## Feilen dette retter
 *
 * Norske klubbnavn setter forkortelsen enten foran eller bak: «FK Haugesund»,
 * «Kristiansund BK». Den gamle regelen strøk bare den bakerste. Da ble
 * «Kristiansund BK» og «Kristiansund» samme klubb, mens «FK Haugesund» og
 * «Haugesund» ble to — og siden RSSSF skriver kortnavn og FotMob offisielt
 * navn, fikk Haugesund og Sykkylven hver sin dublett i arkivet. Den ene ga en
 * dobbeltregistrert seriekamp i 2010, den andre delte innbyrdes statistikk i to.
 *
 * ## Hvorfor bindestreken i mønsteret er viktig
 *
 * Leddene strykes bare når de står som eget ord: `^(fk|sk|il|…)-`. Uten
 * bindestreken ville «Skeid» blitt til «eid» og «Ifjord» til «jord». Det er
 * hele forskjellen mellom en normalisering og en ødeleggelse.
 */

/** Norske bokstaver translittereres før Unicode-normalisering. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("å", "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Klubbformer som ikke skiller én klubb fra en annen.
 *
 * Lista er bevisst kort. Hvert ledd som legges til her slår sammen flere navn,
 * og en sammenslåing for mye er verre enn en for lite: to klubber som blir én
 * gir gale tall uten at noe feiler, mens én klubb som blir to gir en dublett
 * valideringen fanger.
 */
const CLUB_NOISE = [
  "fotballklubb",
  "fotballklubben",
  "ballklubb",
  "ballklubben",
  "idrettslag",
  "idrettslaget",
  "sportsklubb",
  "sportsklubben",
  "fotball",
  "fk",
  "bk",
  "il",
  "ik",
  "sk",
  "if",
  "ff",
].join("|");

const LEADING = new RegExp(`^(${CLUB_NOISE})-`);
const TRAILING = new RegExp(`-(${CLUB_NOISE})$`);

/**
 * Normaliserer et klubbnavn til nøkkelen identitetsmatchingen bruker.
 *
 * «FK Haugesund», «Haugesund» og «Haugesund FK» gir alle `haugesund`.
 * «Vard Haugesund» gir `vard-haugesund` og forblir en annen klubb.
 *
 * Kilder uten egne klubb-ID-er må lage sine eksterne ID-er på nøyaktig denne
 * formen. Gjør de ikke det, får samme klubb to identiteter så snart en ny kilde
 * staver navnet annerledes.
 */
export function clubKey(value: string): string {
  return slugify(value).replace(LEADING, "").replace(TRAILING, "");
}

/**
 * Alle skrivemåter en klubb kan gjenkjennes på: ID, navn, kortnavn og
 * historiske navn.
 */
export function clubNameForms(club: {
  id: string;
  name: string;
  shortName?: string | undefined;
  names?: { name: string }[] | undefined;
}): string[] {
  return [club.id, club.name, club.shortName, ...(club.names ?? []).map((entry) => entry.name)].filter(
    (value): value is string => value !== undefined && value !== "",
  );
}

/**
 * Klubbens kanoniske identitet: nøkkelen alle skrivemåtene deler.
 *
 * Brukes til å kjenne igjen at to kamper har samme motstander selv når de er
 * ført på hver sin klubb-ID. Faller tilbake til ID-en når navnene av en eller
 * annen grunn er tomme, slik at funksjonen aldri returnerer tom streng.
 */
export function canonicalClubKey(club: {
  id: string;
  name: string;
  shortName?: string | undefined;
  names?: { name: string }[] | undefined;
}): string {
  return clubKey(club.name) || clubKey(club.id) || club.id;
}

/** Kamp-ID-en er filnavnet: dato pluss de to klubb-ID-ene i spilt rekkefølge. */
export function matchId(date: string, homeClubId: string, awayClubId: string): string {
  return `${date}-${homeClubId}-${awayClubId}`;
}
