import type { MatchHypothesis } from "./allocation.js";

export type BatchPolicy =
  | { policy: "automatic" }
  | { policy: "manual"; reviewReason: "sibling_group"; siblingGroupSize: number };

/**
 * Eksplisitte kontrollsaker fra v1-akseptansen.
 *
 * De er sikkerhetsrekkverk, ikke rankingheuristikker. Sarpsborg skal aldri bli
 * auto-datert i v1, mens den live-verifiserte Clausenengen-saken er fast path-
 * kontrollen. Resten følger den generelle hypotesebaserte sibling-regelen.
 */
const CONTROL_POLICY = new Map<string, BatchPolicy>([
  ["medlemsblad-for-aalesunds-fotb-1965-a2c9:1952:16", { policy: "automatic" }],
  ["medlemsblad-for-aalesunds-fotb-1965-a2c9:1948:10", { policy: "manual", reviewReason: "sibling_group", siblingGroupSize: 2 }],
]);

export function batchPolicyFor(hypothesis: MatchHypothesis, siblingGroupSize: number): BatchPolicy {
  const query = hypothesis.queries[0]!;
  const control = CONTROL_POLICY.get(`${query.ref.sourceId}:${query.ref.season}:${query.ref.no}`);
  if (control) return control;
  return siblingGroupSize > 1
    ? { policy: "manual", reviewReason: "sibling_group", siblingGroupSize }
    : { policy: "automatic" };
}
