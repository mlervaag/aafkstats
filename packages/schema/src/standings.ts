import { z } from "zod";
import { seasonYear, slug, sourceRef } from "./primitives.js";

/**
 * Tabellen ved sesongslutt, og veien dit.
 *
 * ## Hvorfor dette er en egen fil, og ikke felt på sesongen
 *
 * `season.yaml` beskriver AaFKs sesong. Tabellen beskriver divisjonen: hvem som
 * rykket opp, hvem som vant, hvor mange lag som var med. Legges den inn som
 * `finalPosition` alene, mister vi alt som gjør plasseringen leselig — 9. plass
 * av 16 er noe annet enn 9. av 10 — og vi kan ikke svare på hvem AaFK lå bak.
 *
 * ## Hvorfor `progression` ikke er kamper
 *
 * En tabell etter runde 12 krever hver kamp i divisjonen, ikke AaFKs tolv. Å
 * lagre alle ville gjort arkivet til noe annet: ~200 kamper per sesong for lag
 * prosjektet ikke handler om, mot dagens ~26.
 *
 * Vi lagrer derfor det utregnede: hvor laget lå etter hver runde. Tallene regnes
 * ut ved innhøsting fra kildens fulle runderekke, og `sources[]` peker på sida de
 * kom fra. Utregningen kan ikke etterprøves mot arkivet — kampene bak den ligger
 * ikke her — men den kan etterprøves mot kilden, og det er den samme kilden
 * sluttabellen kom fra.
 *
 * Det er en bevisst avveining, ikke en forglemmelse. Står det en dag en grunn til
 * å kjenne andre klubbers kamper, er det den beslutningen som må tas først.
 */

/** En klubbs rad i tabellen. */
export const standingsRow = z
  .object({
    position: z.number().int().min(1),
    /** Klubben i arkivet. Alle lag i divisjonen får en klubbfil, ikke bare AaFKs motstandere. */
    clubId: slug,
    played: z.number().int().min(0),
    wins: z.number().int().min(0),
    draws: z.number().int().min(0),
    losses: z.number().int().min(0),
    goalsFor: z.number().int().min(0),
    goalsAgainst: z.number().int().min(0),
    /**
     * Poeng slik tabellen viser dem.
     *
     * Regnes ikke ut av seire og uavgjorte: poengtrekk finnes (Vålerenga mistet
     * tre i 2001), og to poeng for seier gjaldt til 1987. Kilden vet begge deler.
     */
    points: z.number().int(),
    /** Hva plasseringen førte til. `none` når den ikke førte til noe. */
    outcome: z
      .enum(["promoted", "relegated", "promotion_playoff", "relegation_playoff", "playoff", "none"])
      .default("none"),
    /** Kildens egen merknad bak poengsummen, når den sier mer enn `outcome`. */
    note: z.string().optional(),
  })
  .strict();

export type StandingsRow = z.infer<typeof standingsRow>;

/** Hvor AaFK lå etter én runde. */
export const progressionPoint = z
  .object({
    round: z.number().int().min(1),
    position: z.number().int().min(1),
    points: z.number().int(),
    played: z.number().int().min(0),
    goalDifference: z.number().int(),
  })
  .strict();

export type ProgressionPoint = z.infer<typeof progressionPoint>;

export const standings = z
  .object({
    competitionId: slug,
    season: seasonYear,
    /** Tabellen, sortert på plassering. */
    table: z.array(standingsRow).min(2, "en tabell med under to lag er ikke en tabell"),
    /**
     * AaFKs plassering runde for runde, utregnet. Tom når kilden ikke har
     * runderekka, eller når sesongen ikke er ferdig.
     */
    progression: z.array(progressionPoint).default([]),
    sources: z.array(sourceRef).default([]),
    note: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    // Plasseringene skal være 1..N uten hull. Et hull betyr at parseren har
    // mistet en rad, og en tabell som mangler et lag ser helt normal ut.
    const positions = value.table.map((row) => row.position).sort((a, b) => a - b);
    for (const [index, position] of positions.entries()) {
      if (position !== index + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["table"],
          message: `plasseringene må være 1 til ${positions.length} uten hull, fant ${positions.join(", ")}`,
        });
        break;
      }
    }

    const clubs = new Set<string>();
    for (const row of value.table) {
      if (clubs.has(row.clubId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["table"],
          message: `klubben «${row.clubId}» står to ganger i tabellen`,
        });
      }
      clubs.add(row.clubId);
    }

    for (const point of value.progression) {
      if (point.position > value.table.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["progression"],
          message: `plassering ${point.position} etter runde ${point.round} er utenfor en tabell med ${value.table.length} lag`,
        });
      }
    }
  });

export type Standings = z.infer<typeof standings>;

/** Filstien en tabell får: `standings/<konkurranse>/<år>.yaml`. */
export function standingsPath(competitionId: string, season: number): string {
  return `standings/${competitionId}/${season}.yaml`;
}
