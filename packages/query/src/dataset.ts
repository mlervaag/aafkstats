/**
 * Datasettdokumentasjonen.
 *
 * Dette er én kilde med to lesere: `/data`-siden rendrer den for mennesker, og
 * chattens systemprompt får den samme teksten via `datasetPrompt()`. Poenget er at
 * det ikke skal finnes to beskrivelser av datasettet som kan skli fra hverandre —
 * det modellen får vite er nøyaktig det brukeren kan lese.
 *
 * Når en kolonne legges til i packages/db/src/schema.sql, skal den også inn her.
 * Testen `dataset.test.ts` feiler hvis dokumentasjonen og databasen ikke stemmer overens.
 */

export interface ColumnDoc {
  name: string;
  type: string;
  description: string;
}

export interface ViewDoc {
  name: string;
  summary: string;
  /** Ting man må vite for å ikke tolke tallene feil. */
  caveats?: string[];
  columns: ColumnDoc[];
}

export const DATASET_VERSION = "1";

export const views: ViewDoc[] = [
  {
    name: "matches",
    summary:
      "Én rad per kamp i arkivet, sett fra AaFKs synsvinkel. Dette er hovedtabellen — " +
      "de fleste spørsmål besvares herfra alene.",
    caveats: [
      "Alle kamper i arkivet involverer AaFK. «aafk_score» er alltid vårt lag, uansett om vi spilte hjemme eller borte.",
      "goal_difference er aafk_score minus opponent_score, altså negativ ved tap.",
      "result regnes etter ordinær tid pluss ekstraomgang. En kamp avgjort på straffer har result = 'U' — bruk won_on_penalties for å se hvem som gikk videre.",
      "Kamper som ennå ikke er spilt har status 'scheduled' og NULL i alle resultatkolonner. Filtrer på status = 'played' når du regner statistikk.",
      "confidence sier hvor sikre opplysningene er. 'probable' er vanlig for kamper før 1990. Si fra i svaret når en kamp ikke er 'confirmed'.",
      "SQLite har ingen boolsk type: is_home, neutral_venue og has_conflicts er heltall 0 eller 1. Skriv «WHERE is_home = 1», ikke «WHERE is_home IS TRUE».",
    ],
    columns: [
      { name: "match_id", type: "text", description: "Unik ID, på formen YYYY-MM-DD-hjemmelag-bortelag." },
      { name: "date", type: "text (YYYY-MM-DD)", description: "Kampdato." },
      { name: "season", type: "integer", description: "Sesongåret kampen tilhører." },
      { name: "date_confidence", type: "text", description: "'exact', 'month' eller 'year'. For gamle kamper er noen ganger bare året kjent." },
      { name: "kickoff", type: "text (HH:MM)", description: "Avspark, lokal tid. Ofte NULL for eldre kamper." },
      { name: "status", type: "text", description: "'played', 'scheduled', 'abandoned', 'awarded', 'cancelled' eller 'postponed'." },
      { name: "competition", type: "text", description: "Konkurransens navn slik det var på kampdatoen — «Tippeligaen» for en kamp i 2005, «Eliteserien» for en i 2024." },
      { name: "competition_type", type: "text", description: "'league', 'national_cup', 'european', 'friendly' eller 'playoff'." },
      { name: "competition_tier", type: "integer", description: "Nivå i seriepyramiden, 1 er øverst. NULL for cup og europa." },
      { name: "stage", type: "text", description: "'regular_season', 'quarter_final', 'final' osv." },
      { name: "round", type: "integer", description: "Serierunde eller cuprunde." },
      { name: "is_home", type: "integer (0/1)", description: "Sant når AaFK spilte på hjemmebane." },
      { name: "opponent", type: "text", description: "Motstanderens navn slik det var på kampdatoen." },
      { name: "opponent_club_id", type: "text", description: "Motstanderens ID, stabil over tid selv om navnet endres." },
      { name: "aafk_score", type: "integer", description: "AaFKs mål, inkludert ekstraomganger." },
      { name: "opponent_score", type: "integer", description: "Motstanderens mål, inkludert ekstraomganger." },
      { name: "goal_difference", type: "integer", description: "aafk_score minus opponent_score. Negativ ved tap." },
      { name: "result", type: "text", description: "'S' seier, 'U' uavgjort, 'T' tap. NULL når kampen ikke er spilt." },
      { name: "decided_on_penalties", type: "integer (0/1)", description: "Sant når kampen gikk til straffesparkkonkurranse." },
      { name: "won_on_penalties", type: "integer (0/1)", description: "Ved straffekonkurranse: vant AaFK den? Ellers NULL." },
      { name: "venue", type: "text", description: "Stadionnavn slik det var på kampdatoen." },
      { name: "neutral_venue", type: "integer (0/1)", description: "Sant når kampen ble spilt på nøytral bane." },
      { name: "attendance", type: "integer", description: "Tilskuertall. Ofte NULL for eldre kamper." },
      { name: "referee", type: "text", description: "Dommer." },
      { name: "report_summary", type: "text", description: "Én til to setningers sammendrag, der det finnes." },
      { name: "confidence", type: "text", description: "'confirmed', 'probable' eller 'disputed'." },
      { name: "has_conflicts", type: "integer (0/1)", description: "Sant når kilder er uenige om noe i kampen." },
      { name: "completeness", type: "real", description: "0–1: hvor mye av kampen som er dokumentert." },
      { name: "tags", type: "text (JSON-liste)", description: "Frie stikkord, f.eks. 'derby'." },
      { name: "url", type: "text", description: "Lenke til kampsiden. Bruk denne som kildehenvisning i svar." },
    ],
  },
  {
    name: "seasons",
    summary: "Ett sammendrag per sesong: plassering, målforskjell og resultatfordeling.",
    caveats: [
      "Tallene dekker kun sesongens hovedkonkurranse. Cup, europa og treningskamper er ikke med — bruk matches hvis du vil ha alt.",
    ],
    columns: [
      { name: "season", type: "integer", description: "Sesongår." },
      { name: "competition", type: "text", description: "Konkurransens navn det året." },
      { name: "competition_type", type: "text", description: "Konkurransetype." },
      { name: "competition_tier", type: "integer", description: "Nivå, 1 er øverst." },
      { name: "final_position", type: "integer", description: "Sluttplassering." },
      { name: "teams_in_league", type: "integer", description: "Antall lag i divisjonen." },
      { name: "head_coach", type: "text", description: "Hovedtrener." },
      { name: "promoted", type: "integer (0/1)", description: "Rykket opp." },
      { name: "relegated", type: "integer (0/1)", description: "Rykket ned." },
      { name: "played", type: "integer", description: "Antall spilte kamper." },
      { name: "wins", type: "integer", description: "Seire." },
      { name: "draws", type: "integer", description: "Uavgjorte." },
      { name: "losses", type: "integer", description: "Tap." },
      { name: "goals_for", type: "integer", description: "Mål scoret." },
      { name: "goals_against", type: "integer", description: "Mål sluppet inn." },
      { name: "goal_difference", type: "integer", description: "Målforskjell." },
      { name: "avg_home_attendance", type: "real", description: "Snitt tilskuertall på hjemmekamper." },
      { name: "url", type: "text", description: "Lenke til sesongsiden." },
    ],
  },
  {
    name: "opponents",
    summary: "Innbyrdes statistikk mot hver motstander, over hele arkivet og alle konkurranser.",
    columns: [
      { name: "opponent_club_id", type: "text", description: "Motstanderens ID." },
      { name: "opponent", type: "text", description: "Motstanderens navn (dagens navn)." },
      { name: "city", type: "text", description: "Motstanderens by." },
      { name: "played", type: "integer", description: "Antall spilte kamper mot laget." },
      { name: "wins", type: "integer", description: "AaFK-seire." },
      { name: "draws", type: "integer", description: "Uavgjorte." },
      { name: "losses", type: "integer", description: "AaFK-tap." },
      { name: "goals_for", type: "integer", description: "AaFK-mål totalt." },
      { name: "goals_against", type: "integer", description: "Innslupne mål totalt." },
      { name: "first_meeting", type: "text (YYYY-MM-DD)", description: "Første møte." },
      { name: "last_meeting", type: "text (YYYY-MM-DD)", description: "Siste spilte møte." },
      { name: "url", type: "text", description: "Lenke til motstandersiden." },
    ],
  },
  {
    name: "match_events",
    summary: "Én rad per hendelse i en kamp: mål, kort og innbytter.",
    caveats: [
      "Dekningen er svært ujevn. Hendelser finnes stort sett bare for kamper fra ca. 2010 og framover. Fravær av mål her betyr ikke at det ikke ble scoret — sjekk aafk_score i matches.",
      "team er 'aafk' eller 'opponent', ikke hjemme/borte.",
    ],
    columns: [
      { name: "match_id", type: "text", description: "Kampens ID." },
      { name: "date", type: "text (YYYY-MM-DD)", description: "Kampdato." },
      { name: "season", type: "integer", description: "Sesongår." },
      { name: "minute", type: "integer", description: "Spilleminutt." },
      { name: "stoppage", type: "integer", description: "Tilleggstid. 45+2 er minute 45, stoppage 2." },
      { name: "event_type", type: "text", description: "'goal', 'own_goal', 'penalty_goal', 'yellow_card', 'red_card', 'substitution' m.fl." },
      { name: "team", type: "text", description: "'aafk' eller 'opponent'." },
      { name: "player", type: "text", description: "Spiller." },
      { name: "assist", type: "text", description: "Målgivende." },
      { name: "player_off", type: "text", description: "Ved innbytte: spilleren som gikk ut." },
      { name: "url", type: "text", description: "Lenke til kampsiden." },
    ],
  },
  {
    name: "reports",
    summary:
      "Kampreferat, som en FTS5-tabell. Samme objekt dekker begge bruksmåtene: " +
      "fritekstsøk og oppslag på match_id.",
    caveats: [
      "Alle referat er skrevet for dette arkivet — aldri kopiert fra avis eller klubbside.",
      "Fritekstsøk: WHERE reports MATCH 'ordet'. Flere ord: MATCH 'ord1 ord2' (OG), MATCH 'ord1 OR ord2'. Prefiks: MATCH 'snuoper*'.",
      "Bare summary og body er søkbare. De andre kolonnene leses ut som vanlig, men treffer ikke på MATCH.",
      "Dekningen er tynn — de fleste kamper har ennå ikke referat. Tomt søkeresultat betyr som regel at referatet mangler, ikke at kampen ikke finnes.",
    ],
    columns: [
      { name: "match_id", type: "text", description: "Kampens ID." },
      { name: "date", type: "text (YYYY-MM-DD)", description: "Kampdato." },
      { name: "season", type: "integer", description: "Sesongår." },
      { name: "opponent", type: "text", description: "Motstander." },
      { name: "is_home", type: "integer (0/1)", description: "Hjemmekamp." },
      { name: "result", type: "text", description: "'S', 'U' eller 'T'." },
      { name: "summary", type: "text", description: "Kort sammendrag." },
      { name: "body", type: "text", description: "Referatet." },
      { name: "byline", type: "text", description: "Hvem som skrev det." },
      { name: "url", type: "text", description: "Lenke til kampsiden." },
    ],
  },
  {
    name: "sources",
    summary: "Kildekatalogen — hvor dataene kommer fra og hvor mye vi stoler på hver kilde.",
    columns: [
      { name: "source_id", type: "text", description: "Kildens ID." },
      { name: "name", type: "text", description: "Kildens navn." },
      { name: "url", type: "text", description: "Kildens nettadresse." },
      { name: "priority", type: "integer", description: "Høyere tall vinner når kilder er uenige." },
      { name: "license", type: "text", description: "Lisens, der den er kjent." },
      { name: "note", type: "text", description: "Forbehold og dekningsområde." },
    ],
  },
];

/** Eksempelspørringer som vises på /data og gis til modellen som mønster. */
export const exampleQueries: { question: string; sql: string }[] = [
  {
    question: "Når tapte vi sist med 6 mål på hjemmebane?",
    sql: `SELECT date, opponent, aafk_score, opponent_score, competition, url
FROM matches
WHERE is_home = 1 AND result = 'T' AND goal_difference <= -6
ORDER BY date DESC
LIMIT 1`,
  },
  {
    question: "Hvilken motstander har vi tapt flest ganger mot?",
    sql: `SELECT opponent, losses, played, wins, draws
FROM opponents
ORDER BY losses DESC
LIMIT 5`,
  },
  {
    question: "Hvor mange mål scoret vi i 2024?",
    sql: `SELECT sum(aafk_score) AS mal, count(*) AS kamper
FROM matches
WHERE season = 2024 AND status = 'played'`,
  },
  {
    question: "Hvilke sesonger har vi hatt best målforskjell?",
    sql: `SELECT season, competition, goal_difference, final_position
FROM seasons
ORDER BY goal_difference DESC
LIMIT 5`,
  },
  {
    question: "Finnes det referat som nevner snuoperasjon?",
    sql: `SELECT match_id, date, opponent, summary, url
FROM reports
WHERE reports MATCH 'snuoperasjon'
ORDER BY date DESC`,
  },
  {
    question: "Har vi noen gang vunnet en cupkamp på straffer?",
    sql: `SELECT date, opponent, aafk_score, opponent_score, url
FROM matches
WHERE decided_on_penalties = 1 AND won_on_penalties = 1
ORDER BY date DESC`,
  },
];

/**
 * Datasettet som markdown, til systemprompten.
 *
 * Holdes stabil mellom kall slik at prompt-cachen faktisk treffer — ingen tidsstempler
 * eller annet som endrer seg per forespørsel.
 */
export function datasetPrompt(): string {
  const lines: string[] = [
    "# Datasett: AaFK-arkivet",
    "",
    `SQLite. Datasettversjon ${DATASET_VERSION}.`,
    "Dette er de eneste tabellene som finnes. Interne tabeller med core_-prefiks er ikke tilgjengelige.",
    "",
  ];

  for (const view of views) {
    lines.push(`## ${view.name}`, "", view.summary, "");
    if (view.caveats?.length) {
      lines.push("Viktig:");
      for (const c of view.caveats) lines.push(`- ${c}`);
      lines.push("");
    }
    lines.push("| kolonne | type | betydning |", "|---|---|---|");
    for (const col of view.columns) {
      lines.push(`| ${col.name} | ${col.type} | ${col.description} |`);
    }
    lines.push("");
  }

  lines.push("## Eksempler", "");
  for (const ex of exampleQueries) {
    lines.push(`**${ex.question}**`, "```sql", ex.sql, "```", "");
  }

  return lines.join("\n");
}
