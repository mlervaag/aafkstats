import { z } from "zod";
import { slug, sourceRef } from "./primitives.js";

/** Datering med den presisjonen kilden faktisk gir. */
const observationDate = z.string().regex(
  /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/,
  "må være ÅÅÅÅ, ÅÅÅÅ-MM eller ÅÅÅÅ-MM-DD",
);

/**
 * Relasjoner som gir observasjonen en side å stå på.
 *
 * `competitionIds` er bevisst ikke med: arkivet har ingen konkurranseside, så en
 * observasjon som bare peker på en konkurranse ville blitt lagret, validert og
 * aldri vist. Kravet under er det som hindrer den stille forsvinningen.
 */
const DISPLAYED_RELATIONS = ["personIds", "seasonYears", "matchIds", "venueIds"] as const;

/** Et kildeført faktum eller en hendelse med relevans for AaFKs historie. */
export const historicalObservation = z.object({
  id: slug,
  title: z.string().min(1),
  text: z.string().min(1),
  date: observationDate.optional(),
  personIds: z.array(slug).default([]),
  // Sesongen må finnes i arkivet, og det kontrolleres i crossValidate. Et
  // årstallsintervall her i tillegg ville vært en annen og svakere sannhet.
  seasonYears: z.array(z.number().int()).default([]),
  matchIds: z.array(slug).default([]),
  competitionIds: z.array(slug).default([]),
  venueIds: z.array(slug).default([]),
  sources: z.array(sourceRef).min(1, "en historisk observasjon trenger minst én kilde"),
  note: z.string().min(1).optional(),
}).strict().superRefine((value, ctx) => {
  if (DISPLAYED_RELATIONS.every((relation) => value[relation].length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["personIds"],
      message: "observasjonen må knyttes til minst én person, sesong, kamp eller bane — ellers finnes den ingen steder på nettstedet",
    });
  }
});

export type HistoricalObservation = z.infer<typeof historicalObservation>;
