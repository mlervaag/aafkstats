import { z } from "zod";
import { AAFK_CLUB_ID } from "./entities.js";
import {
  conflict,
  confidence,
  dateConfidence,
  httpUrl,
  isoDate,
  seasonYear,
  slug,
  sourceRef,
  timeOfDay,
} from "./primitives.js";

/** Hvor i konkurransen kampen hører hjemme. */
export const stage = z.enum([
  "regular_season",
  "group",
  "qualifying",
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
  "promotion_playoff",
  "relegation_playoff",
  "friendly",
]);

export const matchStatus = z.enum([
  "scheduled",
  "played",
  "abandoned",
  "awarded",
  "cancelled",
  "postponed",
]);

export type MatchStatus = z.infer<typeof matchStatus>;

export const side = z.enum(["home", "away"]);

export const eventType = z.enum([
  "goal",
  "own_goal",
  "penalty_goal",
  "missed_penalty",
  "yellow_card",
  "second_yellow_card",
  "red_card",
  "substitution",
  "var_decision",
]);

const matchEvent = z
  .object({
    minute: z.number().int().min(0).max(130),
    /** Tilleggstid: 45+2 skrives som minute 45, stoppage 2. */
    stoppage: z.number().int().min(0).max(30).optional(),
    type: eventType,
    team: side,
    player: z.string().optional(),
    assist: z.string().optional(),
    /** Ved innbytte: spilleren som går ut. */
    playerOff: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();

const lineup = z
  .object({
    formation: z.string().optional(),
    starters: z.array(z.string()).default([]),
    subs: z.array(z.string()).default([]),
    coach: z.string().optional(),
  })
  .strict();

const teamStats = z
  .object({
    possession: z.number().min(0).max(100).optional(),
    shots: z.number().int().min(0).optional(),
    shotsOnTarget: z.number().int().min(0).optional(),
    corners: z.number().int().min(0).optional(),
    fouls: z.number().int().min(0).optional(),
    offsides: z.number().int().min(0).optional(),
    xg: z.number().min(0).optional(),
  })
  .strict();

const teamEntry = z
  .object({
    clubId: slug,
    score: z.number().int().min(0).nullable().default(null),
    halfTimeScore: z.number().int().min(0).nullable().default(null),
  })
  .strict();

const scorePair = z
  .object({
    home: z.number().int().min(0).nullable().default(null),
    away: z.number().int().min(0).nullable().default(null),
  })
  .strict();

/**
 * Referat. `body` skal alltid være egenskrevet — aldri kopiert fra avis eller klubbside.
 * Originalen lenkes fra `externalReports` i stedet. Se DATA_LICENSE.md.
 */
const report = z
  .object({
    summary: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    byline: z.string().optional(),
    writtenAt: isoDate.optional(),
  })
  .strict();

const externalReport = z
  .object({
    publisher: z.string().min(1),
    title: z.string().optional(),
    url: httpUrl.optional(),
    date: isoDate.optional(),
    /** Kort, tydelig markert sitat. Ikke gjengivelse av hele teksten. */
    quote: z.string().max(300).optional(),
  })
  .strict();

export const matchCompetition = z
  .object({
    id: slug,
    season: seasonYear,
    stage: stage.default("regular_season"),
    /** Serierunde eller cuprunde. */
    round: z.number().int().positive().optional(),
    /** For tokampsoppgjør: 1 eller 2. */
    leg: z.number().int().min(1).max(2).optional(),
    groupName: z.string().optional(),
  })
  .strict();

/**
 * En kamp. Kun `id`, `date`, `status`, `competition`, `home.clubId` og `away.clubId`
 * er påkrevd — alt annet er valgfritt.
 *
 * Det er et bevisst valg: en kamp fra 1930 der vi bare kjenner dato og motstander skal
 * kunne ligge i arkivet med `confidence: probable` og forbedres senere, i stedet for
 * å holdes utenfor til noen har full oversikt.
 */
export const match = z
  .object({
    id: slug,
    date: isoDate,
    dateConfidence: dateConfidence.default("exact"),
    kickoff: timeOfDay.optional(),
    status: matchStatus,
    competition: matchCompetition,
    home: teamEntry,
    away: teamEntry,
    extraTime: scorePair.optional(),
    penaltyShootout: scorePair.optional(),
    venueId: slug.optional(),
    neutralVenue: z.boolean().default(false),
    attendance: z.number().int().min(0).optional(),
    referee: z.string().optional(),
    events: z.array(matchEvent).default([]),
    lineups: z
      .object({ home: lineup.optional(), away: lineup.optional() })
      .strict()
      .optional(),
    stats: z
      .object({ home: teamStats.optional(), away: teamStats.optional() })
      .strict()
      .optional(),
    report: report.optional(),
    externalReports: z.array(externalReport).default([]),
    sources: z.array(sourceRef).default([]),
    confidence: confidence.default("probable"),
    conflicts: z.array(conflict).default([]),
    tags: z.array(slug).default([]),
    aliases: z.record(z.union([z.string(), z.number()])).default({}),
    /** Felt satt for hånd. Skal aldri overskrives av en scraper. */
    manual: z.array(z.string()).default([]),
    note: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    // ID-en må starte med datoen. Filnavnet er ID-en, så uten dette havner kamper i
    // feil sesongmappe og re-scraping slutter å være idempotent.
    if (!value.id.startsWith(value.date)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["id"],
        message: `ID må starte med kampdatoen (${value.date}), fikk «${value.id}»`,
      });
    }

    // Arkivet handler om AaFK. Nøyaktig én av sidene må være oss — det er invarianten
    // som gjør AaFK-perspektivet i public_api.matches mulig.
    const aafkIsHome = value.home.clubId === AAFK_CLUB_ID;
    const aafkIsAway = value.away.clubId === AAFK_CLUB_ID;
    if (!aafkIsHome && !aafkIsAway) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["home", "clubId"],
        message: `én av lagene må være ${AAFK_CLUB_ID}`,
      });
    }
    if (aafkIsHome && aafkIsAway) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["away", "clubId"],
        message: "AaFK kan ikke spille mot seg selv",
      });
    }

    // En spilt kamp uten resultat er nesten alltid en datafeil. Avbrutte og annullerte
    // kamper er unntaket — der er manglende resultat riktig.
    if (value.status === "played") {
      if (value.home.score === null || value.away.score === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["status"],
          message: "en kamp med status «played» må ha resultat på begge lag",
        });
      }
    }

    // Straffesparkkonkurranse uten uavgjort etter ordinær tid og eventuell ekstraomgang.
    if (value.penaltyShootout && value.home.score !== null && value.away.score !== null) {
      const homeTotal = value.home.score + (value.extraTime?.home ?? 0);
      const awayTotal = value.away.score + (value.extraTime?.away ?? 0);
      if (homeTotal !== awayTotal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["penaltyShootout"],
          message: "straffesparkkonkurranse forutsetter uavgjort etter ordinær tid",
        });
      }
    }

    // «disputed» uten registrert konflikt etterlater ingen spor av hva uenigheten var.
    if (value.confidence === "disputed" && value.conflicts.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["conflicts"],
        message: "confidence «disputed» krever minst én oppføring i conflicts",
      });
    }
  });

export type Match = z.infer<typeof match>;
export type MatchEvent = z.infer<typeof matchEvent>;
