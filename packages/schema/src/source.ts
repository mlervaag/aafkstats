import { z } from "zod";

export const source = z.object({
  id: z.string(),
  parentSourceId: z.string().optional(),
  title: z.string(),
  sourceType: z.enum(["bok", "jubileumsskrift", "medlemsblad", "årsberetning", "kampprogram", "supporterpublikasjon", "lokalhistorisk bok", "avisbilag", "annet"]),
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
