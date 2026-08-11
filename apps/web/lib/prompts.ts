/**
 * Ferdige prompts folk kan lime inn i sin egen AI-modell for å bidra til arkivet.
 *
 * Poenget er å flytte tersklen: den som vet noe om en gammel kamp skal slippe å
 * lære seg YAML-strukturen, slug-reglene og PR-flyten først. Modellen gjør
 * formatet, mennesket står for kildene og kontrollen.
 *
 * Promptene beskriver derfor formatet konkret nok til at resultatet validerer,
 * og sier tydelig fra om de to tingene som faktisk kan gå galt: gjettede fakta,
 * og kopiert referattekst. Begge er skrevet som krav til modellen, ikke som
 * høflige ønsker — en modell som blir bedt om å «prøve å ikke gjette» gjetter.
 */

import { matchStatus, personRoleCategory } from "@aafkstats/schema";
import { loadCompetitionIds, loadCoverage } from "@/lib/archive";

const REPO = "https://github.com/mlervaag/aafkstats";

const MATCH_STATUSES = matchStatus.options.join(" | ");
const PERSON_ROLE_CATEGORIES = personRoleCategory.options.join(" | ");

const FORMAT = (competitionIds: string) => `Datamodellen, kort:

- Én YAML-fil per kamp: data/seasons/<år>/matches/<id>.yaml
- id = filnavn = <dato>-<hjemmelag>-<bortelag>, f.eks. 2011-11-06-sk-brann-aalesunds-fk
  Lagdelen er klubbens slug slik den heter i data/clubs/ (små bokstaver, bindestrek,
  æ→ae, ø→o, å→a).
- Påkrevd: id, date, status, competition.id, competition.season, home.clubId, away.clubId
- Alt annet er valgfritt. En kamp fra 1930 med bare dato og motstander er velkommen
  med confidence: probable — det er bedre enn at den mangler.
- competition.id er en av: ${competitionIds}
- status: ${MATCH_STATUSES}
- confidence: confirmed (to uavhengige kilder) | probable (én kilde) | disputed (kilder er uenige)

Viktig om resultat: home.score og away.score er stillingen etter ORDINÆR TID.
Mål i ekstraomganger føres i extraTime, og straffesparkkonkurranse i penaltyShootout.
En kamp som endte 1-1 og ble avgjort 4-3 på straffer skrives altså med score 1 og 1,
ikke 4 og 3.`;

const SOURCE_RULES = `Kildekrav — dette er ufravikelig:

- Hver opplysning skal kunne etterprøves. Nettkilder legges i providers[] med providerId,
  url, retrievedAt (dagens dato) og fields[]. Registrerte historiske dokumenter legges i
  sources[] med sourceId, eventuelt page, og fields[]. fields[] sier hvilke felt kilden dekker.
- Finner du ikke en opplysning, LA FELTET STÅ TOMT. Ikke gjett, ikke rund av, ikke
  regn deg fram til et tilskuertall. Et hull er greit; en oppdiktet verdi er ikke.
- Er du usikker, sett confidence: probable og skriv hvorfor i PR-beskrivelsen.
- Motsier to kilder hverandre, behold begge i conflicts[] og sett confidence: disputed
  framfor å velge den ene i stillhet.`;

const PR_FLOW = `Slik leverer du:

1. Fork ${REPO}
2. Lag en gren, f.eks. bidrag/1974-cupkamp
3. Legg til eller endre YAML-filene
4. Kjør «pnpm install» og deretter «pnpm validate» — den må si at arkivet validerer.
   Får du feil, rett dem før du sender. Feilmeldingene peker på felt og fil.
5. Åpne en pull request. Skriv i beskrivelsen hvilke kilder du brukte, og hva du
   eventuelt var usikker på.

Alle forslag kontrolleres før de slås sammen. Det er helt greit å sende noe du er
usikker på — bare si fra at du er det.`;

export interface ContributionPrompt {
  id: string;
  title: string;
  purpose: string;
  description: string;
  prompt: string;
}

/**
 * Promptene, med konkurransene og statusene hentet fra skjemaet og databasen.
 *
 * Begge lister sto tidligere som tekst i denne filen, og begge ble gale:
 * `tredjedivisjon` kom inn med RSSSF-innhøstingen uten å bli lagt til, og
 * `postponed` har vært i `matchStatus` hele tiden uten å stå her. En bidragsyter
 * som fulgte prompten fikk da laget en fil valideringen avviste — den verst
 * tenkelige feilen for en side som skal senke terskelen.
 *
 * Dette er en funksjon, ikke en konstant. Konstanten leste databasen idet modulen
 * ble importert, og da må arkivfilen finnes før noe som helst kan importere
 * filen — også en test som skal bygge sin egen fixture først. Databasen åpnes nå
 * ved første kall, og svaret holdes.
 */
let cached: ContributionPrompt[] | undefined;

export function contributionPrompts(): ContributionPrompt[] {
  cached ??= buildPrompts(loadCompetitionIds().join(", "), loadCoverage().firstSeason);
  return cached;
}

function buildPrompts(competitionIds: string, firstSeason: number | null): ContributionPrompt[] {
  const format = FORMAT(competitionIds);
  return [
  {
    id: "ny-kamp",
    title: "Legg til en kamp som mangler",
    purpose: "Vanligst",
    description:
      `For eldre kamper arkivet ikke har ennå. Kampryggraden rekker tilbake til ${firstSeason ?? "første registrerte sesong"}, `
      + "men detaljene — mål, oppstillinger, tilskuertall — begynner først rundt 2010.",
    prompt: `Du skal hjelpe meg å legge til en AaFK-kamp i det åpne arkivet ${REPO}.

Kampen det gjelder: [BESKRIV KAMPEN — dato eller omtrentlig dato, motstander, og hva du vet]

${format}

${SOURCE_RULES}

Slik vil jeg at du jobber:

1. Finn kampen i kilder du har tilgang til. Si tydelig fra hvilke du brukte.
2. Sjekk om motstanderklubben allerede finnes i data/clubs/. Gjør den ikke det,
   lag også en klubbfil med id, name, country og eventuelt founded og names[] hvis
   klubben har byttet navn.
3. Skriv den ferdige YAML-filen, klar til å lime inn.
4. List opp hva du IKKE fant, slik at jeg vet hva som mangler.

${PR_FLOW}`,
  },
  {
    id: "personrolle",
    title: "Legg til en person eller en rolle",
    purpose: "Personer og organisasjon",
    description:
      "For spillere, trenere, styremedlemmer, ansatte, stiftere og hedersmedlemmer som mangler helt "
      + "i registeret, mangler en rolle eller står med feil periode.",
    prompt: `Jeg vil legge til eller rette en personrolle i det åpne AaFK-arkivet ${REPO}.

Personen og rollen: [NAVN, TITTEL ELLER VERV, ORGANISASJONSDEL OG ÅR/PERIODE]
Kilden min: [LENKE, PUBLIKASJON, ÅR OG SIDETALL]

Personer ligger i data/people/<id>.yaml. Sjekk først om personen allerede finnes, også
under names[]. Opprett bare en ny fil når det faktisk er en ny person. id er en stabil slug
av navnet. Behold alle eksisterende felt og roller.

En rolle under roles: skal ha:

- id: en kort slug som er unik i personfila
- category: én av ${PERSON_ROLE_CATEGORIES}
- title: tittelen slik kilden oppgir den
- body: organisasjonsdelen, for eksempel Hovedstyret eller A-laget, når kilden sier det
- from: år (YYYY) eller eksakt dato (YYYY-MM-DD)
- to: siste år/dato, samme verdi som from for ett kjent år, eller null når slutten er ukjent
- sources[]: minst én oppføring med sourceId, eventuelt page, og fields[] som sier hvilke
  rollefelt kilden dekker

Sjekk at sourceId finnes i data/sources/. Finnes kilden ikke, lag først en kildefil etter
modellen i docs/DATAMODELL.md. Ikke gjør brødtekst fra kilden om til biografi. Hent bare
etterprøvbare fakta om personens AaFK-tilknytning.

Finner du ikke årstall, tittel eller organisasjonsdel, skal du ikke gjette. Sier kildene
ulike personer eller perioder for samme verv, skal du ikke velge i stillhet: behold begge
kildepåstandene som en uavklart konflikt og forklar uenigheten i pull requesten.

Gi meg den komplette personfila og eventuelle nye kildefiler, og list hva du endret.

${PR_FLOW}`,
  },
  {
    id: "detaljer",
    title: "Fyll ut detaljer på en kamp",
    purpose: "Utdyping",
    description:
      "Når kampen finnes, men mangler målscorere, oppstilling, tilskuertall eller dommer.",
    prompt: `Jeg vil fylle ut detaljer på en kamp som allerede ligger i det åpne AaFK-arkivet ${REPO}.

Kampen: [LIM INN DAGENS YAML-FIL, eller oppgi kamp-ID]

${format}

Hendelser skrives slik, sortert på minutt:

events:
  - minute: 34
    type: goal
    team: home
    player: Fullt navn
    assist: Fullt navn        # utelates hvis ingen målgivende
  - minute: 67
    type: yellow_card
    team: away
    player: Fullt navn

Gyldige typer: goal, own_goal, penalty_goal, missed_penalty, yellow_card,
second_yellow_card, red_card, substitution (med playerOff), var_decision.
Tilleggstid skrives som minute: 45 med stoppage: 2 — ikke som minute: 47.

${SOURCE_RULES}

Behold alt som allerede står i filen. Står et felt oppført i manual[], skal det
ikke endres — det er låst med vilje. Legg din kilde til i sources[] som en ny
oppføring; ikke overskriv kilden som var der.

Gi meg den komplette filen tilbake, og en liste over hva du la til.

${PR_FLOW}`,
  },
  {
    id: "referat",
    title: "Skriv et kampreferat",
    purpose: "Tekst",
    description:
      "Et kort, selvstendig sammendrag basert på flere kilder. Ingen kamper har referat ennå.",
    prompt: `Jeg vil skrive et kampreferat til det åpne AaFK-arkivet ${REPO}.

Kampen: [LIM INN YAML-FILEN ELLER BESKRIV KAMPEN]
Kilder jeg har: [LIM INN LENKER ELLER UTDRAG]

ABSOLUTT KRAV — les dette først:

Referatet skal være DIN EGEN formulering, skrevet for dette arkivet. Du skal ikke
kopiere setninger fra avisartikler, klubbsider eller andre referat, og du skal ikke
omskrive én enkelt artikkel setning for setning. Det siste er like ulovlig som å
kopiere, bare vanskeligere å oppdage. Bygg teksten på FAKTA fra flere kilder —
hvem scoret, når, hva som avgjorde — og skriv den fra bunnen.

Fakta er frie. Tekst er det ikke.

Har du bare én kilde, si fra om det i stedet for å skrive noe som ligger tett på den.

Formatet:

report:
  summary: En eller to setninger. Dette vises i lister og søk.
  body: |
    Tre til seks avsnitt. Hva som skjedde, hva som avgjorde, hva kampen betydde
    i sesongen. Nøktern tone — dette er et arkiv, ikke en heiarop.

Lenker til originalene legges ved som:

externalReports:
  - publisher: Sunnmørsposten
    title: Overskriften slik den står
    url: https://...
    date: 2011-11-06

Skriv referatet, og list opp hvilke faktapåstander som kommer fra hvilken kilde,
slik at jeg kan kontrollere dem.

${PR_FLOW}`,
  },
  ];
}
