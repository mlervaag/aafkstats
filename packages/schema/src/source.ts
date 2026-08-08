import { z } from "zod";

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
  id: z.string(),
  parentSourceId: z.string().optional(),
  title: z.string(),
  sourceType: sourceTypeEnum,
  issue: z.string().optional(),
  volume: z.string().optional(),
  publisher: z.string().optional(),
  year: z.number().int().optional(),
  coverUrl: z.string().url().optional(),
  accessUrl: z.string().url().optional(),
  providers: z.array(
    z.object({
      providerId: z.string(),
      url: z.string().url().optional(),
    }).strict()
  ).optional(),
}).strict();

export type Source = z.infer<typeof source>;
