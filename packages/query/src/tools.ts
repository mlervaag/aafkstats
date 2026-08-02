// zod/v4 og ikke klassisk "zod": Anthropic-SDK-ets betaZodTool er typet mot v4, og
// blander vi versjoner her får vi typefeil på hvert eneste verktøy. Datamodellen i
// @aafkstats/schema bruker fortsatt v3 — de to er uavhengige, og zod 3.25 leverer
// begge API-ene fra samme pakke.
import { z } from "zod/v4";
import type { Sql } from "@aafkstats/db";
import { runSafeSql, UnsafeSqlError } from "@aafkstats/db/sql";

/**
 * Verktøyene chatten og MCP-serveren deler.
 *
 * Definert som rene data (navn, beskrivelse, Zod-skjema, handler) i stedet for bundet
 * til ett SDK. Chatten pakker dem i `betaZodTool`, MCP-serveren i `registerTool` — og
 * begge får nøyaktig samme oppførsel, som er hele poenget med å ha ett sted.
 */

export interface ToolContext {
  /** Skrivebeskyttet tilkobling som rollen aafk_chat. */
  readonly sql: Sql;
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

/** Kjører en spørring vi selv har skrevet, gjennom samme guardrails som modellens. */
async function query(ctx: ToolContext, sql: string): Promise<ToolResult> {
  try {
    const r = await runSafeSql(ctx.sql, sql);
    ctx.onQuery?.({ sql, durationMs: r.durationMs, rowCount: r.rowCount, error: undefined });
    return { content: { rows: r.rows, rowCount: r.rowCount, truncated: r.truncated } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.onQuery?.({ sql, durationMs: 0, rowCount: 0, error: message });
    return { content: { error: message }, isError: true };
  }
}

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
    if (input.isHome !== undefined) where.push(`is_home = ${input.isHome}`);
    if (input.result) where.push(`result = ${lit(input.result)}`);
    if (input.minGoalDifference !== undefined) where.push(`goal_difference >= ${input.minGoalDifference}`);
    if (input.maxGoalDifference !== undefined) where.push(`goal_difference <= ${input.maxGoalDifference}`);

    return query(
      ctx,
      `SELECT match_id, date, season, competition, is_home, opponent,
              aafk_score, opponent_score, goal_difference, result, venue, attendance,
              confidence, url
       FROM public_api.matches
       WHERE ${where.join(" AND ")}
       ORDER BY date DESC
       LIMIT ${input.limit}`,
    );
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
      `SELECT * FROM public_api.matches WHERE match_id = ${id}`,
    );
    const events = await query(
      ctx,
      `SELECT minute, stoppage, event_type, team, player, assist
       FROM public_api.match_events WHERE match_id = ${id} ORDER BY minute, stoppage`,
    );
    const report = await query(
      ctx,
      `SELECT summary, body, byline FROM public_api.reports WHERE match_id = ${id}`,
    );
    return { content: { match: match.content, events: events.content, report: report.content } };
  },
});

const getSeasonSummary = defineTool({
  name: "get_season_summary",
  description: "Sammendrag for én sesong: plassering, resultatfordeling og målforskjell.",
  inputSchema: z.object({ season: z.number().int().describe("Sesongår") }),
  async run(input, ctx) {
    return query(ctx, `SELECT * FROM public_api.seasons WHERE season = ${input.season}`);
  },
});

const headToHead = defineTool({
  name: "head_to_head",
  description: "Innbyrdes statistikk mot én motstander gjennom hele historien.",
  inputSchema: z.object({
    opponent: z.string().describe("Motstanderens navn eller ID, delvis treff holder"),
  }),
  async run(input, ctx) {
    const needle = lit(`%${input.opponent.toLowerCase()}%`);
    return query(
      ctx,
      `SELECT * FROM public_api.opponents
       WHERE lower(opponent) LIKE ${needle} OR opponent_club_id LIKE ${needle}
       ORDER BY played DESC LIMIT 10`,
    );
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
    return query(
      ctx,
      `SELECT match_id, date, opponent, is_home, result, summary, url
       FROM public_api.reports
       WHERE search_vector @@ plainto_tsquery('simple', ${lit(input.q)})
       ORDER BY date DESC LIMIT ${input.limit}`,
    );
  },
});

const runSql = defineTool({
  name: "run_sql",
  description:
    "Kjør en SELECT mot public_api-skjemaet. Bruk dette når spørsmålet ikke passer de " +
    "andre verktøyene — aggregeringer, uvanlige kombinasjoner, «hvor mange ganger har …». " +
    "Kun én SELECT-setning. Ingen andre skjemaer er tilgjengelige. Maks 200 rader.",
  inputSchema: z.object({
    sql: z.string().describe("Én SELECT-setning mot public_api"),
    reason: z.string().optional().describe("Kort forklaring på hva spørringen svarer på"),
  }),
  async run(input, ctx) {
    try {
      const r = await runSafeSql(ctx.sql, input.sql);
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
      return { content: { error: hint }, isError: true };
    }
  },
});

export const tools: ToolDef[] = [
  searchMatches,
  getMatch,
  getSeasonSummary,
  headToHead,
  searchReports,
  runSql,
];

export const toolsByName = new Map(tools.map((t) => [t.name, t]));
