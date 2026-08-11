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
 *
 * ## Hvorfor leddene strykes om igjen til det ikke er flere
 *
 * Ett strøk per ende holdt så lenge navnene hadde ett ledd. NFF Fotballdata
 * skriver dem med to: «Spjelkavik IL - Fotball» ble til `spjelkavik-il`, som
 * ikke er `spjelkavik`, og klubben fikk en identitet til uten at noe sa fra.
 * Fire klubber lå dermed dobbelt i arkivet med hver sin innbyrdes statistikk.
 * Sammenslåingen er den samme som før, bare gjennomført: et ledd som ikke
 * skiller én klubb fra en annen gjør det heller ikke fordi det står nummer to.
 *
 * Sløyfen kan ikke gå evig — hvert strøk gjør strengen kortere — og den stopper
 * før den spiser opp alt: et navn som *bare* er støyledd («IL», «FK») beholdes
 * som det er, siden en tom nøkkel ville slått sammen alle slike klubber.
 */
export function clubKey(value: string): string {
  let key = slugify(value);
  for (;;) {
    const stripped = key.replace(LEADING, "").replace(TRAILING, "");
    if (stripped === key || stripped === "") return key;
    key = stripped;
  }
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

/**
 * Personidentitet: to skrivemåter av samme navn skal bli samme person.
 *
 * ## Feilen dette retter
 *
 * FotMob skriver de samme navnene på to måter, avhengig av hvilken kamp de kom
 * fra. 2014-sesongen har både «Jan Jönsson» og «Jan Joensson» som hovedtrener,
 * og de er én mann. Uten dette ville trenerhistorikken vist to trenere det året,
 * og stallen vist «Tor Hogne Aarøy» og «Tor Hogne Aaroey» som to spillere.
 *
 * Målt på alle navnene i arkivet: 238 strenger blir 227 personer, og alle elleve
 * sammenslåingene er samme navn i to skrivemåter.
 *
 * ## Hva regelen gjør, og hva den ikke gjør
 *
 * Bare mekanisk translitterasjon slås sammen: en bokstav med ring, strek eller
 * tødler er den samme bokstaven som den utskrevne formen. «ø» og «oe» er samme
 * lyd skrevet på to måter, og det er kilden selv som veksler mellom dem.
 *
 * «Mathias Kristensen» og «Mathias Christensen» slås derfor *ikke* sammen. Det
 * kan være samme mann feilstavet, og det kan være to menn, og det spørsmålet
 * skal et menneske svare på, ikke en regel. `pnpm data:duplicates` rapporterer
 * paret i stedet.
 *
 * Forskjellen fra `clubKey` er at klubbnøkkelen stryker ledd (`fk-`, `-bk`),
 * mens denne bare bytter tegn. Å stryke ledd av et personnavn ville vært å
 * gjette på hva som er fornavn og hva som er tittel.
 */
export function personKey(name: string): string {
  return name
    .toLowerCase()
    // Først bokstavene som har en egen utskrevet form. Rekkefølgen er viktig:
    // «ø» må bli «o» før «oe» kollapses, ellers blir «Bjørdal» og «Bjoerdal»
    // fortsatt to.
    .replaceAll("ø", "o").replaceAll("æ", "a").replaceAll("å", "a")
    .replaceAll("ö", "o").replaceAll("ä", "a").replaceAll("ü", "u")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/oe/g, "o").replace(/ae/g, "a").replace(/ue/g, "u").replace(/aa/g, "a")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Hvilken skrivemåte som skal vises.
 *
 * Den med diakritiske tegn vinner. «Määttä» er navnet, «Maeaettae» er
 * omskrivingen kilden falt tilbake på, og et arkiv skal vise navnet. Står det
 * likt, vinner den som forekommer oftest, og deretter alfabetisk, slik at
 * svaret ikke avhenger av hvilken rekkefølge kampene ble lest i.
 */
export function preferredPersonName(variants: { name: string; count: number }[]): string {
  // Har navnet et tegn utenfor ASCII, er det den skrevne formen og ikke
  // omskrivingen. Dekker både «ä» og «ø»; sistnevnte er en egen bokstav og faller
  // ikke ut av en test på diakritiske tegn alene.
  const written = (name: string) => (/[^\p{ASCII}]/u.test(name) ? 1 : 0);
  return [...variants].sort((a, b) =>
    written(b.name) - written(a.name)
    || b.count - a.count
    || a.name.localeCompare(b.name, "nb"),
  )[0]!.name;
}
