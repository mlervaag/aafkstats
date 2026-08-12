import type { FotmobPlayerProfile } from "./adapters/fotmob-profile.js";
import { planSourcedPlayerProfile } from "./player-profile.js";
import type { PlayerTarget, ProfilePlan } from "./player-profile.js";

/** FotMobs AaFK-periode er kontrollen som knytter valgt ekstern ID til klubben. */
export function planFotmobProfile(
  target: PlayerTarget,
  profile: FotmobPlayerProfile,
  retrievedAt?: string,
): ProfilePlan {
  if (profile.aafkCareer.length === 0) {
    throw new Error(
      `FotMob-profil ${profile.id} viser ingen periode i Aalesund. `
      + "Profilen kan ikke brukes til å bekrefte denne spilleridentiteten.",
    );
  }
  if (!target.existing && !profile.position && !profile.nationality) {
    throw new Error("FotMob-profilen har ingen nye personfakta; oppretter ikke en tom personfil");
  }
  return planSourcedPlayerProfile(target, {
    providerId: "fotmob",
    providerName: "FotMob",
    name: profile.name,
    url: profile.url,
    ...(retrievedAt ? { retrievedAt } : {}),
    ...(profile.position ? { position: profile.position } : {}),
    ...(profile.nationality ? { nationality: profile.nationality } : {}),
    note: "Navn, hovedposisjon og land fra spillerprofilen. Karriereperioden i Aalesund er brukt til identitetskontroll, ikke kopiert som biografi.",
  });
}
