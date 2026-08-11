import type { WikipediaProfile } from "./adapters/wikipedia-profile.js";
import { planSourcedPlayerProfile } from "./player-profile.js";
import type { PlayerTarget, ProfilePlan } from "./player-profile.js";

export { resolvePlayerTarget } from "./player-profile.js";
export type { PlayerTarget, ProfilePlan } from "./player-profile.js";

/** Tilpasser Wikipedia-fakta til den felles, konservative personfilplanen. */
export function planWikipediaProfile(target: PlayerTarget, profile: WikipediaProfile): ProfilePlan {
  return planSourcedPlayerProfile(target, {
    providerId: "wikipedia",
    providerName: "Wikipedia",
    name: profile.title.replace(/\s+\([^)]*\)\s*$/, "").trim(),
    url: profile.url,
    retrievedAt: profile.timestamp,
    ...(profile.position ? { position: profile.position } : {}),
    ...(profile.nationality ? { nationality: profile.nationality } : {}),
    ...(profile.wikidata ? { wikidata: profile.wikidata } : {}),
    note: "Fakta fra spillerprofilens infoboks og sideegenskaper. Artikkelteksten er ikke gjengitt.",
  });
}
