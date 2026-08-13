import { z } from "zod";
import { historicalDate, personRoleCategory } from "./person.js";
import { slug, sourceRef } from "./primitives.js";

export const organization = z.object({
  id: slug,
  name: z.string().min(1),
  organizationNumber: z.string().regex(/^\d{9}$/).optional(),
  kind: z.enum(["club", "company", "stadium"]),
  note: z.string().optional(),
}).strict();

export type Organization = z.infer<typeof organization>;

export const organizationSnapshotPerson = z.object({
  personId: slug,
  observedTitle: z.string().min(1),
  category: personRoleCategory,
  body: z.string().min(1).optional(),
}).strict();

/**
 * Et samtidig øyeblikksbilde av organisasjonen. Datoen dokumenterer bare at
 * personen hadde rollen da; den er aldri en implisitt start- eller sluttdato.
 */
export const organizationSnapshot = z.object({
  date: historicalDate,
  organizationId: slug,
  sources: z.array(sourceRef).min(1),
  people: z.array(organizationSnapshotPerson).min(1),
  note: z.string().optional(),
}).strict();

export type OrganizationSnapshot = z.infer<typeof organizationSnapshot>;

export function organizationSnapshotPath(date: string, organizationId: string): string {
  return `organization/snapshots/${date}-${organizationId}.yaml`;
}
