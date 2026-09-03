// zod/v4 og ikke klassisk "zod": Anthropic-SDK-ets betaZodTool er typet mot v4, og
// blander vi versjoner her får vi typefeil på hvert eneste verktøy. Datamodellen i
// @aafkstats/schema bruker fortsatt v3 — de to er uavhengige, og zod 3.25 leverer
// begge API-ene fra samme pakke.
import { z } from "zod/v4";
import { runSafeSql, UnsafeSqlError } from "@aafkstats/db/sql";

/**
 * Verktøyene chatten bruker, og som et senere MCP-grensesnitt kan gjenbruke.
 *
 * Definert som rene data (navn, beskrivelse, Zod-skjema, handler) i stedet for bundet
 * til ett SDK. Chatten pakker dem i `betaZodTool`; et senere MCP-grensesnitt kan
 * registrere de samme definisjonene uten å lage en ny implementasjon.
 */

export interface ToolContext {
  /**
   * Sti til arkivfilen. Utelates den, brukes standardstien.
   *
   * Selve åpningen skjer i child-prosessen som kjører spørringen, med readOnly på —
   * ingen delt tilkobling å komme til fra en forespørselssti ved et uhell.
   */
  readonly dbPath?: string;
  /** Kalles etter hver SQL-kjøring, for logging og bruksmåling. */
  onQuery?: (info: { sql: string; durationMs: number; rowCount: number; error?: string }) => void;
}

export interface ToolResult {
  content: unknown;
  isError?: boolean;
}

export interface ToolDef<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  inputSchema: S;
  run: (input: z.infer<S>, ctx: ToolContext) => Promise<ToolResult>;
}

/**
 * Identitetsfunksjon som bevarer typeutledningen fra Zod-skjemaet.
 *
 * Med en vanlig annotering (`const t: ToolDef = {...}`) vidnes S til basetypen, og
 * `input` blir `unknown` inne i run(). Denne hjelperen låser S til det faktiske
 * skjemaet, så feltnavnene typesjekkes.
 */
function defineTool<S extends z.ZodType>(def: ToolDef<S>): ToolDef<S> {
  return def;
}

/**
 * Feilkodene et eksternt grensesnitt kan forgrene på.
 *
 * En AI-klient som bare får en feilsetning må gjette om den skal prøve igjen, søke
 * bredere eller gi opp. Koden er stabil og maskinlesbar; `message` er for mennesker,
 * og `suggestions` sier hva klienten kan gjøre videre.
 */
export type ToolErrorCode =
  | "MATCH_NOT_FOUND"
  | "PERSON_NOT_FOUND"
  | "SOURCE_NOT_FOUND"
  | "SEASON_NOT_FOUND"
  | "STANDINGS_NOT_FOUND"
  | "VERIFICATION_CASE_NOT_FOUND"
  | "SUBMISSION_NOT_ALLOWED"
  | "SUBMISSION_FAILED"
  | "INVALID_PARAMETERS"
  | "TOOL_NOT_PUBLIC"
  | "RESULT_TOO_LARGE"
  | "QUERY_FAILED";

export interface ToolError {
  code: ToolErrorCode;
  message: string;
  suggestions?: string[];
}

export function toolError(code: ToolErrorCode, message: string, extra: Record<string, unknown> = {}): ToolResult {
  return { content: { error: { code, message, ...extra } satisfies ToolError & Record<string, unknown> }, isError: true };
}

/** Kjører en spørring vi selv har skrevet, gjennom samme guardrails som modellens. */
async function query(ctx: ToolContext, sql: string): Promise<ToolResult> {
  try {
    const r = await runSafeSql(sql, { dbPath: ctx.dbPath });
    ctx.onQuery?.({ sql, durationMs: r.durationMs, rowCount: r.rowCount, error: undefined });
    return { content: { rows: r.rows, rowCount: r.rowCount, truncated: r.truncated } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.onQuery?.({ sql, durationMs: 0, rowCount: 0, error: message });
    return toolError("QUERY_FAILED", message);
  }
}

function resultRows(result: ToolResult): Record<string, unknown>[] {
  const content = result.content as { rows?: Record<string, unknown>[] };
  return content.rows ?? [];
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Et treffutdrag skal vise konteksten rundt ordet, ikke bære et helt referat. */
const MAX_SNIPPET_CHARS = 320;

/** Setter inn en tekstverdi trygt i en spørring vi bygger selv. */
function lit(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

const searchMatches = defineTool({
  name: "search_matches",
  description:
    "Søk i kamper med vanlige filtre. Bruk dette framfor run_sql når spørsmålet passer " +
    "filtrene — det er raskere og gir mer forutsigbare svar.",
  inputSchema: z.object({
    season: z.number().int().optional().describe("Sesongår, f.eks. 2024"),
    seasonFrom: z.number().int().optional().describe("Fra og med sesongår"),
    seasonTo: z.number().int().optional().describe("Til og med sesongår"),
    opponent: z.string().optional().describe("Motstanderens navn eller ID, delvis treff holder"),
    competitionType: z
      .enum(["league", "national_cup", "european", "friendly", "playoff"])
      .optional()
      .describe("Type konkurranse"),
    isHome: z.boolean().optional().describe("true for hjemmekamper, false for bortekamper"),
    result: z.enum(["S", "U", "T"]).optional().describe("S seier, U uavgjort, T tap"),
    minGoalDifference: z.number().int().optional().describe("Minste målforskjell (negativ ved tap)"),
    maxGoalDifference: z.number().int().optional().describe("Største målforskjell"),
    minXg: z.number().min(0).optional().describe("Minste xG for AaFK; kamper uten xG utelates"),
    maxXg: z.number().min(0).optional().describe("Største xG for AaFK; kamper uten xG utelates"),
    hasStats: z.boolean().optional().describe("Filtrer på om kampen har minst ett statistikkfelt"),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  async run(input, ctx) {
    const where: string[] = ["status = 'played'"];
    if (input.season !== undefined) where.push(`season = ${input.season}`);
    if (input.seasonFrom !== undefined) where.push(`season >= ${input.seasonFrom}`);
    if (input.seasonTo !== undefined) where.push(`season <= ${input.seasonTo}`);
    if (input.opponent) {
      const needle = lit(`%${input.opponent.toLowerCase()}%`);
      where.push(`(lower(opponent) LIKE ${needle} OR opponent_club_id LIKE ${needle})`);
    }
    if (input.competitionType) where.push(`competition_type = ${lit(input.competitionType)}`);
    if (input.isHome !== undefined) where.push(`is_home = ${input.isHome ? 1 : 0}`);
    if (input.result) where.push(`result = ${lit(input.result)}`);
    if (input.minGoalDifference !== undefined) where.push(`goal_difference >= ${input.minGoalDifference}`);
    if (input.maxGoalDifference !== undefined) where.push(`goal_difference <= ${input.maxGoalDifference}`);
    if (input.minXg !== undefined) where.push(`aafk_xg >= ${input.minXg}`);
    if (input.maxXg !== undefined) where.push(`aafk_xg <= ${input.maxXg}`);
    if (input.hasStats !== undefined) where.push(`has_stats = ${input.hasStats ? 1 : 0}`);

    return query(
      ctx,
      `SELECT match_id, date, season, competition, is_home, opponent,
              aafk_score, opponent_score, goal_difference, result, venue, attendance,
              has_stats, aafk_possession, opponent_possession,
              aafk_shots, opponent_shots, aafk_shots_on_target, opponent_shots_on_target,
              aafk_corners, opponent_corners, aafk_fouls, opponent_fouls,
              aafk_offsides, opponent_offsides, aafk_xg, opponent_xg,
              confidence, url
       FROM matches
       WHERE ${where.join(" AND ")}
       ORDER BY date DESC
       LIMIT ${input.limit}`,
    );
  },
});

/**
 * Hva `confidence` og `completeness` betyr.
 *
 * Begge tallene beskriver dokumentasjonen, ikke virkeligheten. En modell som ikke får
 * dette sagt eksplisitt leser gjerne 0.79 som «79 prosent sannsynlig at kampen stemmer»,
 * og «probable» som et oddstall. Kontrakten sier det derfor rett ut.
 */
const ARCHIVE_FIELD_POLICY = {
  confidence: {
    meaning:
      "Hvor godt den kanoniske oppføringen er dokumentert i arkivet. Dette er ikke en sannsynlighet for at resultatet er riktig.",
    confirmed: "Kjernefeltene er bekreftet mot minst én kontrollert kilde.",
    probable: "Oppføringen er ikke motsagt, men kjernefeltene er ikke ferdig kontrollert mot kilde.",
    disputed: "Kilder eller leverandører motsier hverandre. Se conflicts før noe omtales som fastslått.",
  },
  completeness: {
    meaning:
      "Andelen av de dokumenterte kampfeltene arkivet faktisk har fylt ut, mellom 0 og 1. Dette er dekningsgrad, ikke sannsynlighet: 0.79 betyr at felt mangler, ikke at kampen er 79 prosent riktig.",
    missingFields: "missing_fields navngir nøyaktig hvilke felt som mangler. Bruk den framfor tallet når du forklarer hva arkivet ikke vet.",
  },
} as const;

const RESULT_EVIDENCE_POLICY = {
  contract: "archive-result-evidence@2",
  fields: ARCHIVE_FIELD_POLICY,
  claimSummary:
    "claim_summary beskriver hvor enige kildene i gruppen er med hverandre, ikke om de har rett. Tre samstemte kilder kan gjengi samme feil, og et felt ingen av kildene oppgir teller som enighet.",
  competition:
    "competition_id er arkivets ID. competition er visningsnavnet og er null når ID-en ikke finnes i konkurranseregisteret.",
  notes:
    "notes er ett element per kildenotat. note er de samme notatene satt sammen til én lesbar tekst. Ikke tilskriv ett notat til alle kildene i gruppen.",
  levels: {
    canonical_match: {
      meaning: "En identifisert kamp i kampmodellen.",
      wording: "Kan omtales som en kamp. Oppgi fortsatt confidence, note og konflikter når feltene krever det.",
    },
    source_claim: {
      meaning: "En historisk kilde oppgir resultatet, men oppgjøret mangler sikker kobling til en kanonisk kamp.",
      wording: "Skriv at kilden oppgir eller dokumenterer resultatet. Forklar relevante missing_fields. Ikke påstå dato, hjemme eller borte, konkurranse eller kampidentitet når feltet mangler.",
    },
  },
  aggregation:
    "Ikke bland source_claim inn i summer over kanoniske kamper. Flere kilder med samme result_group_id er samlet som ett mulig oppgjør, ikke flere kamper.",
} as const;

const HEAD_TO_HEAD_EVIDENCE_POLICY = {
  contract: "archive-head-to-head-evidence@1",
  canonical:
    "played, wins, draws, losses og mål uten prefiks kommer bare fra identifiserte kamper i kampmodellen.",
  unlinked:
    "Feltene med unlinked_ kommer fra ukoblede source_results, gruppert på result_group_id når den finnes. De er kildedokumenterte resultater, ikke sikkert flere kamper enn de kanoniske.",
  aggregation:
    "Ikke legg canonical og unlinked_ sammen til ett totalt kamp-, resultat- eller måltall. Noen ukoblede resultater kan gjelde kamper som allerede finnes uten at koblingen er avklart.",
  identity:
    "Bare source_results med samme opponent_club_id er tatt med. Flere returnerte klubber, som Molde FK og Molde 2, skal holdes helt adskilt.",
  possibleIdentityMatches:
    "Tekstlige treff uten opponent_club_id er mulige identitetstreff. De skal undersøkes, men aldri inngå i played, wins, draws, losses eller mål.",
  identityConfidence:
    "identity_confidence gjelder bare hvor godt motstanderstrengen peker på klubben du spurte om. Den sier ingenting om resultatet er riktig. Et teksttreff når aldri high: high krever avklart opponent_club_id, og da ligger raden i unlinked_-tallene i stedet.",
} as const;

/**
 * Skiller et rent klubbnavn fra en sammensatt streng.
 *
 * «Langevåg—Raufoss», «Molde/Træff» og «Kristiansund og omegn» treffer alle på et
 * klubbsøk, men beskriver sannsynligvis noe annet enn ett oppgjør mot den klubben.
 * De filtreres ikke bort — usikkerheten gjøres bare eksplisitt.
 */
// Komma er bevisst ikke med: «Viking, St.vanger» er ett klubbnavn med stedsangivelse,
// ikke to klubber.
const COMPOSITE_OPPONENT = /[—–/+]|\s-\s|\s(?:og|mot|vs\.?)\s/iu;

function identityMatch(printed: string | null): { identity_confidence: "medium" | "low"; reason: string } {
  if (printed && COMPOSITE_OPPONENT.test(printed)) {
    return {
      identity_confidence: "low",
      reason:
        "Motstanderstrengen er sammensatt og kan beskrive flere klubber, et kretslag eller en annen kamp enn den du spør om. opponent_club_id er ikke avklart.",
    };
  }
  return {
    identity_confidence: "medium",
    reason: "Motstanderstrengen inneholder klubbnavnet du spurte om, men opponent_club_id er ikke avklart.",
  };
}

/**
 * Søker begge resultatlagene i ett kall, slik at rekordspørsmål ikke stopper ved
 * den enkleste tabellen og dermed skjuler eldre, ufullstendige kilderesultater.
 */
const searchAllResults = defineTool({
  name: "search_all_results",
  description:
    "Søk samlet i kanoniske kamper og ukoblede, kildedokumenterte resultater. Bruk alltid " +
    "dette ved rekorder, største seier eller tap, flest mål og spørsmål om hele historien. " +
    "Resultatet merker hver rad som canonical_match eller source_claim og grupperer flere kilder til samme uavklarte oppgjør.",
  inputSchema: z.object({
    season: z.number().int().min(1914).max(2100).optional(),
    seasonFrom: z.number().int().min(1914).max(2100).optional(),
    seasonTo: z.number().int().min(1914).max(2100).optional(),
    opponent: z.string().optional().describe("Motstander, delvis treff holder"),
    opponentClubId: z.string().optional().describe("Eksakt kanonisk klubb-ID når identiteten er avklart"),
    result: z.enum(["S", "U", "T"]).optional().describe("S seier, U uavgjort, T tap"),
    ranking: z
      .enum(["largest_win", "largest_defeat", "most_goals_for", "most_goals_total", "newest", "oldest"])
      .default("newest")
      .describe("Hvordan treffene skal rangeres"),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  async run(input, ctx) {
    const where: string[] = [];
    if (input.season !== undefined) where.push(`season = ${input.season}`);
    if (input.seasonFrom !== undefined) where.push(`season >= ${input.seasonFrom}`);
    if (input.seasonTo !== undefined) where.push(`season <= ${input.seasonTo}`);
    if (input.opponent) where.push(`opponent_search LIKE ${lit(`%${input.opponent.toLowerCase()}%`)}`);
    if (input.opponentClubId) where.push(`opponent_club_id = ${lit(input.opponentClubId)}`);
    if (input.result) where.push(`result = ${lit(input.result)}`);
    if (input.ranking === "largest_win") where.push("result = 'S'");
    if (input.ranking === "largest_defeat") where.push("result = 'T'");

    const orderBy: Record<typeof input.ranking, string> = {
      largest_win: "goal_difference DESC, aafk_score DESC, season ASC",
      largest_defeat: "goal_difference ASC, opponent_score DESC, season ASC",
      most_goals_for: "aafk_score DESC, goal_difference DESC, season ASC",
      most_goals_total: "(aafk_score + opponent_score) DESC, season ASC",
      newest: "coalesce(date, printf('%04d-12-31', season)) DESC, evidence_level ASC",
      oldest: "coalesce(date, printf('%04d-01-01', season)) ASC, evidence_level ASC",
    };

    const result = await query(
      ctx,
      `WITH all_results AS (
         SELECT 'canonical_match' AS evidence_level, match_id AS record_id,
                date, date_confidence AS date_precision, season, opponent, opponent_club_id,
                aafk_score, opponent_score, goal_difference,
                result, competition_id, competition, competition_type, is_home, confidence,
                has_conflicts, match_id, NULL AS result_group_id, note,
                CASE WHEN note IS NULL THEN json('[]') ELSE json_array(note) END AS notes,
                NULL AS claim_summary,
                completeness, missing_fields,
                NULL AS source_count, sources, NULL AS claims, url,
                lower(coalesce(opponent, '') || ' ' || coalesce(opponent_club_id, '')) AS opponent_search
         FROM matches
         WHERE status IN ('played', 'awarded')
         UNION ALL
         SELECT 'source_claim', record_id, date, date_precision, season, opponent,
                opponent_club_id, aafk_score, opponent_score, goal_difference,
                result, competition_id, competition, NULL, NULL, NULL, has_conflicts, NULL,
                result_group_id, note, notes, claim_summary, NULL, missing_fields, source_count,
                sources, claims, url, opponent_search
         FROM result_groups
       )
       SELECT evidence_level, record_id, date, date_precision, season, opponent, opponent_club_id,
              aafk_score, opponent_score, goal_difference, result,
              competition_id, competition, competition_type, is_home, confidence, has_conflicts,
              match_id, result_group_id, note, notes, claim_summary, completeness, missing_fields,
              source_count, sources, claims, url
       FROM all_results
       ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY ${orderBy[input.ranking]}
       LIMIT ${input.limit}`,
    );

    if (result.isError) return result;
    return {
      content: {
        ...(result.content as Record<string, unknown>),
        evidencePolicy: RESULT_EVIDENCE_POLICY,
      },
    };
  },
});

const getMatch = defineTool({
  name: "get_match",
  description: "Hent alle detaljer om én kamp, inkludert hendelser og referat.",
  inputSchema: z.object({
    matchId: z.string().describe("Kampens ID, f.eks. 2024-04-01-aalesunds-fk-raufoss-il"),
  }),
  async run(input, ctx) {
    const id = lit(input.matchId);
    const match = await query(
      ctx,
      `SELECT match_id, date, season, date_confidence, kickoff, status,
              competition, competition_type, competition_tier, stage, round,
              is_home, opponent, opponent_club_id, aafk_score, opponent_score,
              goal_difference, result, after_extra_time, decided_on_penalties,
              won_on_penalties, venue, neutral_venue, attendance, referee,
              has_stats, aafk_possession, opponent_possession,
              aafk_shots, opponent_shots, aafk_shots_on_target, opponent_shots_on_target,
              aafk_corners, opponent_corners, aafk_fouls, opponent_fouls,
              aafk_offsides, opponent_offsides, aafk_xg, opponent_xg,
              report_summary, confidence, has_conflicts, completeness,
              last_retrieved_at, providers, sources, note, tags, url
       FROM matches WHERE match_id = ${id}`,
    );
    const events = await query(
      ctx,
      `SELECT minute, stoppage, event_type, team, player, assist
       FROM match_events WHERE match_id = ${id} ORDER BY minute, stoppage`,
    );
    if (match.isError) return match;
    if (resultRows(match).length === 0) {
      return toolError("MATCH_NOT_FOUND", `Arkivet har ingen kanonisk kamp med ID ${input.matchId}.`, {
        suggestions: [
          "Bruk search_matches eller search_all_results for å finne riktig match_id.",
          "Er oppgjøret bare kildedokumentert, finnes det ikke som kamp. Se search_all_results, der raden ligger som source_claim uten match_id.",
        ],
      });
    }
    const report = await query(
      ctx,
      `SELECT summary, body, byline FROM reports WHERE match_id = ${id}`,
    );
    return {
      content: {
        match: match.content, events: events.content, report: report.content,
        fieldPolicy: ARCHIVE_FIELD_POLICY,
        provenance:
          "providers og sources er proveniens på feltnivå: fields i hver oppføring navngir nøyaktig hvilke felt den kilden eller leverandøren dekker.",
      },
    };
  },
});

const getSeasonSummary = defineTool({
  name: "get_season_summary",
  description:
    "Sammendrag for én sesong. Svaret har competitions med én rad per konkurranse AaFK deltok i, " +
    "og overall som summerer de samme radene. overall.coverage sier om året er ferdig dekket; " +
    "er det ikke det, er summen et minimumstall og ikke sesongens fasit.",
  inputSchema: z.object({ season: z.number().int().describe("Sesongår") }),
  async run(input, ctx) {
    const result = await query(ctx, `SELECT * FROM seasons WHERE season = ${input.season}`);
    if (result.isError) return result;
    const competitions = resultRows(result);
    if (competitions.length === 0) {
      return toolError("SEASON_NOT_FOUND", `Arkivet har ingen kamper for sesongen ${input.season}.`, {
        suggestions: [
          "Sjekk årstallet. get_archive_capabilities oppgir hvilke sesonger arkivet dekker.",
          "Bruk search_all_results med season for å se om sesongen bare finnes som kildedokumenterte resultater uten kanoniske kamper.",
        ],
      });
    }

    const number = (value: unknown) => (typeof value === "number" ? value : 0);
    const sum = (key: string) => competitions.reduce((total, row) => total + number(row[key]), 0);
    // En konkurranse uten fullført dekning gjør årssummen til et minimumstall. Den
    // navngis, slik at et samlet tall aldri leses som sesongens fasit uten videre.
    const incomplete = competitions
      .filter((row) => row.coverage !== "complete" && row.coverage !== "not_applicable")
      .map((row) => row.competition_id);
    const stillScheduled = sum("scheduled");

    return {
      content: {
        season: input.season,
        overall: {
          played: sum("played"), wins: sum("wins"), draws: sum("draws"), losses: sum("losses"),
          goals_for: sum("goals_for"), goals_against: sum("goals_against"),
          goal_difference: sum("goals_for") - sum("goals_against"),
          competitions: competitions.length,
          scheduled: stillScheduled,
          coverage: incomplete.length === 0 && stillScheduled === 0 ? "complete" : "partial",
          incomplete_competitions: incomplete,
          note:
            incomplete.length === 0 && stillScheduled === 0
              ? "Alle konkurransene i sesongen er dekket. Summen er over kanoniske kamper."
              : "Minst én konkurranse er ikke ferdig dekket eller ikke ferdigspilt. Summen er et minimumstall over kanoniske kamper, ikke sesongens fasit.",
        },
        competitions,
        rowCount: competitions.length,
        fieldPolicy: ARCHIVE_FIELD_POLICY,
      },
    };
  },
});

const headToHead = defineTool({
  name: "head_to_head",
  description:
    "Innbyrdes statistikk mot en motstander gjennom hele historien. Returnerer kanoniske " +
    "kampsummer, ukoblede resultater med sikker klubb-ID og mulige teksttreff uten avklart " +
    "klubb-ID som tre separate lag. Bruk alltid " +
    "dette ved spørsmål om alle oppgjør, komplett historikk eller statistikk mot en motstander.",
  inputSchema: z.object({
    opponent: z.string().describe("Motstanderens navn eller ID, delvis treff holder"),
    includeEvidence: z.boolean().default(false).describe("Ta med full metadata for ukoblede kilder. Standard false gir bare antall."),
  }),
  async run(input, ctx) {
    const needle = lit(`%${input.opponent.toLowerCase()}%`);
    const result = await query(
      ctx,
      `WITH claim_variants AS (
         SELECT opponent_club_id, coalesce(result_group_id, claim_id) AS record_id,
                season, aafk_score, opponent_score, result
         FROM source_results
         WHERE match_id IS NULL AND status = 'played' AND opponent_club_id IS NOT NULL
         GROUP BY opponent_club_id, coalesce(result_group_id, claim_id),
                  season, aafk_score, opponent_score, result
       ), claim_groups AS (
         SELECT opponent_club_id, record_id, min(season) AS season,
                count(*) AS variants,
                CASE WHEN count(*) = 1 THEN max(aafk_score) END AS aafk_score,
                CASE WHEN count(*) = 1 THEN max(opponent_score) END AS opponent_score,
                CASE WHEN count(*) = 1 THEN max(result) END AS result
         FROM claim_variants
         GROUP BY opponent_club_id, record_id
       ), claim_stats AS (
         SELECT opponent_club_id,
                count(*) AS unlinked_results,
                sum(CASE WHEN variants = 1 THEN 1 ELSE 0 END) AS unlinked_consistent_results,
                sum(CASE WHEN variants > 1 THEN 1 ELSE 0 END) AS unlinked_disputed_results,
                sum(CASE WHEN variants = 1 AND result = 'S' THEN 1 ELSE 0 END) AS unlinked_wins,
                sum(CASE WHEN variants = 1 AND result = 'U' THEN 1 ELSE 0 END) AS unlinked_draws,
                sum(CASE WHEN variants = 1 AND result = 'T' THEN 1 ELSE 0 END) AS unlinked_losses,
                sum(CASE WHEN variants = 1 THEN aafk_score ELSE 0 END) AS unlinked_goals_for,
                sum(CASE WHEN variants = 1 THEN opponent_score ELSE 0 END) AS unlinked_goals_against,
                min(season) AS unlinked_first_season,
                max(season) AS unlinked_last_season
         FROM claim_groups
         GROUP BY opponent_club_id
       ), distinct_references AS (
         SELECT DISTINCT opponent_club_id, source_id, source_title, source_url, url
         FROM source_results
         WHERE match_id IS NULL AND status = 'played' AND opponent_club_id IS NOT NULL
       ), source_references AS (
         SELECT opponent_club_id,
                json_group_array(json_object(
                  'sourceId', source_id,
                  'title', source_title,
                  'sourceUrl', source_url,
                  'url', url
                )) AS unlinked_source_references
         FROM distinct_references
         GROUP BY opponent_club_id
       )
       SELECT o.*,
              coalesce(s.unlinked_results, 0) AS unlinked_results,
              coalesce(s.unlinked_consistent_results, 0) AS unlinked_consistent_results,
              coalesce(s.unlinked_disputed_results, 0) AS unlinked_disputed_results,
              coalesce(s.unlinked_wins, 0) AS unlinked_wins,
              coalesce(s.unlinked_draws, 0) AS unlinked_draws,
              coalesce(s.unlinked_losses, 0) AS unlinked_losses,
              coalesce(s.unlinked_goals_for, 0) AS unlinked_goals_for,
              coalesce(s.unlinked_goals_against, 0) AS unlinked_goals_against,
              s.unlinked_first_season, s.unlinked_last_season,
              coalesce(r.unlinked_source_references, '[]') AS unlinked_source_references
       FROM opponents o
       LEFT JOIN claim_stats s ON s.opponent_club_id = o.opponent_club_id
       LEFT JOIN source_references r ON r.opponent_club_id = o.opponent_club_id
       WHERE lower(o.opponent) LIKE ${needle} OR o.opponent_club_id LIKE ${needle}
       ORDER BY o.played DESC LIMIT 10`,
    );
    if (result.isError) return result;
    for (const row of resultRows(result)) {
      const references = parseJsonArray(row.unlinked_source_references);
      row.unlinked_source_count = references.length;
      if (!input.includeEvidence) delete row.unlinked_source_references;
    }

    const possible = await query(
      ctx,
      `SELECT coalesce(result_group_id, claim_id) AS record_id,
              min(season) AS season,
              min(opponent COLLATE NOCASE) AS opponent_as_printed,
              CASE WHEN count(DISTINCT printf('%d:%d', aafk_score, opponent_score)) = 1
                   THEN max(aafk_score) END AS aafk_score,
              CASE WHEN count(DISTINCT printf('%d:%d', aafk_score, opponent_score)) = 1
                   THEN max(opponent_score) END AS opponent_score,
              count(DISTINCT source_id) AS source_count,
              json_group_array(json_object(
                'claimId', claim_id,
                'opponentAsPrinted', opponent,
                'sourceId', source_id,
                'title', source_title,
                'page', page,
                'sourceUrl', source_url,
                'url', url
              )) AS claims,
              min(url) AS url
       FROM source_results
       WHERE match_id IS NULL AND status = 'played'
         AND opponent_club_id IS NULL
         AND lower(coalesce(opponent, '')) LIKE ${needle}
       GROUP BY coalesce(result_group_id, claim_id)
       ORDER BY season, record_id
       LIMIT 20`,
    );
    if (possible.isError) return possible;
    const possibleRows = resultRows(possible).map((row) => ({
      ...row,
      match_basis: "text" as const,
      ...identityMatch(typeof row.opponent_as_printed === "string" ? row.opponent_as_printed : null),
    }));
    return {
      content: {
        ...(result.content as Record<string, unknown>),
        possible_identity_matches: possibleRows,
        evidencePolicy: HEAD_TO_HEAD_EVIDENCE_POLICY,
      },
    };
  },
});

const searchReports = defineTool({
  name: "search_reports",
  description: "Fritekstsøk i kampreferatene.",
  inputSchema: z.object({
    q: z.string().min(1).describe("Søkeord"),
    limit: z.number().int().min(1).max(50).default(10),
  }),
  async run(input, ctx) {
    const result = await query(
      ctx,
      // Uten alias på reports: snippet() krever tabellnavnet slik det står i FTS-tabellen.
      `SELECT reports.match_id, reports.date, reports.season,
              m.competition_id, m.competition, reports.opponent, reports.is_home, reports.result,
              nullif(trim(reports.summary), '') AS summary,
              -- Teksten rundt selve treffordet, ikke sammendraget: en klient som skal
              -- vurdere treffet trenger å se hvorfor det traff.
              snippet(reports, 7, '', '', ' … ', 24) AS snippet,
              CASE WHEN lower(coalesce(reports.summary, '')) LIKE ${lit(`%${input.q.toLowerCase()}%`)}
                   THEN 'summary' ELSE 'body' END AS matched_field,
              reports.url
       FROM reports
       LEFT JOIN matches m ON m.match_id = reports.match_id
       WHERE reports MATCH ${lit(input.q)}
       ORDER BY reports.date DESC LIMIT ${input.limit}`,
    );
    if (result.isError) return result;

    // Søkeordene slik FTS leste dem, uten operatorene. Da ser klienten hvilke ord
    // treffet faktisk gjelder når spørringen var sammensatt.
    const terms = [...input.q.matchAll(/[\p{L}\p{N}]{2,}/gu)]
      .map((match) => match[0])
      .filter((term) => !["AND", "OR", "NOT", "NEAR"].includes(term.toUpperCase()));
    const rows = resultRows(result).map((row) => {
      const snippet = typeof row.snippet === "string" ? row.snippet : "";
      return {
        ...row,
        snippet: snippet.length > MAX_SNIPPET_CHARS ? `${snippet.slice(0, MAX_SNIPPET_CHARS).trimEnd()} …` : snippet,
        matched_terms: terms.filter((term) => `${snippet} ${row.summary ?? ""}`.toLowerCase().includes(term.toLowerCase())),
      };
    });
    return { content: { ...(result.content as Record<string, unknown>), rows } };
  },
});

const searchPeople = defineTool({
  name: "search_people",
  description:
    "Søk i personregisteret og kontrollerte roller eller verv. Bruk dette for spillere, " +
    "trenere, styreledere, ansatte, æresmedlemmer og andre personer i AaFK-organisasjonen.",
  inputSchema: z.object({
    q: z.string().optional().describe("Navn, tittel eller organisasjonsdel, delvis treff holder"),
    category: z
      .enum(["player", "coach", "sporting_staff", "board", "administration", "honorary", "founder", "project"])
      .optional(),
    year: z.number().int().min(1914).max(2100).optional().describe("År personen hadde rollen"),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  async run(input, ctx) {
    const where: string[] = [];
    if (input.q) {
      const needle = lit(`%${input.q.toLowerCase()}%`);
      where.push(`(lower(p.name) LIKE ${needle} OR lower(coalesce(r.title, '')) LIKE ${needle} OR lower(coalesce(r.body, '')) LIKE ${needle})`);
    }
    if (input.category) where.push(`r.category = ${lit(input.category)}`);
    if (input.year !== undefined) {
      const year = lit(String(input.year));
      where.push(
        `substr(r.from_date, 1, 4) <= ${year} AND ` +
          `substr(coalesce(r.to_date, r.from_date), 1, 4) >= ${year}`,
      );
    }
    return query(
      ctx,
      `SELECT p.id AS person_id, p.name, p.position, p.nationality, p.has_conflicts,
              r.role_id, 'explicit' AS role_kind, r.category, r.title,
              r.organization_id, r.organization_name, r.body,
              r.from_date, r.to_date, r.sources, r.note, p.url
       FROM people p
       LEFT JOIN person_roles r ON r.person_id = p.id
       ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY coalesce(r.from_date, '9999'), p.name
       LIMIT ${input.limit}`,
    );
  },
});

const getPerson = defineTool({
  name: "get_person",
  description:
    "Hent én publisert person med eksplisitte roller, overganger, konflikter, kildehenvisninger og " +
    "historiske observasjoner. Roller er separate rolleposter og har rolle-ID og organisasjon. " +
    "Overganger er kildeført enkeltvis og er aldri en fullstendig klubbhistorikk.",
  inputSchema: z.object({ personId: z.string().min(1).describe("Kanonisk person-ID") }),
  async run(input, ctx) {
    const id = lit(input.personId);
    const person = await query(
      ctx,
      `SELECT id AS person_id, name, nationality, position, wikidata, sources, note,
              has_conflicts, first_season, last_season, appearances, starts,
              role_count, first_role_year, last_role_year, role_categories, url
       FROM people WHERE id = ${id}`,
    );
    if (person.isError) return person;
    const personRow = resultRows(person)[0];
    if (!personRow) {
      return toolError("PERSON_NOT_FOUND", `Arkivet har ingen publisert person med ID ${input.personId}.`, {
        suggestions: ["Bruk search_people for å finne riktig person_id."],
      });
    }

    const roles = await query(
      ctx,
      `SELECT role_id, 'explicit' AS role_kind, category, title,
              organization_id, organization_name, body, from_date, to_date,
              sources, note, url
       FROM person_roles WHERE person_id = ${id}
       ORDER BY from_date, role_id`,
    );
    const conflicts = await query(
      ctx,
      `SELECT field, provider_id, value, value_note, is_chosen, decision,
              decided_at, reason, locked, conflict_note, url
       FROM person_conflicts WHERE person_id = ${id}
       ORDER BY field, provider_id`,
    );
    const observations = await query(
      ctx,
      `SELECT h.id, h.title, h.text, h.date, h.note, h.sources, h.url
       FROM historical_observations h, json_each(h.person_ids) relation
       WHERE relation.value = ${id}
       ORDER BY coalesce(h.date, '') DESC, h.id`,
    );
    const transfers = await query(
      ctx,
      // providers er med fordi en nettmelding ikke har en kildefil: uten feltet
      // ville en overgang hentet fra en klubbmelding stått helt uten proveniens.
      `SELECT direction, kind, season, date, club, club_id, ${TRANSFER_DOCUMENTED_BY},
              sources, providers, note, url
       FROM transfers WHERE person_id = ${id}
       ORDER BY date, direction`,
    );
    if (roles.isError) return roles;
    if (conflicts.isError) return conflicts;
    if (observations.isError) return observations;
    if (transfers.isError) return transfers;
    return {
      content: {
        person: personRow,
        roles: resultRows(roles),
        // Tom liste betyr at ingen overgang er kildeført, ikke at personen
        // aldri skiftet klubb. Skal ikke leses som en komplett karriere.
        transfers: resultRows(transfers),
        conflicts: resultRows(conflicts),
        observations: resultRows(observations),
        transferPolicy: TRANSFER_EVIDENCE_POLICY,
      },
    };
  },
});

/**
 * Hva en overgangsrad er, og hva den ikke er.
 *
 * Overganger er den eneste delen av arkivet der en tom liste er den vanlige
 * tilstanden: de aller fleste sesongene har ingen kildeført overgang. Uten at
 * kontrakten sier det rett ut, leses et tomt svar som «ingen skiftet klubb»,
 * og en enkelt rad som en fullstendig klubbhistorikk.
 */
const TRANSFER_EVIDENCE_POLICY = {
  contract: "archive-transfer-evidence@1",
  coverage:
    "Dekningen er ujevn og aldri fullstendig. Et år uten rader betyr at ingen kilde er ført inn ennå, ikke at ingen kom eller forsvant. Ikke skriv at en sesong ikke hadde overganger.",
  career:
    "Radene er enkeltstående kildeførte hendelser, ikke en karriere. Overgangene mellom to andre klubber finnes ikke her, og en spiller kan ha rader for én klubbytte og ingen for de neste.",
  scope:
    "Bare personer med egen personfil kan ha overganger. En spiller som bare finnes som et navn i oppstillingene har ingen rad, og det er en manglende fil, ikke en manglende overgang.",
  squad:
    "Ikke summer overganger og stall. transfers sier hvorfor noen kom eller forsvant; squad sier hvem som faktisk var med. En hentet spiller kan aldri ha spilt en kamp.",
  club:
    "club er kildens egen skrivemåte og bevares som den står. club_id er satt bare når klubben finnes i arkivet, og klubbkatalogen inneholder motstandere. NULL betyr uregistrert klubb, ikke ukjent klubb.",
  date:
    "date er datoen kilden oppgir. «Høsten 1950» står som 1950, ikke som en gjettet dag. season kan avvike fra året i date når kilden plasserer en vinterovergang i neste sesong.",
  fee: "Arkivet lagrer ingen overgangssum. Oppgir en kilde et beløp, står det i note sammen med kilden som sa det.",
  documentedBy:
    "documented_by sier hva raden hviler på: source er en historisk publikasjon med sidetall, provider er en nettmelding med adresse og hentetid, both er begge. Ingen rad står uten.",
  kinds: {
    transfer: "Vanlig overgang. Standardverdien, og den som brukes når kilden ikke sier noe annet.",
    loan: "Utlån. Et lån er ikke et salg og skal ikke omtales som det.",
    loan_return: "Retur etter endt lån, ikke en ny overgang.",
    free: "Overgang uten klubbavtale, altså på fri transfer.",
    academy: "Opp fra egen ungdomsavdeling. Bare direction 'in'.",
    released: "Kontrakt utløpt eller hevet uten at kilden oppgir noen ny klubb. Bare 'out', og club er da NULL.",
    retired: "La opp. Bare 'out', og club er da NULL.",
  },
} as const;

/** Om raden hviler på en publikasjon, en nettmelding eller begge. */
const TRANSFER_DOCUMENTED_BY =
  `CASE WHEN json_array_length(sources) > 0 AND json_array_length(providers) > 0 THEN 'both'
        WHEN json_array_length(sources) > 0 THEN 'source'
        ELSE 'provider' END AS documented_by`;

const searchTransfers = defineTool({
  name: "search_transfers",
  description:
    "Søk i kildeførte overganger inn til og ut av AaFK. Bruk dette på spørsmål om hvem som " +
    "ble hentet, hvem som forsvant, hvor en spiller kom fra eller gikk til, og på lån og " +
    "utlån. Bruk ikke stallen til dette: den sier bare hvem som var med, ikke hvorfor. " +
    "Svaret har totals over hele filteret, ikke bare de returnerte radene.",
  inputSchema: z.object({
    season: z.number().int().min(1900).max(2100).optional().describe("Sesongen overgangen føres på"),
    seasonFrom: z.number().int().min(1900).max(2100).optional().describe("Fra og med sesong"),
    seasonTo: z.number().int().min(1900).max(2100).optional().describe("Til og med sesong"),
    direction: z.enum(["in", "out"]).optional().describe("'in' til AaFK, 'out' fra AaFK"),
    kind: z
      .enum(["transfer", "loan", "loan_return", "free", "academy", "released", "retired"])
      .optional()
      .describe("Overgangstype"),
    club: z.string().optional().describe("Den andre klubben, delvis treff på navn eller ID"),
    clubId: z.string().optional().describe("Eksakt klubb-ID når klubben finnes i arkivet"),
    person: z.string().optional().describe("Spillerens navn, delvis treff holder"),
    personId: z.string().optional().describe("Eksakt person-ID"),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  async run(input, ctx) {
    const where: string[] = [];
    if (input.season !== undefined) where.push(`season = ${input.season}`);
    if (input.seasonFrom !== undefined) where.push(`season >= ${input.seasonFrom}`);
    if (input.seasonTo !== undefined) where.push(`season <= ${input.seasonTo}`);
    if (input.direction) where.push(`direction = ${lit(input.direction)}`);
    if (input.kind) where.push(`kind = ${lit(input.kind)}`);
    if (input.club) {
      const needle = lit(`%${input.club.toLowerCase()}%`);
      where.push(`(lower(coalesce(club, '')) LIKE ${needle} OR coalesce(club_id, '') LIKE ${needle})`);
    }
    if (input.clubId) where.push(`club_id = ${lit(input.clubId)}`);
    if (input.person) where.push(`lower(name) LIKE ${lit(`%${input.person.toLowerCase()}%`)}`);
    if (input.personId) where.push(`person_id = ${lit(input.personId)}`);
    const filter = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const result = await query(
      ctx,
      `SELECT person_id, name, direction, kind, season, date, club, club_id,
              ${TRANSFER_DOCUMENTED_BY}, sources, providers, note, url
       FROM transfers
       ${filter}
       ORDER BY season DESC, date DESC, direction, name COLLATE NOCASE
       LIMIT ${input.limit}`,
    );
    if (result.isError) return result;

    // Tellerne kjøres uten limit, slik at «hvor mange kom i 2016» kan besvares
    // uten å hente hver rad. De gjelder filteret, ikke siden som ble returnert.
    const totals = await query(
      ctx,
      `SELECT direction, kind, count(*) AS n, min(season) AS first_season, max(season) AS last_season
       FROM transfers ${filter} GROUP BY direction, kind`,
    );
    if (totals.isError) return totals;

    const number = (value: unknown) => (typeof value === "number" ? value : 0);
    const totalRows = resultRows(totals);
    const byKind: Record<string, number> = {};
    for (const row of totalRows) byKind[String(row.kind)] = (byKind[String(row.kind)] ?? 0) + number(row.n);
    const seasons = totalRows.flatMap((row) => [row.first_season, row.last_season]).filter((value): value is number => typeof value === "number");

    return {
      content: {
        ...(result.content as Record<string, unknown>),
        totals: {
          matched: totalRows.reduce((sum, row) => sum + number(row.n), 0),
          in: totalRows.filter((row) => row.direction === "in").reduce((sum, row) => sum + number(row.n), 0),
          out: totalRows.filter((row) => row.direction === "out").reduce((sum, row) => sum + number(row.n), 0),
          byKind,
          firstSeason: seasons.length > 0 ? Math.min(...seasons) : null,
          lastSeason: seasons.length > 0 ? Math.max(...seasons) : null,
          note: "Tellerne gjelder hele filteret, ikke bare radene i rows. De teller kildeførte overganger, ikke alle overganger som fant sted.",
        },
        evidencePolicy: TRANSFER_EVIDENCE_POLICY,
      },
    };
  },
});

const SQUAD_EVIDENCE_POLICY = {
  contract: "archive-squad@1",
  players:
    "Stallen er utledet av lagoppstillingene, som arkivet har fra 2010. En eldre sesong har ingen spillere her, og det er en manglende kilde, ikke en tom tropp.",
  appearances:
    "appearances teller kamper spilleren sto i den oppsatte troppen, ikke spilletid. Benken er med, fordi kilden ikke skiller. Bruk starts når spørsmålet gjelder hvem som spilte.",
  goals: "goals telles fra hendelseslista. En kamp uten registrerte hendelser gir null mål for alle som spilte den.",
  transfers:
    "transfers er kildeførte overganger i samme sesong. De er ikke en fasit over hvem som kom og gikk, og et tomt felt betyr at ingen kilde er ført inn.",
  coaches:
    "derived er trenerperioder utledet av hvem som står oppført på kampene, og er den nøyaktige for 2010 og senere. declared er perioder en kilde oppgir, som regel bare med årstall. De to erstatter ikke hverandre og skal ikke summeres.",
} as const;

const getSquad = defineTool({
  name: "get_squad",
  description:
    "Hent stallen for én sesong: hvem som var med, med kamper, starter og mål, sammen med " +
    "sesongens kildeførte overganger og hvem som var trener. Bruk dette på spørsmål om " +
    "hvem som spilte for AaFK et gitt år.",
  inputSchema: z.object({
    season: z.number().int().min(1900).max(2100).describe("Sesongår"),
    limit: z.number().int().min(1).max(100).default(60).describe("Maks antall spillere"),
  }),
  async run(input, ctx) {
    const season = input.season;
    const players = await query(
      ctx,
      `SELECT person_key, person_id, name, number, position, nationality, wikidata,
              appearances, starts, goals, first_match, last_match
       FROM squad WHERE season = ${season}
       ORDER BY appearances DESC, starts DESC, name COLLATE NOCASE
       LIMIT ${input.limit}`,
    );
    if (players.isError) return players;

    const transfers = await query(
      ctx,
      `SELECT person_id, name, direction, kind, date, club, club_id,
              ${TRANSFER_DOCUMENTED_BY}, note, url
       FROM transfers WHERE season = ${season}
       ORDER BY direction, date, name COLLATE NOCASE`,
    );
    if (transfers.isError) return transfers;

    const derivedCoaches = await query(
      ctx,
      `SELECT person_key, name, from_date, to_date, from_season, to_season, matches
       FROM coach_spells WHERE from_season <= ${season} AND to_season >= ${season}
       ORDER BY from_date`,
    );
    if (derivedCoaches.isError) return derivedCoaches;

    const declaredCoaches = await query(
      ctx,
      `SELECT person_id, name, from_season, to_season, from_date, to_date
       FROM declared_coach_spells
       WHERE from_season <= ${season} AND coalesce(to_season, ${season}) >= ${season}
       ORDER BY from_season`,
    );
    if (declaredCoaches.isError) return declaredCoaches;

    const playerRows = resultRows(players);
    const transferRows = resultRows(transfers);
    const derivedRows = resultRows(derivedCoaches);
    const declaredRows = resultRows(declaredCoaches);

    // Sesongen finnes bare dersom arkivet vet noe om den i det hele tatt. Uten
    // denne sjekken svarer et årstall utenfor arkivet med en tom, troverdig stall.
    if (playerRows.length === 0 && transferRows.length === 0 && derivedRows.length === 0 && declaredRows.length === 0) {
      const known = await query(ctx, `SELECT count(*) AS n FROM matches WHERE season = ${season}`);
      if (known.isError) return known;
      if (Number(resultRows(known)[0]?.n ?? 0) === 0) {
        return toolError("SEASON_NOT_FOUND", `Arkivet har ingenting registrert for sesongen ${season}.`, {
          suggestions: [
            "Sjekk årstallet. get_archive_capabilities oppgir hvilke sesonger arkivet dekker.",
            "Lagoppstillingene starter i 2010. Eldre sesonger har kamper, men ingen stall.",
          ],
        });
      }
    }

    return {
      content: {
        season,
        players: playerRows,
        playerCount: playerRows.length,
        transfers: {
          in: transferRows.filter((row) => row.direction === "in"),
          out: transferRows.filter((row) => row.direction === "out"),
        },
        coaches: { derived: derivedRows, declared: declaredRows },
        coverage: {
          lineups: playerRows.length > 0 ? "present" : "missing",
          note:
            playerRows.length > 0
              ? "Stallen er hentet fra lagoppstillingene i sesongens kamper."
              : "Arkivet har ingen lagoppstillinger for denne sesongen. Oppstillingene starter i 2010, og en tom stall er en manglende kilde, ikke en tom tropp.",
        },
        evidencePolicy: SQUAD_EVIDENCE_POLICY,
        transferPolicy: TRANSFER_EVIDENCE_POLICY,
      },
    };
  },
});

const STANDINGS_POLICY = {
  contract: "archive-standings@1",
  scope: "Bare seriesesonger, og bare de årene arkivet har tabell for. Cupen har ingen tabell.",
  points: "points er tallet tabellen viser, ikke wins*3+draws. Poengtrekk finnes, og to poeng for seier gjaldt til 1987.",
  matches: "Tabellen dekker bare seriekampene. Cupkamper samme år ligger i kampmodellen og er ikke med her.",
  team: "team er kildens eget lagnavn. club_id er satt bare for lagene arkivet kjenner fra før, siden AaFK ikke har møtt alle lagene i divisjonen.",
  progression:
    "progression er AaFKs egen plassering etter hver runde, regnet ut ved innhøsting. Bare sesonger der utregningen lander på nøyaktig samme rad som kildens trykte tabell er med, og de andre lagenes vei gjennom sesongen finnes ikke.",
} as const;

const getStandings = defineTool({
  name: "get_standings",
  description:
    "Hent sluttabellen for en seriesesong, med AaFKs egen rad løftet fram og valgfritt " +
    "plasseringen etter hver runde. Bruk dette på spørsmål om hvor AaFK endte, hvem som " +
    "vant divisjonen, opprykk og nedrykk.",
  inputSchema: z.object({
    season: z.number().int().min(1900).max(2100).describe("Sesongår"),
    competitionId: z.string().optional().describe("Konkurransens ID når sesongen har flere tabeller"),
    includeProgression: z.boolean().default(false).describe("Ta med AaFKs plassering etter hver runde"),
  }),
  async run(input, ctx) {
    const where = [`season = ${input.season}`];
    if (input.competitionId) where.push(`competition_id = ${lit(input.competitionId)}`);
    const result = await query(
      ctx,
      `SELECT competition_id, competition, season, position, team, club_id,
              played, wins, draws, losses, goals_for, goals_against, goal_difference,
              points, outcome, note, sources, url
       FROM standings WHERE ${where.join(" AND ")}
       ORDER BY competition_id, position`,
    );
    if (result.isError) return result;
    const rows = resultRows(result);
    if (rows.length === 0) {
      return toolError(
        "STANDINGS_NOT_FOUND",
        input.competitionId
          ? `Arkivet har ingen tabell for ${input.competitionId} i ${input.season}.`
          : `Arkivet har ingen serietabell for ${input.season}.`,
        {
          suggestions: [
            "Tabellene er innhøstet per sesong, og et år uten tabell er en manglende kilde, ikke en sesong uten serie.",
            "Bruk get_season_summary for kampene i sesongen. De finnes uavhengig av tabellen.",
          ],
        },
      );
    }

    const competitionIds = [...new Set(rows.map((row) => String(row.competition_id)))];
    const progression = input.includeProgression
      ? await query(
          ctx,
          `SELECT competition_id, round, position, points, played, goal_difference
           FROM standings_progression
           WHERE season = ${input.season}
             AND competition_id IN (${competitionIds.map((id) => lit(id)).join(", ")})
           ORDER BY competition_id, round`,
        )
      : null;
    if (progression?.isError) return progression;
    const progressionRows = progression ? resultRows(progression) : [];

    return {
      content: {
        season: input.season,
        tables: competitionIds.map((competitionId) => {
          const table = rows.filter((row) => row.competition_id === competitionId);
          return {
            competition_id: competitionId,
            competition: table[0]?.competition ?? null,
            teams: table.length,
            // Egen rad løftes fram: et spørsmål om sesongen handler nesten
            // alltid om AaFK, og da skal ikke klienten lete i tabellen selv.
            aafk: table.find((row) => row.club_id === "aalesunds-fk") ?? null,
            table,
            ...(input.includeProgression
              ? { progression: progressionRows.filter((row) => row.competition_id === competitionId) }
              : {}),
          };
        }),
        evidencePolicy: STANDINGS_POLICY,
      },
    };
  },
});

const searchSources = defineTool({
  name: "search_sources",
  description:
    "Søk i den publiserte kildekatalogen etter tittel, forfatter, utgiver, type eller år. " +
    "Dette søker i kildemetadata, ikke i beskyttet OCR eller fulltekst.",
  inputSchema: z.object({
    q: z.string().optional().describe("Tittel, forfatter, utgiver eller beskrivelse"),
    type: z.string().optional().describe("Kildetype, for eksempel book eller member_magazine"),
    year: z.number().int().min(1800).max(2100).optional(),
    yearFrom: z.number().int().min(1800).max(2100).optional(),
    yearTo: z.number().int().min(1800).max(2100).optional(),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  async run(input, ctx) {
    const where: string[] = [];
    if (input.q) {
      const needle = lit(`%${input.q.toLowerCase()}%`);
      where.push(`(lower(title) LIKE ${needle} OR lower(coalesce(author, '')) LIKE ${needle} OR lower(coalesce(publisher, '')) LIKE ${needle} OR lower(coalesce(description, '')) LIKE ${needle})`);
    }
    if (input.type) where.push(`source_type = ${lit(input.type)}`);
    if (input.year !== undefined) where.push(`year = ${input.year}`);
    if (input.yearFrom !== undefined) where.push(`year >= ${input.yearFrom}`);
    if (input.yearTo !== undefined) where.push(`year <= ${input.yearTo}`);
    return query(
      ctx,
      `SELECT id AS source_id, parent_source_id, title, source_type, issue, volume,
              publisher, year, urn, author, description, cover_url, access_url, url
       FROM sources
       ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY coalesce(year, 0) DESC, title COLLATE NOCASE
       LIMIT ${input.limit}`,
    );
  },
});

const getSource = defineTool({
  name: "get_source",
  description:
    "Hent metadata, bruksteller og et avgrenset utvalg resultatpåstander for én publisert kilde. " +
    "Rå OCR og beskyttet fulltekst returneres aldri.",
  inputSchema: z.object({
    sourceId: z.string().min(1).describe("Kildens ID"),
    claimLimit: z.number().int().min(0).max(50).default(10),
  }),
  async run(input, ctx) {
    const id = lit(input.sourceId);
    const source = await query(ctx, `SELECT * FROM sources WHERE id = ${id}`);
    if (source.isError) return source;
    const sourceRow = resultRows(source)[0];
    if (!sourceRow) {
      return toolError("SOURCE_NOT_FOUND", `Arkivet har ingen publisert kilde med ID ${input.sourceId}.`, {
        suggestions: ["Bruk search_sources for å finne riktig source_id."],
      });
    }

    const usage = await query(
      ctx,
      `SELECT
         (SELECT count(DISTINCT m.match_id)
            FROM matches m, json_each(m.sources) ref
           WHERE json_extract(ref.value, '$.sourceId') = ${id}) AS canonical_matches,
         (SELECT count(*) FROM source_results WHERE source_id = ${id}) AS result_claims,
         (SELECT count(DISTINCT r.person_id)
            FROM person_roles r, json_each(r.sources) ref
           WHERE json_extract(ref.value, '$.sourceId') = ${id}) AS person_roles,
         (SELECT count(DISTINCT h.id)
            FROM historical_observations h, json_each(h.sources) ref
           WHERE json_extract(ref.value, '$.sourceId') = ${id}) AS observations`,
    );
    const claims = input.claimLimit === 0
      ? { content: { rows: [] } }
      : await query(
          ctx,
          `SELECT claim_id, season, date, opponent, opponent_club_id,
                  aafk_score, opponent_score, result, competition_id,
                  result_group_id, match_id, page, note, source_url, url
           FROM source_results WHERE source_id = ${id}
           ORDER BY season, source_order
           LIMIT ${input.claimLimit}`,
        );
    if (usage.isError) return usage;
    if ("isError" in claims && claims.isError) return claims;
    return {
      content: {
        source: sourceRow,
        usage: resultRows(usage)[0] ?? {},
        resultClaims: resultRows(claims as ToolResult),
      },
    };
  },
});

const searchHistoricalResults = defineTool({
  name: "search_historical_results",
  description:
    "Søk i resultatlister fra historiske publikasjoner når kampdato, hjemme eller borte " +
    "eller full kampkobling mangler.",
  inputSchema: z.object({
    season: z.number().int().min(1914).max(2100).optional(),
    opponent: z.string().optional().describe("Motstander, delvis treff holder"),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  async run(input, ctx) {
    const where: string[] = [];
    if (input.season !== undefined) where.push(`season = ${input.season}`);
    if (input.opponent) where.push(`lower(coalesce(opponent, '')) LIKE ${lit(`%${input.opponent.toLowerCase()}%`)}`);
    return query(
      ctx,
      `SELECT claim_id, source_id, source_title, season, source_order, page, date,
              opponent, opponent_club_id, aafk_score, opponent_score, result,
              competition_id, status, replay, after_extra_time, round,
              result_group_id, match_id, note, source_url, url
       FROM source_results
       ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY season DESC, source_order
       LIMIT ${input.limit}`,
    );
  },
});

const searchResolvedRoles = defineTool({
  name: "search_resolved_roles",
  description:
    "Søk i maskinelt løste rollekandidater som ennå ikke nødvendigvis er kontrollert. " +
    "Returnerer sikkerhet, publikasjon og side som alltid må oppgis i svaret.",
  inputSchema: z.object({
    q: z.string().optional().describe("Personnavn, tittel eller organisasjonsdel"),
    year: z.number().int().min(1914).max(2100).optional(),
    confidence: z.enum(["high", "medium", "low"]).optional(),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  async run(input, ctx) {
    const where: string[] = [];
    if (input.q) {
      const needle = lit(`%${input.q.toLowerCase()}%`);
      where.push(`(lower(person_name) LIKE ${needle} OR lower(title) LIKE ${needle} OR lower(coalesce(body, '')) LIKE ${needle})`);
    }
    if (input.year !== undefined) {
      const year = lit(String(input.year));
      where.push(
        `substr(from_date, 1, 4) <= ${year} AND ` +
          `substr(coalesce(to_date, from_date), 1, 4) >= ${year}`,
      );
    }
    if (input.confidence) where.push(`confidence = ${lit(input.confidence)}`);
    return query(
      ctx,
      `SELECT source_id, source_title, page, person_name, person_id, category,
              title, body, from_date, to_date, confidence, rule, source_url, url
       FROM resolved_roles
       ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY CASE confidence WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                from_date, person_name
       LIMIT ${input.limit}`,
    );
  },
});

const searchResolvedLineups = defineTool({
  name: "search_resolved_lineups",
  description:
    "Søk i maskinelt løste lag- og spillerlister uten sikker kampkobling. Resultatet " +
    "må omtales som kandidat og med sikkerhet, publikasjon og side.",
  inputSchema: z.object({
    name: z.string().optional().describe("Spillernavn, delvis treff holder"),
    season: z.number().int().min(1900).max(2100).optional(),
    confidence: z.enum(["high", "medium", "low"]).optional(),
    limit: z.number().int().min(1).max(50).default(10),
  }),
  async run(input, ctx) {
    const where: string[] = [];
    if (input.name) where.push(`lower(names) LIKE ${lit(`%${input.name.toLowerCase()}%`)}`);
    if (input.season !== undefined) where.push(`season = ${input.season}`);
    if (input.confidence) where.push(`confidence = ${lit(input.confidence)}`);
    return query(
      ctx,
      `SELECT source_id, source_title, page, season, names, person_ids,
              confidence, source_url, url
       FROM resolved_lineups
       ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY CASE confidence WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                season, source_id, CAST(page AS INTEGER)
       LIMIT ${input.limit}`,
    );
  },
});

const runSql = defineTool({
  name: "run_sql",
  description:
    "Kjør en SELECT mot arkivet. Bruk dette når spørsmålet ikke passer de " +
    "andre verktøyene — aggregeringer, uvanlige kombinasjoner, «hvor mange ganger har …». " +
    "Kun én SELECT-setning. Interne core_-tabeller er ikke tilgjengelige. Maks 200 rader.",
  inputSchema: z.object({
    sql: z.string().describe("Én SELECT-setning mot arkivets tabeller"),
    reason: z.string().optional().describe("Kort forklaring på hva spørringen svarer på"),
  }),
  async run(input, ctx) {
    try {
      const r = await runSafeSql(input.sql, { dbPath: ctx.dbPath });
      ctx.onQuery?.({ sql: input.sql, durationMs: r.durationMs, rowCount: r.rowCount });
      return {
        content: {
          rows: r.rows,
          rowCount: r.rowCount,
          truncated: r.truncated,
          // Sendes tilbake så grensesnittet kan vise nøyaktig hva som ble kjørt.
          executedSql: r.executedSql,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.onQuery?.({ sql: input.sql, durationMs: 0, rowCount: 0, error: message });
      // Feilmeldingen er skrevet for å leses av modellen, så den kan rette opp og
      // prøve igjen i stedet for å gi opp.
      const hint =
        err instanceof UnsafeSqlError
          ? message
          : `Spørringen feilet: ${message}. Sjekk kolonnenavn mot datasettdokumentasjonen.`;
      return toolError("QUERY_FAILED", hint);
    }
  },
});

export const tools: ToolDef[] = [
  searchMatches,
  searchAllResults,
  getMatch,
  getSeasonSummary,
  headToHead,
  searchReports,
  searchPeople,
  getPerson,
  searchTransfers,
  getSquad,
  getStandings,
  searchSources,
  getSource,
  searchHistoricalResults,
  searchResolvedRoles,
  searchResolvedLineups,
  runSql,
];

export const toolsByName = new Map(tools.map((t) => [t.name, t]));
