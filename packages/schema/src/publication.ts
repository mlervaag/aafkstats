import { z } from "zod";

export const publication = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["book", "magazine", "article", "other"]),
  publisher: z.string().optional(),
  year: z.number().int().optional(),
  coverUrl: z.string().url().optional(),
  accessUrl: z.string().url().optional(),
  sources: z.array(
    z.object({
      sourceId: z.string(),
      url: z.string().url().optional(),
    }).strict()
  ).optional(),
}).strict();

export type Publication = z.infer<typeof publication>;
