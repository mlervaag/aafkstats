import { z } from "zod";
import { isoDate } from "./primitives.js";

export const contribution = z
  .object({
    /** Unik ID for bidraget, for eksempel fra et GitHub-saksnummer (gh-1) */
    id: z.string().min(1),
    /** Om bidraget gjelder en spesifikk kamp eller en hel sesong */
    scope: z.enum(["match", "season"]),
    /** Kamp-ID (eks 2009-10-25-aalesunds-fk-lyn) eller årstall (eks 2009) */
    targetId: z.string().min(1),
    /** Kategorisering av bidraget */
    category: z.enum(["memory", "context", "trivia", "event_detail"]),
    /** Selve teksten/innholdet i bidraget */
    text: z.string().min(1),
    /** Hvem som sendte inn bidraget */
    contributor: z.string().min(1).nullable().default(null),
    /** Når bidraget ble sendt inn (YYYY-MM-DD) */
    submittedAt: isoDate,
    /** Hvorvidt bidraget er bekreftet av kilder, delvis bekreftet, eller ubekreftet */
    verification: z.enum(["unverified", "corroborated", "verified"]),
    /** Valgfri lenke til en kilde som bekrefter bidraget */
    sourceUrl: z.string().url().nullable().default(null),
  })
  .strict();

export type Contribution = z.infer<typeof contribution>;
