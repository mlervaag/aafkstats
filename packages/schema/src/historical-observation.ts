import { z } from "zod";
import { slug, sourceRef } from "./primitives.js";

/** Datering med den presisjonen kilden faktisk gir. */
const observationDate = z.string().regex(
  /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/,
  "må være ÅÅÅÅ, ÅÅÅÅ-MM eller ÅÅÅÅ-MM-DD",
);

/** Et kildeført faktum eller en hendelse med relevans for AaFKs historie. */
export const historicalObservation = z.object({
  id: slug,
  title: z.string().min(1),
  text: z.string().min(1),
  date: observationDate.optional(),
  personIds: z.array(slug).default([]),
  seasonYears: z.array(z.number().int().min(1914).max(2100)).default([]),
  matchIds: z.array(slug).default([]),
  competitionIds: z.array(slug).default([]),
  sources: z.array(sourceRef).min(1, "en historisk observasjon trenger minst én kilde"),
  note: z.string().min(1).optional(),
}).strict();

export type HistoricalObservation = z.infer<typeof historicalObservation>;
