import { z } from "zod";
import { httpUrl, slug } from "./primitives.js";

export const sourceTypeEnum = z.enum([
  "book",
  "anniversary_book",
  "member_magazine",
  "annual_report",
  "match_program",
  "supporter_publication",
  "local_history_book",
  "newspaper_supplement",
  "series",
  "other",
]);

export const source = z.object({
  id: slug,
  parentSourceId: slug.optional(),
  title: z.string().min(1),
  sourceType: sourceTypeEnum,
  issue: z.string().min(1).optional(),
  volume: z.string().min(1).optional(),
  publisher: z.string().min(1).optional(),
  year: z.number().int().min(1800).max(2100).optional(),
  // Bibliografiske opplysninger. Alle er valgfrie: de fleste kildene i arkivet er
  // katalogført av Nasjonalbiblioteket uten forfatter, og et påkrevd felt hadde
  // bare invitert til å finne på en verdi.
  //
  // `urn` er den stabile identifikatoren. `accessUrl` peker i dag på nb.no, men en
  // adresse er en adresse — URN-en er det som fortsatt identifiserer dokumentet når
  // adressen endrer seg, og det er den en annen katalog kan slå opp på.
  urn: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  coverUrl: httpUrl.optional(),
  accessUrl: httpUrl.optional(),
  providers: z.array(
    z.object({
      providerId: slug,
      url: httpUrl.optional(),
    }).strict()
  ).default([]),
}).strict();

export type Source = z.infer<typeof source>;
