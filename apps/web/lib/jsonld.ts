import { SITE_NAME, SITE_ORIGIN, siteUrl } from "@/lib/site";

/**
 * Strukturerte data (JSON-LD) for sidene som har noe konkret å beskrive.
 *
 * Arkivet hadde ingen. Tittel og beskrivelse forteller en søkemotor hva som står
 * på en side, men ikke hva den handler om: at `/kamp/…` er en kamp mellom to lag
 * på en dato på en bane, at `/personer/…` er et menneske, at `/data` er et
 * datasett med lisens og tidsspenn. Det er den forskjellen som avgjør om en side
 * kan vises som noe annet enn ti blå ord — og for `/data` om Google Dataset
 * Search finner datasettet i det hele tatt.
 *
 * To regler gjelder alt her. Ingenting påstås som ikke står i arkivet: en kamp
 * uten resultat får ikke et resultat, en person uten nasjonalitet får ikke en.
 * Og alt beskriver det som faktisk står på siden — strukturerte data som ikke
 * gjenfinnes i teksten er noe søkemotorene ser etter og straffer.
 *
 * Funksjonene er rene og returnerer vanlige objekter, slik at de kan testes uten
 * å rendre en side.
 */

export type JsonLdObject = Record<string, unknown>;

/** Fjerner nøkler uten verdi, så JSON-LD-en ikke inneholder `null` og tomme lister. */
function compact(object: JsonLdObject): JsonLdObject {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => {
      if (value === null || value === undefined) return false;
      return !(Array.isArray(value) && value.length === 0);
    }),
  );
}

/**
 * Nettstedet og prosjektet bak, lagt på hver side via rotoppsettet.
 *
 * `Organization` beskriver supporterprosjektet, ikke fotballklubben. Å utgi seg
 * for å være AaFK i strukturerte data ville vært feil på samme måte som det
 * ville vært feil i teksten, og hele nettstedet sier tvert imot at det er
 * uoffisielt.
 */
export function websiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_ORIGIN}/#website`,
    url: siteUrl(),
    name: SITE_NAME,
    inLanguage: "nb-NO",
    description:
      "Uoffisielt, søkbart arkiv over Aalesunds Fotballklubbs kamper, personer, organisasjon og historiske kilder.",
    publisher: { "@id": `${SITE_ORIGIN}/#organization` },
  };
}

export function organizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_ORIGIN}/#organization`,
    name: SITE_NAME,
    url: siteUrl(),
    description:
      "Et uoffisielt, åpent dugnadsprosjekt som samler AaFKs kamphistorikk. Uten tilknytning til Aalesunds Fotballklubb.",
    sameAs: ["https://github.com/mlervaag/aafkstats"],
  };
}

/**
 * Brødsmulesti.
 *
 * Gir søkeresultatet stien «AaFK-arkivet › Sesonger › 1998» i stedet for en rå
 * URL. Nivåene her skal svare til lenkene som faktisk står på siden.
 */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: SITE_NAME, path: "/" }, ...trail].map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      item: siteUrl(step.path),
    })),
  };
}

export interface MatchJsonLdInput {
  id: string;
  homeName: string;
  awayName: string;
  date: string;
  /** Klokkeslett `HH:MM` der kilden har det. */
  kickoff: string | null;
  status: string;
  competition: string;
  venue: string | null;
  attendance: number | null;
  description: string;
  name: string;
}

/**
 * Kampens tilstand oversatt til schema.org.
 *
 * Arkivet skiller på fire tilstander, og tre av dem har et eget begrep i
 * vokabularet. `awarded` — kamp avgjort på grønt bord — har ingen, og er en
 * spilt kamp med et resultat, altså `EventScheduled`.
 */
function eventStatus(status: string): string {
  if (status === "cancelled") return "https://schema.org/EventCancelled";
  if (status === "postponed") return "https://schema.org/EventPostponed";
  return "https://schema.org/EventScheduled";
}

/**
 * En kamp som `SportsEvent`.
 *
 * Klokkeslettet tas med bare når kilden har det. `startDate` med en oppdiktet
 * timeverdi ville sagt at kampen startet 00:00, og for de eldste kampene vet
 * arkivet ofte ikke mer enn datoen.
 *
 * Tidssonen er norsk lokaltid, som er den tiden kampene faktisk ble spilt på og
 * den kildene oppgir. Sommertid gjør at offsetten varierer, så den utelates —
 * en dato-tid uten sone leses som lokal tid, og det er riktigere enn å skrive en
 * offset som er feil halve året.
 */
export function matchJsonLd(match: MatchJsonLdInput): JsonLdObject {
  const teams = [match.homeName, match.awayName].map((name) => ({
    "@type": "SportsTeam",
    name,
  }));

  return compact({
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: match.name,
    description: match.description,
    url: siteUrl(`/kamp/${match.id}`),
    startDate: match.kickoff ? `${match.date}T${match.kickoff}` : match.date,
    eventStatus: eventStatus(match.status),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    sport: "Fotball",
    homeTeam: teams[0],
    awayTeam: teams[1],
    competitor: teams,
    superEvent: { "@type": "SportsEvent", name: match.competition },
    location: match.venue ? { "@type": "Place", name: match.venue } : null,
    // `remainingAttendeeCapacity` og slektningene beskriver billetter, ikke
    // frammøte. Tilskuertallet hører hjemme i beskrivelsen, der det allerede står.
    isAccessibleForFree: null,
  });
}

export interface PersonJsonLdInput {
  id: string;
  name: string;
  nationality: string | null;
  description: string;
  /** Wikidata-ID, f.eks. `Q123`, der arkivet har koblingen. */
  wikidata: string | null;
  /** Rollene personen har hatt, som viste titler. */
  roles: string[];
  /** Om personen har registrerte kamper for klubben. */
  played: boolean;
}

/**
 * Et menneske som `Person`.
 *
 * `sameAs` mot Wikidata er den ene opplysningen som lar en søkemotor forstå at
 * personen på denne siden er den samme som personen den kjenner fra før. Uten
 * den er «Ola Hansen» i arkivet en ny og ukjent Ola Hansen.
 *
 * `memberOf` settes bare for dem som faktisk har spilt eller hatt et verv, og
 * peker på klubben som et lag — ikke på arkivet.
 */
export function personJsonLd(person: PersonJsonLdInput): JsonLdObject {
  return compact({
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.name,
    description: person.description,
    url: siteUrl(`/personer/${person.id}`),
    nationality: person.nationality ? { "@type": "Country", name: person.nationality } : null,
    jobTitle: person.roles,
    sameAs: person.wikidata ? [`https://www.wikidata.org/wiki/${person.wikidata}`] : [],
    memberOf:
      person.played || person.roles.length > 0
        ? { "@type": "SportsTeam", name: "Aalesunds Fotballklubb" }
        : null,
  });
}

export interface DatasetJsonLdInput {
  /** Første og siste året arkivet har kamper fra. */
  firstSeason: number | null;
  lastSeason: number | null;
  matches: number;
}

/**
 * Datasettet som `Dataset`.
 *
 * Dette er den ene strukturerte opplysningen på nettstedet som åpner en helt ny
 * inngang: Google Dataset Search indekserer `Dataset`, og et fritt lisensiert
 * datasett over en fotballklubbs historie finnes det ikke mange av. Uten JSON-LD
 * er `/data` bare enda en underside.
 *
 * Lisensen er delt med vilje, og det er ikke en detalj: koden er MIT, egne
 * tekster er CC BY 4.0, og tredjepartskildene har sine egne vilkår. `license`
 * peker på siden som forklarer nettopp det, ikke på en lisens-URL som ville
 * lovet at alt lå under én.
 */
export function datasetJsonLd(input: DatasetJsonLdInput): JsonLdObject {
  const coverage =
    input.firstSeason && input.lastSeason ? `${input.firstSeason}/${input.lastSeason}` : null;

  return compact({
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "AaFK-arkivet – kampdatasettet",
    description:
      `Åpent, kildeført datasett over Aalesunds Fotballklubbs kamper, sesonger, personer og organisasjon. ` +
      `${input.matches} kamper med resultat, konkurranse, bane og kildehenvisning per opplysning.`,
    url: siteUrl("/data"),
    inLanguage: "nb-NO",
    isAccessibleForFree: true,
    license: siteUrl("/om"),
    creator: { "@id": `${SITE_ORIGIN}/#organization` },
    temporalCoverage: coverage,
    keywords: [
      "Aalesunds Fotballklubb",
      "AaFK",
      "fotball",
      "kampstatistikk",
      "norsk fotball",
      "idrettshistorie",
    ],
    // Sto som en SQLite-nedlasting på repo-URL-en. SQLite-fila ligger ikke i
    // Git — den bygges fra YAML ved utrulling, som README sier uttrykkelig — så
    // de strukturerte dataene lovet et format på en adresse der det ikke fantes.
    // YAML-filene er det som faktisk kan lastes ned, og det er dem vi oppgir.
    distribution: [
      {
        "@type": "DataDownload",
        name: "YAML-kildefilene på GitHub",
        encodingFormat: "text/yaml",
        contentUrl: "https://github.com/mlervaag/aafkstats/tree/main/data",
      },
    ],
  });
}

export interface CollectionJsonLdInput {
  name: string;
  description: string;
  path: string;
  /** Antall oppføringer i registeret, der tallet er kjent. */
  size?: number;
}

/**
 * Et register — sesonger, motstandere, personer, kilder — som `CollectionPage`.
 *
 * Disse sidene er lister, og en liste som sier hvor lang den er, er noe annet
 * enn en tilfeldig side med lenker på.
 */
export function collectionJsonLd(input: CollectionJsonLdInput): JsonLdObject {
  return compact({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: input.description,
    url: siteUrl(input.path),
    inLanguage: "nb-NO",
    isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
    mainEntity: input.size
      ? { "@type": "ItemList", numberOfItems: input.size }
      : null,
  });
}
