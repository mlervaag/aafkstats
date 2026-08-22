import { coverageMarkdown } from "./coverage.js";
import type { DatasetCoverage } from "./coverage.js";

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

// Hevet fra 1 da `matches.missing_fields` ble en del av den publiserte kontrakten.
export const DATASET_VERSION = "4";

export const views: ViewDoc[] = [
  {
    name: "source_results",
    summary: "Resultater dokumentert i historiske kilder, men uten nok opplysninger til å være kanoniske kamper.",
    caveats: [
      "aafk_score og opponent_score står alltid fra AaFKs perspektiv. Hjemme/borte er ukjent, og kampdato er bare satt når kilden oppgir den uttrykkelig.",
      "Radene teller ikke i matches, seasons eller kampstatistikken. Bruk match_id når en rad senere er koblet til en komplett kamp.",
      "competition_id er bare satt når kilden uttrykkelig navngir konkurransen. NULL betyr ukjent.",
      "Ved rekorder og spørsmål om hele historien må ukoblede rader vurderes sammen med matches. Omtal dem som resultater kilden oppgir, ikke som fullstendig identifiserte kamper.",
    ],
    columns: [
      { name: "claim_id", type: "text", description: "Globalt stabil claim-identifikator (srcclaim-...) uavhengig av kildekoordinater." },
      { name: "source_id", type: "text", description: "Historisk kilde." },
      { name: "source_title", type: "text", description: "Lesbar tittel på den historiske kilden." },
      { name: "id", type: "text", description: "Stabil ID innen kilden." },
      { name: "season", type: "integer", description: "Året resultatet står under i kilden." },
      { name: "source_order", type: "integer", description: "Rekkefølgen i resultatlista." },
      { name: "page", type: "integer", description: "Trykt sidetall." },
      { name: "date", type: "text", description: "Datoen kilden oppgir på formen YYYY-MM-DD. NULL når kilden ikke oppgir eksakt dato." },
      { name: "opponent", type: "text", description: "Kildens motstandernavn. Kan være NULL ved walkover." },
      { name: "opponent_club_id", type: "text", description: "Kjent klubb når avklart." },
      { name: "aafk_score", type: "integer", description: "AaFKs mål. NULL ved walkover." },
      { name: "opponent_score", type: "integer", description: "Motstanderens mål. NULL ved walkover." },
      { name: "result", type: "text", description: "S, U eller T fra AaFK-perspektivet. NULL ved walkover." },
      { name: "competition_id", type: "text", description: "Konkurranse når kilden sier den uttrykkelig." },
      { name: "status", type: "text", description: "played eller walkover." },
      { name: "replay", type: "integer (0/1)", description: "Omkamp." },
      { name: "after_extra_time", type: "integer (0/1)", description: "Resultat etter ekstraomganger." },
      { name: "round", type: "integer", description: "Runde når oppgitt." },
      { name: "result_group_id", type: "text", description: "Valgfri ID som samler flere kildepåstander om samme uidentifiserte historiske oppgjør." },
      { name: "match_id", type: "text", description: "Kanonisk kamp når koblet. Ellers NULL." },
      { name: "note", type: "text", description: "Kort merknad eller forbehold." },
      { name: "source_url", type: "text", description: "Direktelenke til publikasjonen hos kilden." },
      { name: "url", type: "text", description: "Lenke til kildesiden i arkivet." },
    ],
  },
  {
    name: "venues",
    summary: "Stadioner og baner med historiske navn, AaFKs hjemmebaneperioder, dekke og kildeførte publikumsrekorder.",
    caveats: [
      "home_periods, attendance_records og sources er JSON-lister. En åpen slutt i en hjemmebaneperiode betyr at kilden ikke oppgir slutten eller at perioden fortsatte da siden ble oppdatert.",
      "En publikumsrekord kan være omtrentlig. Bruk approximate-feltet inne i attendance_records før tallet omtales som eksakt.",
    ],
    columns: [
      { name: "id", type: "text", description: "Stabil stadion-ID." },
      { name: "name", type: "text", description: "Kanonisk navn." },
      { name: "city", type: "text", description: "By. Kan være NULL." },
      { name: "country", type: "text", description: "Landkode med to bokstaver." },
      { name: "capacity", type: "integer", description: "Oppgitt kapasitet. Kan være NULL og er ikke det samme som publikumsrekord." },
      { name: "opened", type: "integer", description: "Åpningsår når kjent." },
      { name: "opened_date", type: "text", description: "Eksakt åpningsdato når kjent." },
      { name: "closed", type: "integer", description: "Stengningsår når kjent." },
      { name: "closed_date", type: "text", description: "Eksakt stengnings- eller sluttdato når kjent." },
      { name: "surface", type: "text", description: "'gravel', 'grass' eller 'artificial_turf'." },
      { name: "names", type: "JSON", description: "Tidsavhengige stadionnavn." },
      { name: "surface_history", type: "JSON", description: "Tidfestede banedekker med kilde og eventuelt forbehold." },
      { name: "home_periods", type: "JSON", description: "Klubb, fra-/til-år og kilde for hver hjemmebaneperiode." },
      { name: "attendance_records", type: "JSON", description: "Tilskuertall, motstander, eventuelt år og kontekst, omtrentlig-flagg og kilder." },
      { name: "events", type: "JSON", description: "Kildede åpninger, kamper, byggestarter, oppgraderinger og andre milepæler." },
      { name: "sources", type: "JSON", description: "Kilder som dokumenterer stadionets øvrige felt." },
      { name: "note", type: "text", description: "Forbehold eller kort redaksjonell merknad." },
    ],
  },
  {
    name: "matches",
    summary:
      "Én rad per kamp i arkivet, sett fra AaFKs synsvinkel. Dette er hovedtabellen. " +
      "de fleste spørsmål besvares herfra alene.",
    caveats: [
      "Alle kamper i arkivet involverer AaFK. «aafk_score» er alltid vårt lag, uansett om vi spilte hjemme eller borte.",
      "goal_difference er aafk_score minus opponent_score, altså negativ ved tap.",
      "result regnes etter ordinær tid pluss ekstraomgang. En kamp avgjort på straffer har result = 'U'. Bruk won_on_penalties for å se hvem som gikk videre.",
      "Kamper som ennå ikke er spilt har status 'scheduled' og NULL i alle resultatkolonner. Regner du statistikk, filtrer på status IN ('played', 'awarded'). Det er den samme regelen alle aggregatene i datasettet bruker: en kamp avgjort på grønt bord har et resultat og teller med, en avbrutt kamp har ingen sluttstilling og teller ikke.",
      "confidence sier hvor sikre opplysningene er. 'probable' er vanlig for kamper før 1990. Si fra i svaret når en kamp ikke er 'confirmed'.",
      "Kampstatistikken kommer fra FotMob og finnes bare for deler av 2014–2026. Per 11. august 2026 har 276 av 1 353 kamper ballbesittelse, skudd, skudd på mål og cornere; 138 har fouls og offsider; 105 har xG. NULL betyr at kilden ikke leverte feltet, ikke null hendelser.",
      "Dekningen varierer med kildens historiske payload: 2018 og 2019 leverer ingen av de sju feltene, 2021 leverer fire felt for 17 kamper, og 2024/2025 leverer vanligvis bare de fire grunnfeltene. Én 2024-kamp er holdt utenfor fordi FotMob oppgir 32 cornere.",
      "xG kan ikke sammenlignes ukritisk mellom sesonger: FotMob dokumenterer ikke modellversjonen i kampresponsen, og modellen kan ha endret seg. Arkivet lagrer kildens tall, ikke en egen beregning.",
      "SQLite har ingen boolsk type: is_home, neutral_venue og has_conflicts er heltall 0 eller 1. Skriv «WHERE is_home = 1», ikke «WHERE is_home IS TRUE».",
    ],
    columns: [
      { name: "match_id", type: "text", description: "Unik ID, på formen YYYY-MM-DD-hjemmelag-bortelag." },
      { name: "date", type: "text (YYYY-MM-DD)", description: "Kampdato." },
      { name: "season", type: "integer", description: "Sesongåret kampen tilhører." },
      { name: "date_confidence", type: "text", description: "'exact', 'month' eller 'year'. For gamle kamper er noen ganger bare året kjent." },
      { name: "kickoff", type: "text (HH:MM)", description: "Avspark, lokal tid. Ofte NULL for eldre kamper." },
      { name: "status", type: "text", description: "'played', 'scheduled', 'abandoned', 'awarded', 'cancelled' eller 'postponed'." },
      { name: "competition", type: "text", description: "Konkurransens navn slik det var på kampdatoen: «Tippeligaen» for en kamp i 2005, «Eliteserien» for en i 2024." },
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
      { name: "after_extra_time", type: "integer (0/1)", description: "Sant når kampen gikk til ekstraomganger. Målene derfra er allerede med i aafk_score." },
      { name: "note", type: "text", description: "Forbehold om denne kampen. Eldre kilder oppgir ofte bare sluttresultatet, ikke stillingen etter ordinær tid. Står det noe her, skal det tas med i svaret." },
      { name: "decided_on_penalties", type: "integer (0/1)", description: "Sant når kampen gikk til straffesparkkonkurranse." },
      { name: "won_on_penalties", type: "integer (0/1)", description: "Ved straffekonkurranse: vant AaFK den? Ellers NULL." },
      { name: "venue", type: "text", description: "Stadionnavn slik det var på kampdatoen." },
      { name: "neutral_venue", type: "integer (0/1)", description: "Sant når kampen ble spilt på nøytral bane." },
      { name: "attendance", type: "integer", description: "Tilskuertall. Ofte NULL for eldre kamper." },
      { name: "referee", type: "text", description: "Dommer." },
      { name: "has_stats", type: "integer (0/1)", description: "Sant når kampen har minst ett lagstatistikkfelt." },
      { name: "aafk_possession", type: "real", description: "AaFKs ballbesittelse i prosent, uansett hjemme/borte." },
      { name: "opponent_possession", type: "real", description: "Motstanderens ballbesittelse i prosent." },
      { name: "aafk_shots", type: "integer", description: "AaFKs totale skudd." },
      { name: "opponent_shots", type: "integer", description: "Motstanderens totale skudd." },
      { name: "aafk_shots_on_target", type: "integer", description: "AaFKs skudd på mål." },
      { name: "opponent_shots_on_target", type: "integer", description: "Motstanderens skudd på mål." },
      { name: "aafk_corners", type: "integer", description: "AaFKs cornere." },
      { name: "opponent_corners", type: "integer", description: "Motstanderens cornere." },
      { name: "aafk_fouls", type: "integer", description: "AaFKs registrerte fouls/frispark mot." },
      { name: "opponent_fouls", type: "integer", description: "Motstanderens registrerte fouls/frispark mot." },
      { name: "aafk_offsides", type: "integer", description: "AaFKs offsider." },
      { name: "opponent_offsides", type: "integer", description: "Motstanderens offsider." },
      { name: "aafk_xg", type: "real", description: "FotMobs forventede mål (xG) for AaFK. NULL når kilden ikke leverte xG." },
      { name: "opponent_xg", type: "real", description: "FotMobs forventede mål (xG) for motstanderen." },
      { name: "report_summary", type: "text", description: "Én til to setningers sammendrag, der det finnes." },
      { name: "confidence", type: "text", description: "'confirmed', 'probable' eller 'disputed'." },
      { name: "has_conflicts", type: "integer (0/1)", description: "Sant når en uenighet mellom kilder er ført inn på kampen. Slå opp match_conflicts for å se hva den gjelder. Uenigheten løses ikke automatisk, og høyeste kildeprioritet vinner ikke av seg selv." },
      { name: "completeness", type: "real", description: "0–1: hvor mye av kampen som er dokumentert." },
      { name: "missing_fields", type: "text (JSON-liste)", description: "Feltene completeness savner, som 'score', 'attendance', 'lineups', 'events', 'report', 'referee', 'venue' eller 'providers'. Tom liste betyr at kampen er fullt dokumentert. Bruk json_each for å telle: en kamp uten 'lineups' her har ingen registrert lagoppstilling." },
      { name: "last_retrieved_at", type: "text (YYYY-MM-DD)", description: "Siste gang en kilde ble hentet for kampen. NULL for kamper uten kildehenvisning." },
      { name: "tags", type: "text (JSON-liste)", description: "Frie stikkord, f.eks. 'derby'." },
      { name: "sources", type: "text (JSON-liste)", description: "Historiske publikasjoner som dokumenterer kampen, med sourceId og eventuelt side eller notat." },
      { name: "url", type: "text", description: "Lenke til kampsiden. Bruk denne som kildehenvisning i svar." },
    ],
  },
  {
    name: "match_stats",
    summary: "To rader per kamp med statistikk: én for AaFK og én for motstanderen. Bruk denne ved summering eller sammenligning mellom sider.",
    caveats: [
      "Viewet inneholder kamper med minst ett statistikkfelt. Hvert enkelt felt kan fortsatt være NULL.",
      "side er 'aafk' eller 'opponent'. is_home beskriver om AaFK var hjemmelag, også på motstanderraden.",
      "xG er FotMobs publiserte tall. Ingen xG-differanse lagres; regn ut xg minus motstanderens xg i spørringen når det trengs.",
    ],
    columns: [
      { name: "match_id", type: "text", description: "Kampens ID." },
      { name: "date", type: "text (YYYY-MM-DD)", description: "Kampdato." },
      { name: "season", type: "integer", description: "Sesongår." },
      { name: "competition", type: "text", description: "Konkurransens navn." },
      { name: "competition_type", type: "text", description: "Konkurransetype." },
      { name: "is_home", type: "integer (0/1)", description: "Sant når AaFK var hjemmelag." },
      { name: "side", type: "text", description: "'aafk' eller 'opponent'." },
      { name: "team", type: "text", description: "Laget statistikken gjelder." },
      { name: "opponent", type: "text", description: "Motparten på denne raden." },
      { name: "possession", type: "real", description: "Ballbesittelse i prosent." },
      { name: "shots", type: "integer", description: "Totale skudd." },
      { name: "shots_on_target", type: "integer", description: "Skudd på mål." },
      { name: "corners", type: "integer", description: "Cornere." },
      { name: "fouls", type: "integer", description: "Registrerte fouls/frispark mot." },
      { name: "offsides", type: "integer", description: "Offsider." },
      { name: "xg", type: "real", description: "FotMobs forventede mål; NULL når feltet mangler." },
      { name: "url", type: "text", description: "Lenke til kampsiden." },
    ],
  },
  {
    name: "seasons",
    summary: "Ett sammendrag per sesong OG konkurranse: plassering, målforskjell og resultatfordeling. Et år med både serie og cup gir to rader, så filtrer på competition_id eller competition_type når du vil ha bare den ene.",
    caveats: [
      "Én rad per sesong OG konkurranse. Et år med serie, cup og treningskamper gir tre rader, og tallene i hver rad gjelder bare den konkurransen. Summer aldri over rader uten å filtrere først.",
      "Serieradene teller bare seriekamper. Kvalifiseringskamper etter sesongen ligger i matches, men holdes utenfor her, slik at en komplett sesong ikke ser ufullstendig ut.",
      "En rad betyr at året er representert, ikke at sesongen er komplett. Se coverage, og coverage_evidence for hva merket hviler på. 'complete' krever både sammenhengende runder og et kjent forventet omfang som stemmer; sammenhengende runder alene gir 'unverified'.",
      "Kamper som ikke er spilt teller ikke med i played eller i resultatene. Står scheduled over 0, pågår sesongen.",
      "played teller kamper med status 'played' eller 'awarded', den samme regelen som i matches og opponents. De tre kan derfor sammenlignes direkte.",
    ],
    columns: [
      { name: "season", type: "integer", description: "Sesongår." },
      { name: "competition_id", type: "text", description: "Konkurransens ID. Ett år kan ha flere rader: serie, cup og treningskamper hver for seg." },
      { name: "competition", type: "text", description: "Konkurransens navn det året." },
      { name: "competition_type", type: "text", description: "Konkurransetype." },
      { name: "competition_tier", type: "integer", description: "Nivå, 1 er øverst." },
      { name: "final_position", type: "integer", description: "Sluttplassering, hentet fra standings når vi har tabellen for året." },
      { name: "teams_in_league", type: "integer", description: "Antall lag i divisjonen, talt i standings når vi har tabellen for året." },
      { name: "head_coach", type: "text", description: "Hovedtrener." },
      { name: "promoted", type: "integer (0/1)", description: "Rykket opp." },
      { name: "relegated", type: "integer (0/1)", description: "Rykket ned." },
      { name: "sources", type: "JSON", description: "Historiske publikasjoner som dokumenterer sesongen som helhet." },
      { name: "note", type: "text", description: "Forbehold om sesongen, f.eks. at arkivet bare har deler av den. NULL når det ikke er noe å ta forbehold om." },
      { name: "coverage", type: "text", description: "Hvor godt sesongen er dekket: 'complete' (hver runde fra første til siste, og like mange kamper som det kjente omfanget), 'in_progress' (sesongen pågår, det står kamper igjen på terminlista), 'partial' (runder mangler, eller kampantallet stemmer ikke med omfanget), 'unverified' (rundene henger sammen, men ingen kilde sier hvor mange det skulle vært), 'isolated' (kamper uten rundenummer), 'not_applicable' (cup og treningskamper, som ikke har serierunder). Bruk denne når spørsmålet gjelder om et tall er hele sesongen eller bare det arkivet har." },
      { name: "coverage_evidence", type: "text", description: "Hva merket hviler på: 'rounds_and_standings' (sluttabellen sier hvor mange kamper AaFK spilte, og arkivet har like mange), 'rounds_and_declared_count' (omfanget er oppgitt for hånd i sesongfila), 'rounds_only' (bare rundenumre, omfanget er ukjent), 'isolated_matches_only', 'season_in_progress', 'not_applicable'." },
      { name: "expected_matches", type: "integer", description: "Hvor mange kamper AaFK skulle spilt i konkurransen det året. Hentet fra sluttabellen når vi har den, ellers fra sesongfila. NULL betyr at ingen vet, og da kan sesongen ikke være 'complete'." },
      { name: "last_round", type: "integer", description: "Høyeste serierunde i sesongen. For en komplett sesong er dette antall runder. NULL for cup og treningskamper." },
      { name: "scheduled", type: "integer", description: "Kamper som står igjen på terminlista i denne konkurransen. Over 0 betyr at sesongen pågår, ikke at arkivet mangler noe. Disse kampene er ikke med i played, wins, draws, losses eller målene." },
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
    caveats: [
      "played, wins, draws og losses regnes over de samme kampene, statusene 'played' og 'awarded'. wins + draws + losses er derfor alltid lik played.",
      "first_meeting ser også kamper som ikke er spilt. En motstander vi har på terminlista uten å ha møtt står med played = 0 og last_meeting = NULL.",
      "Viewet summerer bare kanoniske kamper. Ved spørsmål om komplett historikk må ukoblede source_results vises separat, aldri legges direkte til disse tallene.",
    ],
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
    name: "standings",
    summary:
      "Sluttabellen for en seriesesong, ett lag per rad. Bruk denne når spørsmålet gjelder " +
      "hvor AaFK endte, hvem som vant divisjonen, eller hvor mange poeng det skilte.",
    caveats: [
      "Bare seriesesonger, og bare de årene kilden har tabell for. Cupen har ingen tabell.",
      "team er kildens eget lagnavn. club_id er satt for lagene arkivet kjenner fra før og NULL for resten, siden AaFK ikke har møtt alle lagene i hver divisjon. Filtrer på club_id = 'aalesunds-fk' for å finne vår egen rad.",
      "points er tallet tabellen viser, ikke wins*3+draws. Poengtrekk finnes, og to poeng for seier gjaldt til 1987.",
      "Tabellen dekker bare seriekampene. Cupkamper samme år ligger i matches og er ikke med her.",
    ],
    columns: [
      { name: "competition_id", type: "text", description: "Konkurransens ID." },
      { name: "competition", type: "text", description: "Konkurransens navn." },
      { name: "season", type: "integer", description: "Sesongår." },
      { name: "position", type: "integer", description: "Plassering, 1 er øverst." },
      { name: "team", type: "text", description: "Lagets navn slik kilden skrev det." },
      { name: "club_id", type: "text", description: "Klubben i arkivet, når den finnes der. NULL ellers." },
      { name: "played", type: "integer", description: "Spilte kamper." },
      { name: "wins", type: "integer", description: "Seire." },
      { name: "draws", type: "integer", description: "Uavgjorte." },
      { name: "losses", type: "integer", description: "Tap." },
      { name: "goals_for", type: "integer", description: "Scorede mål." },
      { name: "goals_against", type: "integer", description: "Innslupne mål." },
      { name: "goal_difference", type: "integer", description: "Målforskjell." },
      { name: "points", type: "integer", description: "Poeng slik tabellen viser dem." },
      { name: "outcome", type: "text", description: "'promoted', 'relegated', 'promotion_playoff', 'relegation_playoff', 'playoff' eller 'none'." },
      { name: "sources", type: "JSON", description: "Array av kildereferanser som dokumenterer plasseringen." },
      { name: "note", type: "text", description: "Kildens egen merknad bak poengsummen, f.eks. en europacupplass." },
      { name: "url", type: "text", description: "Lenke til motstandersiden når klubben finnes i arkivet." },
    ],
  },
  {
    name: "standings_progression",
    summary:
      "Hvor AaFK lå i tabellen etter hver serierunde. Bruk denne når spørsmålet gjelder " +
      "utviklingen gjennom en sesong, ikke hvor den endte.",
    caveats: [
      "Utregnet ved innhøsting av kildens fulle runderekke, ikke lagret som kamper. Kampene til de andre lagene ligger ikke i arkivet.",
      "Bare sesonger der utregningen lander på nøyaktig samme rad som tabellen kilden trykte. Gjør den ikke det, er raden utelatt framfor å vises feil.",
      "Bare AaFK. De andre lagenes vei gjennom sesongen finnes ikke her.",
    ],
    columns: [
      { name: "competition_id", type: "text", description: "Konkurransens ID." },
      { name: "season", type: "integer", description: "Sesongår." },
      { name: "round", type: "integer", description: "Serierunde." },
      { name: "position", type: "integer", description: "Plassering etter denne runden." },
      { name: "points", type: "integer", description: "Poeng etter denne runden." },
      { name: "played", type: "integer", description: "Spilte kamper etter denne runden. Lavere enn round når en kamp er utsatt." },
      { name: "goal_difference", type: "integer", description: "Målforskjell etter denne runden." },
    ],
  },
  {
    name: "squad",
    summary:
      "Stallen per sesong: hvem som var med, hvor mange kamper og hvor mange mål. " +
      "Bruk denne på spørsmål om spillere, ikke matches.",
    caveats: [
      "Utledet av lagoppstillingene, som arkivet har fra 2010. Sesonger før det har ingen rader her, og det er en manglende kilde og ikke en tom stall.",
      "appearances teller oppsatte tropper, ikke spilletid. Benken er med, fordi kilden ikke skiller mellom en som satt der og en som kom inn. Bruk starts når spørsmålet gjelder hvem som spilte.",
      "goals teller bare mål i kamper der navnet står i hendelseslista. En kamp uten hendelser gir null mål for alle som spilte den.",
      "person_key slår sammen skrivemåter av samme navn. name er den skrivemåten vi viser.",
      "Bare AaFKs egne spillere. Motstandernes oppstillinger er registrert, men er ikke med her.",
      "number, position, nationality og wikidata kommer fra personregisteret og dekker en del av stallen, ikke hele. NULL betyr at personen ikke står der, ikke at opplysningen ikke finnes.",
    ],
    columns: [
      { name: "season", type: "integer", description: "Sesongår." },
      { name: "person_key", type: "text", description: "Personens identitet, normalisert. Bruk denne når du grupperer over sesonger." },
      { name: "name", type: "text", description: "Navnet slik det vises." },
      { name: "appearances", type: "integer", description: "Kamper spilleren sto oppført i troppen." },
      { name: "starts", type: "integer", description: "Kamper fra start." },
      { name: "goals", type: "integer", description: "Mål i sesongen, talt fra hendelsene." },
      { name: "person_id", type: "text", description: "Personen i registeret, når hun eller han står der. NULL ellers." },
      { name: "number", type: "integer", description: "Draktnummer den sesongen, fra personregisteret. NULL når vi ikke har det." },
      { name: "position", type: "text", description: "'keeper', 'forsvar', 'midtbane' eller 'angrep', fra personregisteret." },
      { name: "nationality", type: "text", description: "Nasjonalitet slik kilden skrev den, f.eks. 'Norge'." },
      { name: "wikidata", type: "text", description: "Wikidata-ID, f.eks. Q1796755. Peker videre; dataene bak hentes ikke hit." },
      { name: "first_match", type: "text (YYYY-MM-DD)", description: "Første kamp i troppen den sesongen." },
      { name: "last_match", type: "text (YYYY-MM-DD)", description: "Siste kamp i troppen den sesongen." },
    ],
  },
  {
    name: "people",
    summary: "Personregisteret: identitet, samlet kampaktivitet og om personen har kildeførte roller i klubben.",
    caveats: [
      "Registeret omfatter personer med eksplisitt personfil. Spillere som bare finnes som et navn i én oppstilling kan derfor finnes i squad uten å finnes her.",
      "appearances er registrerte kamptropper, ikke nødvendigvis innhopp eller spilleminutter.",
      "role_count gjelder eksplisitte roller i person_roles; spilleraktivitet fra kampoppstillinger telles separat.",
    ],
    columns: [
      { name: "id", type: "text", description: "Stabil person-ID." },
      { name: "name", type: "text", description: "Navnet slik arkivet viser det." },
      { name: "nationality", type: "text", description: "Nasjonalitet der den er kjent." },
      { name: "position", type: "text", description: "Spillerposisjon der den er kjent." },
      { name: "wikidata", type: "text", description: "Wikidata-ID der den finnes." },
      { name: "sources", type: "JSON", description: "Publikasjoner som omtaler personen, med sidetall der det er kjent." },
      { name: "conflicts", type: "JSON", description: "Verv der kildene oppgir ulike navn. Ingen er avgjort maskinelt; `decision` sier hvordan en eventuell avgjørelse ble tatt." },
      { name: "note", type: "text", description: "Redaksjonelt forbehold." },
      { name: "has_conflicts", type: "integer (0/1)", description: "Sant når kilder er uenige om en rolle. Slå opp person_conflicts." },
      { name: "first_season", type: "integer", description: "Første sesong med registrert kamptropp." },
      { name: "last_season", type: "integer", description: "Siste sesong med registrert kamptropp." },
      { name: "appearances", type: "integer", description: "Antall registrerte kamptropper." },
      { name: "starts", type: "integer", description: "Antall registrerte starter." },
      { name: "role_count", type: "integer", description: "Antall eksplisitt kildeførte roller." },
      { name: "first_role_year", type: "text", description: "Første år med eksplisitt rolle." },
      { name: "last_role_year", type: "text", description: "Siste år med eksplisitt rolle." },
      { name: "role_categories", type: "JSON", description: "Kategoriene personen har roller i." },
      { name: "url", type: "text", description: "Lenke til personsiden." },
    ],
  },
  {
    name: "person_roles",
    summary: "Én rad per kildeførte rolle eller verv i AaFK-organisasjonen.",
    caveats: [
      "Perioden er så presis som kilden: enten år eller eksakt dato. Ikke utled ansettelsesdatoer fra årstall.",
      "Tomrom betyr at rollen ikke er kartlagt, ikke at vervet sto tomt.",
      "sources er obligatorisk og peker på publikasjon og side for hver rolle.",
    ],
    columns: [
      { name: "person_id", type: "text", description: "Personens stabile ID." },
      { name: "name", type: "text", description: "Navnet slik arkivet viser det." },
      { name: "role_id", type: "text", description: "Rollens stabile ID innenfor personen." },
      { name: "category", type: "text", description: "'player', 'coach', 'sporting_staff', 'board', 'administration', 'honorary', 'founder' eller 'project'." },
      { name: "title", type: "text", description: "Historisk tittel, for eksempel Formann eller Kasserer." },
      { name: "organization_id", type: "text", description: "Eksplisitt organisasjonsenhet, for eksempel aafk eller aafk-as." },
      { name: "organization_name", type: "text", description: "Lesbart navn på organisasjonsenheten." },
      { name: "body", type: "text", description: "Organisasjonsdel, for eksempel Hovedstyret." },
      { name: "from_date", type: "text", description: "Start som ÅÅÅÅ eller ÅÅÅÅ-MM-DD." },
      { name: "to_date", type: "text", description: "Slutt som ÅÅÅÅ eller ÅÅÅÅ-MM-DD. NULL når ukjent eller løpende." },
      { name: "sources", type: "JSON", description: "Publikasjon, side og dokumenterte felt." },
      { name: "note", type: "text", description: "Forbehold eller kildekonflikt." },
      { name: "url", type: "text", description: "Lenke til personsiden." },
    ],
  },
  {
    name: "organizations",
    summary: "Organisasjonsenheter som roller og snapshots kan knyttes til.",
    caveats: ["AaFK, Ålesund Fotball AS og stadionvirksomhet er separate enheter selv når de deler personer."],
    columns: [
      { name: "id", type: "text", description: "Stabil organisasjons-ID." },
      { name: "name", type: "text", description: "Offisielt eller historisk navn." },
      { name: "organization_number", type: "text", description: "Organisasjonsnummer der det er kjent." },
      { name: "kind", type: "text", description: "club, company eller stadium." },
      { name: "note", type: "text", description: "Redaksjonelt skille eller forbehold." },
    ],
  },
  {
    name: "organization_snapshots",
    summary: "Personer og roller observert i en organisasjonsoversikt på én bestemt dato.",
    caveats: [
      "snapshot_date beviser bare at personen hadde rollen da; den er aldri automatisk start- eller sluttdato.",
      "Bruk person_roles når en kilde faktisk dokumenterer en periode.",
    ],
    columns: [
      { name: "snapshot_date", type: "text", description: "Observasjonsdato som ÅÅÅÅ eller ÅÅÅÅ-MM-DD." },
      { name: "organization_id", type: "text", description: "Stabil organisasjons-ID." },
      { name: "organization_name", type: "text", description: "Lesbart organisasjonsnavn." },
      { name: "person_id", type: "text", description: "Stabil person-ID." },
      { name: "name", type: "text", description: "Personens visningsnavn." },
      { name: "observed_title", type: "text", description: "Tittelen ordrett fra kilden." },
      { name: "category", type: "text", description: "Stabil rollekategori." },
      { name: "body", type: "text", description: "Avdeling eller organisasjonsdel." },
      { name: "sources", type: "JSON", description: "Kilden som dokumenterer snapshotet." },
      { name: "note", type: "text", description: "Forbehold om dekning eller proveniens." },
      { name: "url", type: "text", description: "Lenke til personsiden." },
    ],
  },
  {
    name: "person_conflicts",
    summary: "Én rad per kildeverdi i en uenighet om en personrolle eller et verv.",
    caveats: [
      "decision = 'unresolved' betyr at arkivet ikke har valgt mellom kildene. Oppgi begge navnene og kildene.",
      "field kombinerer normalt rolle og år, for eksempel formann.1968.",
      "Kildeprioritet avgjør aldri en konflikt automatisk.",
    ],
    columns: [
      { name: "person_id", type: "text", description: "Personen konfliktoppføringen er lagret på." },
      { name: "name", type: "text", description: "Navnet slik arkivet viser det." },
      { name: "field", type: "text", description: "Vervet og året uenigheten gjelder." },
      { name: "provider_id", type: "text", description: "Kilden som oppgir denne verdien." },
      { name: "value", type: "text", description: "Personnavnet kilden oppgir." },
      { name: "value_note", type: "text", description: "Kildens eller innhøstingens merknad til verdien." },
      { name: "is_chosen", type: "integer (0/1)", description: "Sant når et menneske har valgt denne verdien." },
      { name: "decision", type: "text", description: "unresolved, manual, source_priority eller independent_source." },
      { name: "decided_at", type: "text (YYYY-MM-DD)", description: "Dato for avgjørelsen, eller NULL." },
      { name: "reason", type: "text", description: "Begrunnelse når konflikten er avgjort." },
      { name: "locked", type: "integer (0/1)", description: "Sant når avgjørelsen er låst mot ny innhøsting." },
      { name: "conflict_note", type: "text", description: "Merknad om uenigheten som helhet." },
      { name: "url", type: "text", description: "Lenke til personsiden." },
    ],
  },
  {
    name: "coach_spells",
    summary:
      "Én rad per sammenhengende periode en trener hadde laget. Bruk denne på " +
      "spørsmål om hvem som var trener når, og om trenerbytter.",
    caveats: [
      "Utledet av hvem som står oppført på hver kamp, ikke av ansettelsesdatoer. En periode starter på første kamp og slutter på siste, ikke på dagen avtalen ble skrevet.",
      "Et trenerbytte midt i sesongen gir to rader det året. 2023 gir tre.",
      "En trener som kommer tilbake får to rader. Kjetil Rekdal har en periode fra 2010 og en fra 2024.",
      "Bare fra 2010, som er der lagoppstillingene starter.",
    ],
    columns: [
      { name: "person_key", type: "text", description: "Trenerens identitet, normalisert." },
      { name: "name", type: "text", description: "Navnet slik det vises." },
      { name: "from_date", type: "text (YYYY-MM-DD)", description: "Første kamp i perioden." },
      { name: "to_date", type: "text (YYYY-MM-DD)", description: "Siste kamp i perioden." },
      { name: "from_season", type: "integer", description: "Sesongen perioden startet." },
      { name: "to_season", type: "integer", description: "Sesongen perioden sluttet." },
      { name: "matches", type: "integer", description: "Kamper i perioden." },
    ],
  },
  {
    name: "declared_coach_spells",
    summary:
      "Trenerperioder oppgitt av en kilde, for årene kampdataene ikke rekker. " +
      "Bruk coach_spells når spørsmålet gjelder 2010 eller senere.",
    caveats: [
      "Oppgitt, ikke utledet: som regel bare årstall, og vikarene mangler. Christian Johnsen står som 2023 til 2024; at Marius Boee og Sindre Eid hadde laget imellom, vet bare kampene.",
      "Rekker til 2001. Eldre trenere finnes ikke i noen kilde vi har.",
      "Overlapper med coach_spells for 2010 og senere. De to erstatter ikke hverandre; coach_spells er den nøyaktige.",
    ],
    columns: [
      { name: "person_id", type: "text", description: "Personen i registeret." },
      { name: "name", type: "text", description: "Navnet slik det vises." },
      { name: "from_season", type: "integer", description: "Første sesong i perioden." },
      { name: "to_season", type: "integer", description: "Siste sesong. NULL når perioden ikke er avsluttet i kilden." },
      { name: "from_date", type: "text", description: "Dagen perioden begynte, der kilden oppgir den. NULL når bare året er kjent." },
      { name: "to_date", type: "text", description: "Dagen perioden sluttet, der kilden oppgir den. NULL når bare året er kjent." },
    ],
  },
  {
    name: "match_events",
    summary: "Én rad per hendelse i en kamp: mål, kort og innbytter.",
    caveats: [
      "Dekningen er ujevn og følger kilden, ikke kalenderen: kamper hentet fra FotMob har hendelser, kamper hentet fra RSSSF har bare resultatet. Fravær av mål her betyr ikke at det ikke ble scoret. Sjekk aafk_score i matches.",
      "Antallet kamper med hendelser står i dekningsavsnittet nederst, regnet ut av databasen ved hver bygging.",
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
      "Alle referat er skrevet for dette arkivet, aldri kopiert fra avis eller klubbside.",
      "Fritekstsøk: WHERE reports MATCH 'ordet'. Flere ord: MATCH 'ord1 ord2' (OG), MATCH 'ord1 OR ord2'. Prefiks: MATCH 'snuoper*'.",
      "Bare summary og body er søkbare. De andre kolonnene leses ut som vanlig, men treffer ikke på MATCH.",
      "Arkivet har foreløpig ingen egne kampreferat. Et tomt søkeresultat betyr derfor ikke at kampen mangler, det betyr at ingen har skrevet referatet ennå. Si det slik, ikke som om kampen ikke finnes.",
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
    name: "match_conflicts",
    summary:
      "Én rad per verdi i en uenighet mellom kilder. Bruk denne når has_conflicts er 1, " +
      "eller når confidence er 'disputed', for å si hva uenigheten faktisk gjelder.",
    caveats: [
      "To kilder som er uenige om ett felt gir to rader med samme match_id og field, og ulik value.",
      "decision = 'unresolved' betyr at ingen har tatt stilling. Da er is_chosen 0 på alle radene, og svaret skal oppgi begge verdiene med hver sin kilde framfor å velge en.",
      "Er konflikten avgjort, står begrunnelsen i reason og datoen i decided_at. Gjenfortell begrunnelsen framfor å finne på en.",
      "Ingenting her avgjøres av kildeprioritet automatisk. Et valg er tatt av et menneske, og da står det hvorfor.",
    ],
    columns: [
      { name: "match_id", type: "text", description: "Kampen uenigheten gjelder." },
      { name: "date", type: "text (YYYY-MM-DD)", description: "Kampdato." },
      { name: "season", type: "integer", description: "Sesongår." },
      { name: "opponent", type: "text", description: "Motstanderens navn den datoen." },
      { name: "field", type: "text", description: "Feltet kildene er uenige om, med punktnotasjon: 'away.score', 'attendance'." },
      { name: "provider_id", type: "text", description: "Kilden som oppgir denne verdien." },
      { name: "value", type: "text eller integer", description: "Verdien kilden oppgir." },
      { name: "value_note", type: "text", description: "Kildens eget forbehold om verdien." },
      { name: "is_chosen", type: "integer (0/1)", description: "Sant for verdien arkivet bruker. Alle rader er 0 når konflikten ikke er avgjort." },
      { name: "decision", type: "text", description: "'unresolved', 'manual', 'source_priority' eller 'independent_source'." },
      { name: "decided_at", type: "text (YYYY-MM-DD)", description: "Når valget ble tatt. NULL når det ikke er tatt." },
      { name: "reason", type: "text", description: "Hvorfor valget falt slik. NULL når konflikten står åpen." },
      { name: "locked", type: "integer (0/1)", description: "Sant når verdien er låst mot å bli overskrevet av en senere innhøsting." },
      { name: "conflict_note", type: "text", description: "Notat om uenigheten som helhet." },
      { name: "url", type: "text", description: "Lenke til kampsiden." },
    ],
  },
  {
    name: "providers",
    summary: "Kildekatalogen: hvor dataene kommer fra og hvor mye vi stoler på hver kilde.",
    caveats: [
      "priority er en erklært rangering, ikke en avgjørelsesregel. Ingenting i innhøstingen velger verdi ut fra den.",
      "Hver innhøsting skriver en observasjon per kilde, med kildens rå verdi og den normaliserte. Er to kilder uenige, står begge observasjonene der; ingen av dem vinner av seg selv.",
      "En uenighet blir først synlig i matches.has_conflicts når noen har ført den inn som en konflikt. Feltene i matches.manual overskrives aldri av en senere innhøsting.",
      "Sier du noe om en kamp der kildene er uenige, oppgi begge verdiene og hvilken kilde de kommer fra, framfor å velge en side.",
    ],
    columns: [
      { name: "provider_id", type: "text", description: "Kildens ID." },
      { name: "name", type: "text", description: "Kildens navn." },
      { name: "url", type: "text", description: "Kildens nettadresse." },
      { name: "priority", type: "integer", description: "Kildens rangering. Den avgjør IKKE automatisk hvem som vinner en konflikt; se conflicts i matches og caveats over." },
      { name: "license", type: "text", description: "Lisens, der den er kjent." },
      { name: "automated_access", type: "text", description: "Om kilden kan hentes automatisk: allowed, permission_required, blocked eller unknown." },
      { name: "public_redistribution", type: "text", description: "Om data derfra kan publiseres videre: allowed, permission_required, denied eller unknown. Et annet spørsmål enn om den kan hentes." },
      { name: "attribution_required", type: "integer (0/1)", description: "Om kilden krever kreditering." },
      { name: "permission_status", type: "text", description: "Hva motparten har svart: not_needed, pending, requested, granted eller denied. Sier ingenting om hva vi har bestemt." },
      { name: "ingest_decision", type: "text", description: "Hva vi har bestemt: blocked, pending, allowed eller accepted_risk. «accepted_risk» betyr at prosjekteier har valgt å gå videre uten tillatelse, ikke at tillatelse finnes." },
      { name: "permission_requested_at", type: "text (YYYY-MM-DD)", description: "Når forespørselen ble sendt." },
      { name: "risk_accepted_at", type: "text (YYYY-MM-DD)", description: "Når risikoen ble akseptert." },
      { name: "risk_accepted_by", type: "text", description: "Hvem som aksepterte den." },
      { name: "terms_checked_at", type: "text (YYYY-MM-DD)", description: "Når vilkårene sist ble lest av et menneske." },
      { name: "robots_checked_at", type: "text (YYYY-MM-DD)", description: "Når robots.txt sist ble kontrollert." },
      { name: "permission_note", type: "text", description: "Hva som er avklart, hvem som er spurt, og hva som gjenstår." },
      { name: "note", type: "text", description: "Forbehold og dekningsområde." },
    ],
  },
  {
    name: "contributions",
    summary: "Brukerinnsendte bidrag, observasjoner og minner hentet fra innboksen.",
    caveats: [
      "Bare godkjente bidrag som har gått gjennom redaksjonell kontroll ligger her.",
      "Bidrag knyttes til en kamp (target_id = match_id), sesong (target_id = årstall) eller person (target_id = person_id). Sjekk scope ('match', 'season' eller 'person') for å se hva target_id peker på.",
    ],
    columns: [
      { name: "id", type: "text", description: "Unik ID for bidraget." },
      { name: "scope", type: "text", description: "'match', 'season' eller 'person'." },
      { name: "target_id", type: "text", description: "Kamp-ID eller sesongår." },
      { name: "category", type: "text", description: "Kategori, f.eks. 'memory', 'context', 'trivia', 'event_detail'." },
      { name: "text", type: "text", description: "Selve innholdet." },
      { name: "contributor", type: "text", description: "Forfatterens navn." },
      { name: "submitted_at", type: "text (YYYY-MM-DD)", description: "Innsendingsdato." },
      { name: "verification", type: "text", description: "Grad av bekreftelse: 'unverified', 'corroborated' eller 'verified'." },
      { name: "source_url", type: "text", description: "Eventuell kildelenke for påstanden." },
    ],
  },
  {
    name: "sources",
    summary: "Historisk materiale og kilder fra Nasjonalbiblioteket og AaFK Historiske arkiv.",
    caveats: [
      "Inneholder bøker, medlemsblader, årsmeldinger og andre dokumenter.",
      "Selve innholdet er ikke lagret her, men kan leses via access_url.",
    ],
    columns: [
      { name: "id", type: "text", description: "Unik ID for publikasjonen." },
      { name: "parent_source_id", type: "text", description: "ID for kildens serie (f.eks. aafk-medlemsblad)." },
      { name: "title", type: "text", description: "Tittel." },
      { name: "source_type", type: "text", description: "'book', 'anniversary_book', 'member_magazine', 'annual_report', 'match_program', 'supporter_publication', 'local_history_book', 'newspaper_supplement', 'series' eller 'other'." },
      { name: "issue", type: "text", description: "Utgave." },
      { name: "volume", type: "text", description: "Årgang/Volum." },
      { name: "publisher", type: "text", description: "Utgiver, f.eks. Aalesunds fotballklubb." },
      { name: "year", type: "integer", description: "Utgivelsesår." },
      { name: "urn", type: "text", description: "Stabil bibliografisk identifikator, som regel Nasjonalbibliotekets URN. NULL når ingen er kjent." },
      { name: "author", type: "text", description: "Forfatter eller redaktør. NULL når katalogposten ikke oppgir noen." },
      { name: "description", type: "text", description: "Kort beskrivelse av hva kilden inneholder. NULL når ingen er skrevet." },
      { name: "cover_url", type: "text", description: "Lenke til forsidebilde." },
      { name: "access_url", type: "text", description: "Lenke for å lese publikasjonen hos kilden." },
      { name: "url", type: "text", description: "Lenke til visningssiden på vårt nettsted." },
    ],
  },
  {
    name: "historical_observations",
    summary: "Korte, kildeførte historiske fakta og hendelser med relevans for AaFK.",
    caveats: [
      "Samme observasjon kan være knyttet til flere personer, sesonger, kamper, konkurranser og stadion uten å være duplisert.",
      "date har bare den presisjonen kilden gir og kan være NULL.",
      "sources er JSON med sourceId og eventuelt side; bruk kildesiden for etterprøving.",
    ],
    columns: [
      { name: "id", type: "text", description: "Unik observasjons-ID." },
      { name: "title", type: "text", description: "Kort overskrift." },
      { name: "text", type: "text", description: "Kildebasert parafrase av funnet." },
      { name: "date", type: "text", description: "År, måned eller dato når kilden gir det." },
      { name: "note", type: "text", description: "Eventuelt redaksjonelt forbehold." },
      { name: "sources", type: "JSON", description: "Én eller flere kildehenvisninger." },
      { name: "person_ids", type: "JSON", description: "Kanoniske personer observasjonen gjelder." },
      { name: "season_years", type: "JSON", description: "Sesonger observasjonen vises på." },
      { name: "match_ids", type: "JSON", description: "Kanoniske kamper observasjonen gjelder." },
      { name: "competition_ids", type: "JSON", description: "Konkurranser observasjonen gjelder." },
      { name: "venue_ids", type: "JSON", description: "Stadion og baner observasjonen gjelder." },
      { name: "url", type: "text", description: "Direktelenke til første visningssiden der observasjonen står." },
    ],
  },
  {
    name: "verification_cases",
    summary: "Åpne og avsluttede verifiseringssaker: påstander arkivet ikke kan avgjøre alene, formulert som ett spørsmål hver.",
    caveats: [
      "En sak er et spørsmål, ikke et faktum. Innholdet må aldri leses som en påstand arkivet står inne for.",
      "resolution er NULL så lenge saken er åpen, og status forteller hvorfor en lukket sak er lukket.",
      "target_type og target_id peker på arkivobjektet saken gjelder, men saken er ikke koblet inn i det objektets egne data.",
    ],
    columns: [
      { name: "id", type: "text", description: "Unik saks-ID." },
      { name: "status", type: "text", description: "draft, open, paused, resolved, rejected eller superseded." },
      { name: "category", type: "text", description: "role, identity, match, source_reading eller club." },
      { name: "claim", type: "text", description: "Påstanden saken handler om, slik den står i arkivet i dag." },
      { name: "question", type: "text", description: "Det ene spørsmålet saken ber om svar på." },
      { name: "context", type: "text", description: "Bakgrunnen en leser trenger for å svare." },
      { name: "why_it_matters", type: "text", description: "Hva svaret endrer i arkivet." },
      { name: "yes_meaning", type: "text", description: "Hva et ja betyr konkret." },
      { name: "no_meaning", type: "text", description: "Hva et nei betyr konkret." },
      { name: "inconclusive_meaning", type: "text", description: "Hva et «kan ikke bestemmes»-svar betyr. NULL når standardspråket brukes." },
      { name: "instructions", type: "JSON", description: "Stegene den som svarer bør gå gjennom." },
      { name: "target_type", type: "text", description: "person, match, season, club eller source." },
      { name: "target_id", type: "text", description: "ID-en til objektet saken gjelder." },
      { name: "target_field", type: "text", description: "Feltet i objektet saken gjelder." },
      { name: "sources", type: "JSON", description: "Kilder som støtter, motsier eller gir kontekst, hver med rolle og note." },
      { name: "search_hint", type: "text", description: "Hvor det er verdt å lete. NULL når ingen er skrevet." },
      { name: "newspaper", type: "JSON", description: "Intern kandidat-, kilderesultat- og NB-metadata for en avisverifisering. NULL for andre saker." },
      { name: "research_task", type: "JSON", description: "Strukturert oppgave, alternativer og kontrollert avisproveniens for community research. NULL for andre saker." },
      { name: "estimated_minutes", type: "integer", description: "Anslått arbeid for å svare, i minutter." },
      { name: "priority", type: "integer", description: "0–100. Høyere tall er viktigere." },
      { name: "revision", type: "text", description: "Fingeravtrykk av saksinnholdet, så et svar kan knyttes til versjonen det gjaldt." },
      { name: "published_at", type: "text", description: "Dato saken ble publisert. NULL for utkast." },
      { name: "resolution", type: "JSON", description: "Svar, begrunnelse og dato når saken er avgjort. NULL mens den er åpen." },
      { name: "source_file", type: "text", description: "YAML-fila saken kommer fra." },
      { name: "url", type: "text", description: "Lenke til saksvisningen på vårt nettsted." },
    ],
  },
  {
    name: "publication_extractions",
    summary: "Dekning og proveniens for maskinell analyse av historiske publikasjoner.",
    caveats: [
      "Rå OCR og sammenhengende prosa lagres ikke i databasen.",
      "search_only betyr at publikasjonen kan fulltekstsøkes hos NB, men ikke har sidevis ALTO tilgjengelig for denne pipelinen.",
    ],
    columns: [
      { name: "source_id", type: "text", description: "Publikasjonen i sources." },
      { name: "provider_id", type: "text", description: "Dataleverandøren." },
      { name: "adapter", type: "text", description: "Adapter og versjon." },
      { name: "retrieved_at", type: "text (YYYY-MM-DD)", description: "Dato for kjøringen." },
      { name: "ocr_access", type: "text", description: "alto, search_only eller unavailable." },
      { name: "pages_expected", type: "integer", description: "Antall sider i manifestet." },
      { name: "pages_processed", type: "integer", description: "Antall ALTO-sider som ble analysert." },
      { name: "pages_failed", type: "JSON", description: "Sidelabeler som ikke kunne behandles." },
      { name: "content_hash", type: "text", description: "SHA-256 av analysert ALTO-innhold, uten at innholdet lagres." },
    ],
  },
  {
    name: "fact_candidates",
    summary: "Strukturerte faktakandidater med sidehenvisning, klare for redaksjonell kontroll.",
    caveats: [
      "En kandidat er ikke kanonisk fakta før den er kontrollert og flyttet til person-, sesong- eller kampmodellen.",
      "Feltene inneholder korte faktatokens og ID-er, aldri OCR-prosa.",
    ],
    columns: [
      { name: "source_id", type: "text", description: "Publikasjonen kandidaten kommer fra." },
      { name: "id", type: "text", description: "Deterministisk kandidat-ID." },
      { name: "kind", type: "text", description: "person_mention, person_role, match_result, lineup_or_squad, organization, season_fact eller fixture_list." },
      { name: "page", type: "text", description: "Sidelabel i publikasjonen." },
      { name: "confidence", type: "text", description: "high, medium eller low for det maskinelle treffet." },
      { name: "keywords", type: "JSON", description: "Faktabærende nøkkelord som utløste treffet." },
      { name: "names", type: "JSON", description: "Mulige person- eller organisasjonsnavn." },
      { name: "years", type: "JSON", description: "Eksplisitte årstall på samme tekstlinje." },
      { name: "scores", type: "JSON", description: "Resultattokens på samme tekstlinje." },
      { name: "person_ids", type: "JSON", description: "Entydige treff mot eksisterende personer." },
      { name: "match_ids", type: "JSON", description: "Entydige eller mulige treff mot eksisterende kamper." },
    ],
  },
  {
    name: "resolved_roles",
    summary: "Maskinelt løste personroller med tittel, periode, side og kilde.",
    caveats: [
      "Dette er kandidater, ikke kanoniske fakta. Bruk person_roles for kontrollerte roller.",
      "Oppgi alltid confidence og kilde når et svar bygger på resolved_roles.",
      "from_date kan være NULL når siden ikke oppgir år. Ikke utled et år fra publikasjonens utgivelsesår.",
    ],
    columns: [
      { name: "source_id", type: "text", description: "Publikasjonen rollen kommer fra." },
      { name: "source_title", type: "text", description: "Lesbar tittel på publikasjonen." },
      { name: "id", type: "text", description: "Deterministisk resolver-ID." },
      { name: "page", type: "text", description: "Sidelabel i publikasjonen." },
      { name: "column_no", type: "integer", description: "Nullbasert spaltenummer når kjent." },
      { name: "person_name", type: "text", description: "Navnet slik publikasjonen skriver det." },
      { name: "person_id", type: "text", description: "Kjent person i registeret når navnet er avstemt." },
      { name: "category", type: "text", description: "Rolleklasse, som board, coach eller honorary." },
      { name: "title", type: "text", description: "Historisk tittel eller verv." },
      { name: "body", type: "text", description: "Organisasjonsdel når siden oppgir den." },
      { name: "from_date", type: "text", description: "Startår eller dato når oppgitt." },
      { name: "to_date", type: "text", description: "Sluttår eller dato når oppgitt." },
      { name: "confidence", type: "text", description: "high, medium eller low for resolverens treff." },
      { name: "rule", type: "text", description: "Regelen som løste navn, rolle og år." },
      { name: "source_url", type: "text", description: "Direktelenke til publikasjonen hos kilden." },
      { name: "url", type: "text", description: "Lenke til kildesiden i arkivet." },
    ],
  },
  {
    name: "resolved_lineups",
    summary: "Maskinelt løste lag- og spillerlister med rekkefølge, side og kilde.",
    caveats: [
      "Dette er kandidater uten kamp-ID. De kan være lagoppstillinger, tropper eller spillerrekker.",
      "season er et nærliggende årstall, ikke en bekreftet kampkobling.",
      "Oppgi alltid confidence og kilde, og kall ikke listen en kampoppstilling uten annen dokumentasjon.",
    ],
    columns: [
      { name: "source_id", type: "text", description: "Publikasjonen listen kommer fra." },
      { name: "source_title", type: "text", description: "Lesbar tittel på publikasjonen." },
      { name: "id", type: "text", description: "Deterministisk resolver-ID." },
      { name: "page", type: "text", description: "Sidelabel i publikasjonen." },
      { name: "column_no", type: "integer", description: "Nullbasert spaltenummer når kjent." },
      { name: "season", type: "integer", description: "Nærliggende årstall når siden oppgir et." },
      { name: "names", type: "JSON", description: "Navnene i kildens rekkefølge." },
      { name: "person_ids", type: "JSON", description: "Navn som er avstemt mot personregisteret." },
      { name: "confidence", type: "text", description: "high, medium eller low for resolverens treff." },
      { name: "source_url", type: "text", description: "Direktelenke til publikasjonen hos kilden." },
      { name: "url", type: "text", description: "Lenke til kildesiden i arkivet." },
    ],
  },
];

/** Eksempelspørringer som vises på /data og gis til modellen som mønster. */
export const exampleQueries: { question: string; sql: string }[] = [
  {
    question: "Hvilke kamper har xG-data, og hva var forskjellen?",
    sql: `SELECT date, opponent, aafk_xg, opponent_xg,
       aafk_xg - opponent_xg AS xg_difference, url
FROM matches
WHERE aafk_xg IS NOT NULL AND opponent_xg IS NOT NULL
ORDER BY date DESC`,
  },
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
    question: "Hva er den eldste kampen i arkivet?",
    sql: `SELECT date, opponent, is_home, aafk_score, opponent_score, competition, url
FROM matches
ORDER BY date ASC LIMIT 1`,
  },
  {
    question: "Hvor mange kamper har vi fra hvert tiår?",
    sql: `SELECT substr(date, 1, 3) || '0-tallet' AS tiar, count(*) AS kamper
FROM matches
GROUP BY tiar ORDER BY tiar`,
  },
  {
    question: "Har vi noen gang vunnet en cupkamp på straffer?",
    sql: `SELECT date, opponent, aafk_score, opponent_score, url
FROM matches
WHERE decided_on_penalties = 1 AND won_on_penalties = 1
ORDER BY date DESC`,
  },
  {
    question: "Er det lagt inn noen bidrag eller minner om kamper mot Brann i 1998?",
    sql: `SELECT c.text, c.contributor, c.verification
FROM contributions c
JOIN matches m ON c.target_id = m.match_id
WHERE c.scope = 'match' AND m.opponent = 'SK Brann' AND m.season = 1998`,
  },
  {
    question: "Hvilke medlemsblader har vi fra 1970-tallet?",
    sql: `SELECT title, year, access_url
FROM sources
WHERE source_type = 'member_magazine' AND year BETWEEN 1970 AND 1979
ORDER BY year ASC`,
  },
];

/**
 * Datasettet som markdown, til systemprompten.
 *
 * Holdes stabil mellom kall slik at prompt-cachen faktisk treffer. Dekningen endrer
 * seg bare når arkivet gjør det, altså ved utrulling, så den kan trygt stå her.
 */
export function datasetPrompt(coverage?: DatasetCoverage): string {
  const lines: string[] = [
    "# Datasett: AaFK-arkivet",
    "",
    `SQLite. Datasettversjon ${DATASET_VERSION}.`,
    "Dette er de eneste tabellene som finnes. Interne tabeller med core_-prefiks er ikke tilgjengelige.",
    "",
  ];

  // Dekningen kommer fra databasen når den er lest, ikke fra prosa her.
  // Skrevet av hånd blir slike tall gale ved neste innhøsting, og modellen har
  // ingen måte å oppdage at den blir feilinformert.
  if (coverage) lines.push(coverageMarkdown(coverage), "");

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
