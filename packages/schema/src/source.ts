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
