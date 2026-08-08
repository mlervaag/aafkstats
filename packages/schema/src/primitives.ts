import { z } from "zod";

/**
 * Slug brukt som ID i filnavn og URL-er: små bokstaver, tall og bindestrek.
 * Norske tegn skrives om ved generering (å → a, ø → o, æ → ae).
 */
export const slug = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "må være en slug: små bokstaver, tall og bindestrek");

/**
 * Dato på formen YYYY-MM-DD.
 *
 * YAML-parseren kan levere en Date for udaterte skalarer avhengig av skjema, så vi
 * tar imot begge og normaliserer til streng. Uten dette blir samme dato representert
 * ulikt avhengig av hvordan filen er skrevet, og diffene blir støyete.
 */
export const isoDate = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "må være på formen YYYY-MM-DD"));

/** Klokkeslett på formen HH:MM (24-timers, lokal tid). */
export const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "må være på formen HH:MM");

/** Sesongår. Arkivet starter ved AaFKs stiftelse i 1914 — tidligere sesonger finnes ikke. */
export const seasonYear = z.number().int().min(1914).max(2100);

/**
 * Stiftelses- eller åpningsår for en klubb eller et stadion.
 *
 * Bevisst videre enn `seasonYear`: motstanderne er eldre enn AaFK (Brann 1908,
 * Molde 1911), og et stadion kan være eldre enn begge.
 */
export const foundingYear = z.number().int().min(1800).max(2100);

/** URL, kun http(s). */
export const httpUrl = z.string().url().refine(
  (u) => u.startsWith("http://") || u.startsWith("https://"),
  "må være en http- eller https-URL",
);

/**
 * Hvor sikre vi er på opplysningene.
 *
 * `probable` er ikke en feil — for kamper før ~1990 er det ofte det beste vi får,
 * og en kamp med `probable` er langt bedre enn ingen kamp. `disputed` betyr at
 * kildene motsier hverandre; se `conflicts` på kampen.
 */
export const confidence = z.enum(["confirmed", "probable", "disputed"]);
export type Confidence = z.infer<typeof confidence>;

/**
 * Hvor presis datoen er. Gamle kamper er noen ganger bare kjent til måned eller år;
 * da settes `date` til første dag i perioden og presisjonen hit.
 */
export const dateConfidence = z.enum(["exact", "month", "year"]);

/** Et navn som gjaldt i en gitt periode. `to: null` betyr «fram til i dag». */
export const historicalName = z
  .object({
    name: z.string().min(1),
    from: isoDate.nullable().default(null),
    to: isoDate.nullable().default(null),
  })
  .strict();

export type HistoricalName = z.infer<typeof historicalName>;

/**
 * Kildehenvisning. `fields` peker på hvilke felt denne kilden dekker, med punktnotasjon
 * (`home.score`, `events`). Det er dette som gjør det mulig å si hvor hver enkelt
 * opplysning kommer fra, ikke bare hvilke kilder som er brukt på kampen som helhet.
 */
export const providerRef = z
  .object({
    providerId: slug,
    url: httpUrl.optional(),
    retrievedAt: isoDate.optional(),
    fields: z.array(z.string().min(1)).default([]),
    note: z.string().optional(),
  })
  .strict();

export type ProviderRef = z.infer<typeof providerRef>;

/**
 * En kjent uenighet mellom kilder. Bevares i stedet for å skjules — for et historisk
 * arkiv er «Sunnmørsposten skriver 3–1, RSSSF skriver 3–2» en opplysning i seg selv.
 */
export const conflict = z
  .object({
    field: z.string().min(1),
    values: z
      .array(
        z
          .object({
            value: z.union([z.string(), z.number(), z.null()]),
            providerId: slug,
            note: z.string().optional(),
          })
          .strict(),
      )
      .min(2, "en konflikt trenger minst to motstridende verdier"),
    resolved: z.boolean().default(false),
    note: z.string().optional(),
  })
  .strict();

export type Conflict = z.infer<typeof conflict>;
