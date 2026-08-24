import { z } from "zod";

/**
 * Hvorfor en community-sak er tatt ut av køen. Kategoriene speiler funnene i
 * `auditCommunityCases`, så en pensjonering kan spores tilbake til kontrollen som
 * avdekket avviket.
 */
export const communityCaseRetirement = z.object({
  reason: z.enum(["missing_claim", "stale_snapshot", "already_canonicalized", "impossible_newspaper_date", "editorial"]),
  retiredAt: z.string().date(),
  note: z.string().min(1).max(500),
}).strict();

export type CommunityCaseRetirement = z.infer<typeof communityCaseRetirement>;
