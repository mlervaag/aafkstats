import { fetchText } from "../http.js";
import { slugify } from "../ids.js";
import { clubKey } from "../reconcile.js";
import type { FetchResult, SourceMatch } from "../types.js";

const BASE = "http://www.rsssf.no";

/**
 * RSSSF Norway — det norske fotballarkivet til RSSSF.
 *
 * Dette er kilden som rekker lenger tilbake enn noen annen vi har funnet: rene
 * tekstsider, én per divisjon per sesong, tilbake til 1902. Der FotMob har et
 * gulv i 2010, dekker denne 1980-tallet og bakover, og den har cupen i alle år.
 *
 * Sidene er skrevet for mennesker, ikke maskiner, men formatet er strengt nok til
 * å kunne leses maskinelt:
 *
 *     Round 1
 *     =======
 *     19/4:   Start - Odd 0-0
 *             Hamarkameratene - Aalesund 3-0
 *     7/5:    Eik-Tønsberg - Strindheim 1-1
 *
 * Datoen står på første kamp og gjelder nedover til neste dato dukker opp. Det er
 * den viktigste detaljen i hele parseren: leses den feil, får en hel runde med
 * kamper samme dato, og feilen er usynlig i ettertid.
 *
 * `robots.txt` stenger `/cgi-bin/` og `/krets/`; arkivsidene er åpne.
 */

/**
 * RSSSF-navn som allerede finnes i arkivet under et annet navn.
 *
 * Kartet er kort og eksplisitt med vilje. Alternativet — å matche navn omtrentlig —
 * ville før eller siden slått sammen to klubber som faktisk er forskjellige, og
 * det er en feil ingen oppdager før noen leser statistikken nøye.
 *
 * At et navn *mangler* her er ufarlig: da opprettes klubben som ny, hvilket er
 * riktig for de mange lavere-divisjonslagene AaFK har møtt i cupen.
 */
export const RSSSF_CLUB_ALIASES: Record<string, string> = {
  // Uten denne blir hjemmelaget vårt en egen klubb, og skjemaet avviser hver
  // eneste kamp fordi ingen av sidene er AaFK.
  Aalesund: "Aalesunds FK",
  "Lyn Oslo": "Lyn",
  "Odd Grenland": "Odds Ballklubb",
  Vålerengen: "Vålerenga",
};

/** Navnet AaFK står oppført med hos RSSSF. */
const AAFK_SOURCE_NAME = "Aalesund";

export type RsssfDivision = "Premier" | "First" | "Cup";

export interface RsssfFetchOptions {
  season: number;
  division: RsssfDivision;
  refresh?: boolean;
  limit?: number;
  onProgress?: (message: string) => void;
}

export async function fetchRsssfSeason(options: RsssfFetchOptions): Promise<FetchResult> {
  let requests = 0;
  const url = `${BASE}/${options.season}/${options.division}.html`;

  let body: string;
  try {
    body = await fetchText(url, {
      refresh: options.refresh,
      onNetworkRequest: () => { requests += 1; },
    });
  } catch (error) {
    return {
      matches: [],
      failures: [{
        scope: "season",
        externalId: `${options.season}-${options.division}`,
        message: error instanceof Error ? error.message : String(error),
      }],
      requests,
    };
  }

  const parsed = parseSeasonPage(body, options.season, options.division);
  options.onProgress?.(
    `${parsed.total} kamper på siden, ${parsed.matches.length} med AaFK`,
  );

  const matches = options.limit === undefined ? parsed.matches : parsed.matches.slice(0, options.limit);
  return { matches, failures: parsed.failures, requests };
}

export interface ParsedPage {
  matches: SourceMatch[];
  failures: FetchResult["failures"];
  /** Alle kamper på siden, ikke bare AaFKs. Brukes til å se at parsingen traff. */
  total: number;
}

/** Én resultatlinje: lagene, sifrene og alt som står etter dem. */
const MATCH_LINE = /^\s*(?:(\d{1,2})\/(\d{1,2}):)?\s*(.+?)\s+-\s+(.+?)\s+(\d+)-(\d+)\s*(.*)$/;
const DATE_ONLY = /^\s*(\d{1,2})\/(\d{1,2}):\s*$/;
const ROUND_HEADING = /^\s*Round\s+(\d+)/i;
const STAGE_HEADINGS: [RegExp, SourceMatch["stage"]][] = [
  [/^\s*Final\b/i, "final"],
  [/^\s*Semi-?finals?\b/i, "semi_final"],
  [/^\s*Quarter-?finals?\b/i, "quarter_final"],
];

/**
 * Cupens tidlige runder heter «First round», ikke «Round 1».
 *
 * De føres som rundenummer og ikke som et stadium, slik at cupdataene herfra
 * ligner cupdataene fra FotMob — der er runde 1 til 4 tall, og først kvartfinalen
 * får et stadium. Uten dette ville samme turnering vært modellert på to måter
 * avhengig av hvilken kilde kampen kom fra.
 */
const ORDINAL_ROUNDS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4,
  fifth: 5, sixth: 6, seventh: 7, eighth: 8,
};
const ORDINAL_ROUND_HEADING = /^\s*(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth)\s+round/i;

export function parseSeasonPage(
  html: string,
  season: number,
  division: RsssfDivision,
): ParsedPage {
  const text = stripMarkup(html);
  const failures: FetchResult["failures"] = [];
  const matches: SourceMatch[] = [];
  let total = 0;

  let currentDate: string | undefined;
  let currentRound: number | undefined;
  let currentStage: SourceMatch["stage"] | undefined;
  const seen = new Set<string>();

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    if (line.trim() === "") continue;

    const round = ROUND_HEADING.exec(line);
    if (round) {
      currentRound = Number(round[1]);
      currentStage = undefined;
      // Runden bytter kontekst, men ikke dato — den kommer på neste kamplinje.
      currentDate = undefined;
      continue;
    }

    const ordinal = ORDINAL_ROUND_HEADING.exec(line);
    if (ordinal && !MATCH_LINE.test(line)) {
      currentRound = ORDINAL_ROUNDS[ordinal[1]!.toLowerCase()];
      currentStage = undefined;
      currentDate = undefined;
      continue;
    }

    const stage = STAGE_HEADINGS.find(([pattern]) => pattern.test(line));
    if (stage && !MATCH_LINE.test(line)) {
      currentStage = stage[1];
      currentRound = undefined;
      currentDate = undefined;
      continue;
    }

    const dateOnly = DATE_ONLY.exec(line);
    if (dateOnly) {
      currentDate = isoDate(season, Number(dateOnly[1]), Number(dateOnly[2]));
      continue;
    }

    const found = MATCH_LINE.exec(line);
    if (!found) continue;

    const [, day, month, homeRaw, awayRaw, homeGoals, awayGoals, tail] = found;
    if (day && month) currentDate = isoDate(season, Number(day), Number(month));

    const home = cleanTeam(homeRaw!);
    const away = cleanTeam(awayRaw!);
    if (home === "" || away === "") continue;
    total += 1;

    if (home !== AAFK_SOURCE_NAME && away !== AAFK_SOURCE_NAME) continue;

    if (!currentDate) {
      failures.push({
        scope: "match",
        externalId: `${season}-${division}-${slugify(home)}-${slugify(away)}`,
        message: `«${home} - ${away}» mangler dato; siden oppgir ingen dato før linja`,
      });
      continue;
    }

    const match = buildMatch({
      season,
      division,
      date: currentDate,
      home,
      away,
      homeGoals: Number(homeGoals),
      awayGoals: Number(awayGoals),
      tail: tail ?? "",
      round: currentRound,
      stage: currentStage,
    });

    // Samme oppgjør kan stå oppført to steder på en side, typisk i både runde- og
    // sammendragsseksjon. Kildens egen ID finnes ikke, så nøkkelen er kampens fakta.
    if (seen.has(match.externalId)) continue;
    seen.add(match.externalId);
    matches.push(match);
  }

  matches.sort((a, b) => a.date.localeCompare(b.date));
  return { matches, failures, total };
}

interface BuildInput {
  season: number;
  division: RsssfDivision;
  date: string;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  tail: string;
  round?: number;
  stage?: SourceMatch["stage"];
}

function buildMatch(input: BuildInput): SourceMatch {
  const { extraTime, shootout, note } = readTail(input.tail);
  const fields = ["date", "status", "competition", "home.clubId", "away.clubId", "home.score", "away.score"];

  // Ingen kilde-ID finnes, så den lages av kampens egne fakta. Den må være stabil
  // mellom kjøringer, ellers lager neste høsting duplikater i stedet for å
  // oppdatere det som allerede ligger der.
  const externalId = [
    input.season,
    input.division.toLowerCase(),
    input.date,
    slugify(alias(input.home)),
    slugify(alias(input.away)),
  ].join("-");

  const match: SourceMatch = {
    externalId,
    date: input.date,
    status: "played",
    // Klubbens kilde-ID må tåle at samme klubb skrives på flere måter. RSSSF
    // veksler mellom «Kristiansund» og «Kristiansund BK»; uten en felles nøkkel
    // får de hver sin ID, og den andre kolliderer med aliaset den første la igjen.
    home: { externalId: clubKey(alias(input.home)), name: alias(input.home) },
    away: { externalId: clubKey(alias(input.away)), name: alias(input.away) },
    homeScore: input.homeGoals,
    awayScore: input.awayGoals,
    competitionExternalId: `${input.division}`,
    competitionName: input.division,
    season: input.season,
    url: `${BASE}/${input.season}/${input.division}.html`,
    fields,
  };

  if (input.round !== undefined) {
    match.round = input.round;
    fields.push("competition.round");
  }
  if (input.stage) {
    match.stage = input.stage;
    fields.push("competition.stage");
  }
  if (extraTime) {
    match.extraTime = { home: 0, away: 0 };
    fields.push("extraTime");
  }
  if (shootout) {
    match.penaltyShootout = shootout;
    fields.push("penaltyShootout");
  }
  if (note) match.note = note;

  return match;
}

/**
 * Tolker halen på en resultatlinje: «aet», «aet, 3-4 on pen.» og «[3-2]».
 *
 * Om ekstraomganger: RSSSF oppgir bare sluttresultatet, aldri stillingen etter 90
 * minutter. Arkivet vil ha ordinær tid i `home.score` og det som kom i tillegg i
 * `extraTime`, men den fordelingen finnes ikke i kilden og skal ikke gjettes.
 *
 * Løsningen er å føre sluttresultatet som scoren og sette `extraTime` til 0-0.
 * Summen blir da riktig, kampen blir korrekt merket som avgjort etter
 * ekstraomganger, og det eneste som er upresist — at scoren egentlig er etter 120
 * og ikke 90 minutter — står skrevet i kampens `note`. Alternativet, å droppe
 * merkingen, ville skjult både opplysningen og upresisheten.
 *
 * Klammeformen `[3-2]` er straffesparkkonkurranse i seriekamp, en norsk ordning på
 * 1980-tallet der uavgjorte kamper ble avgjort for et bonuspoeng.
 */
export function readTail(tail: string): {
  extraTime: boolean;
  shootout?: { home: number; away: number };
  note?: string;
} {
  const cleaned = tail.replace(/\(\*+\)/g, "").trim();
  const extraTime = /\baet\b/i.test(cleaned);

  const penalties = /(\d+)\s*-\s*(\d+)\s*on pen\./i.exec(cleaned) ?? /\[(\d+)\s*-\s*(\d+)\]/.exec(cleaned);
  const shootout = penalties
    ? { home: Number(penalties[1]), away: Number(penalties[2]) }
    : undefined;

  if (!extraTime) return shootout ? { extraTime, shootout } : { extraTime };

  const note =
    "Resultatet er etter ekstraomganger. Kilden oppgir ikke stillingen etter " +
    "ordinær tid, så fordelingen mellom ordinær tid og ekstraomganger er ukjent.";
  return shootout ? { extraTime, shootout, note } : { extraTime, note };
}

/** Slår opp arkivets navn for klubber RSSSF kaller noe annet. */
export function alias(name: string): string {
  return RSSSF_CLUB_ALIASES[name] ?? name;
}

function cleanTeam(raw: string): string {
  return raw
    .replace(/\(\*+\)/g, "")
    .replace(/^\d{1,2}\/\d{1,2}:\s*/, "")
    .trim();
}

function isoDate(season: number, day: number, month: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${season}-${pad(month)}-${pad(day)}`;
}

/**
 * Sidene er HTML rundt en `<pre>`-blokk. Vi vil ha teksten med linjeskiftene
 * intakte, siden hele formatet hviler på hvilken linje noe står på.
 */
export function stripMarkup(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\r\n?/g, "\n");
}
