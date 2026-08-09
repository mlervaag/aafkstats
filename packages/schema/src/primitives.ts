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
 * Kildehenvisning til et faktisk historisk dokument (en 'source').
 */
export const sourceRef = z
  .object({
    sourceId: slug,
    page: z.string().optional(),
    fields: z.array(z.string().min(1)).default([]),
    note: z.string().optional(),
  })
  .strict();

export type SourceRef = z.infer<typeof sourceRef>;

/**
 * Hvordan en uenighet ble avgjort.
 *
 * `unresolved` er den vanlige tilstanden, og en helt ærlig en: begge verdiene
 * står, ingen har tatt stilling. De tre andre sier hva som faktisk skjedde.
 * `source_priority` er med fordi valget kan tas på det grunnlaget, men det skjer
 * ikke automatisk, og når det skjer skal det stå at det var grunnlaget.
 */
export const decisionKind = z.enum([
  "unresolved",
  "manual",
  "source_priority",
  "independent_source",
]);

export type DecisionKind = z.infer<typeof decisionKind>;

/**
 * En kjent uenighet mellom kilder. Bevares i stedet for å skjules — for et historisk
 * arkiv er «Sunnmørsposten skriver 3–1, RSSSF skriver 3–2» en opplysning i seg selv.
 *
 * Beslutningsfeltene finnes fordi en løst konflikt uten begrunnelse ikke er
 * løst, den er bare skjult. Står det at arkivet bruker 3–1, skal det også stå
 * hvorfor, hvem som bestemte og når. Uten det kan ingen etterprøve valget, og
 * neste innhøsting har ingen måte å vite at det er tatt.
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
            /**
             * Observasjonen verdien kom fra, som `payloadHash`.
             *
             * Knytter beslutningen til akkurat det kilden sa den gangen. Uten
             * den er en avgjørelse fra i fjor ikke til å skille fra en tatt på
             * en verdi kilden senere har endret, og en rettet adapter gir ingen
             * grunn til å se på valget igjen. Valgfri, fordi observasjoner
             * skrives fra og med innhøstingen som innførte dem: eldre konflikter
             * har ingen å peke på, og en oppdiktet hash ville vært verre enn
             * ingen.
             */
            payloadHash: z.string().regex(/^sha256:[0-9a-f]{64}$/).optional(),
            note: z.string().optional(),
          })
          .strict(),
      )
      .min(2, "en konflikt trenger minst to motstridende verdier"),
    resolved: z.boolean().default(false),
    /** Verdien arkivet bruker. Må være én av verdiene over. */
    chosen: z.union([z.string(), z.number(), z.null()]).optional(),
    /** Kilden den valgte verdien kom fra. */
    chosenProviderId: slug.optional(),
    decision: decisionKind.default("unresolved"),
    decidedAt: isoDate.optional(),
    /** Hvorfor. En løst konflikt uten begrunnelse er ikke etterprøvbar. */
    reason: z.string().optional(),
    /**
     * Lås mot innhøsting.
     *
     * En kontrollert verdi skal ikke overskrives av neste kjøring bare fordi en
     * kilde ble hentet på nytt. Feltet føres samtidig i `manual` på kampen, som
     * er det reconcile faktisk leser; låsen her er begrunnelsen for at det står
     * der.
     */
    locked: z.boolean().default(false),
    note: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const resolved = value.decision !== "unresolved";

    if (resolved && value.chosen === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chosen"],
        message: "en avgjort konflikt må si hvilken verdi arkivet bruker",
      });
    }

    if (resolved && !value.chosenProviderId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chosenProviderId"],
        message: "en avgjort konflikt må si hvilken kilde den valgte verdien kom fra",
      });
    }

    if (resolved && !value.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "en avgjort konflikt må si hvorfor. Uten begrunnelse er den skjult, ikke løst",
      });
    }

    if (resolved && !value.decidedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["decidedAt"],
        message: "en avgjort konflikt må ha en dato",
      });
    }

    // Å velge en verdi ingen kilde har oppgitt er ikke å løse uenigheten, det er
    // å legge til en tredje påstand.
    if (value.chosen !== undefined && !value.values.some((entry) => entry.value === value.chosen)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chosen"],
        message: "den valgte verdien må være én av verdiene kildene faktisk oppgir",
      });
    }


    if (
      value.chosen !== undefined &&
      value.chosenProviderId !== undefined &&
      !value.values.some(
        (entry) => entry.providerId === value.chosenProviderId && entry.value === value.chosen,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chosenProviderId"],
        message: "den valgte kilden må være kilden som oppga den valgte verdien",
      });
    }

    if (value.resolved !== resolved) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resolved"],
        message: "resolved må stemme med decision: «unresolved» betyr ikke løst",
      });
    }
  });

export type Conflict = z.infer<typeof conflict>;
