import { AAFK_CLUB_ID } from "./entities.js";
import type { Match } from "./match.js";

export type Result = "S" | "U" | "T";

export interface AafkPerspective {
  isHome: boolean;
  opponentClubId: string;
  aafkScore: number | null;
  opponentScore: number | null;
  goalDifference: number | null;
  result: Result | null;
  /** Sant når kampen gikk til ekstraomganger. Målene er allerede med i aafkScore. */
  afterExtraTime: boolean;
  /** Sant når kampen ble avgjort på straffespark. */
  decidedOnPenalties: boolean;
  /** Ved straffesparkkonkurranse: vant AaFK den? Ellers null. */
  wonOnPenalties: boolean | null;
}

/**
 * Snur en kamp til AaFKs synsvinkel.
 *
 * Dette er det som gjør spørsmål som «når tapte vi sist med 6 mål på hjemmebane?»
 * til en triviell filtrering i stedet for et resonnement om hvilken side vi spilte på.
 * Samme logikk brukes av byggesteget og av testene, så kolonnene i arkivfilen og
 * forventningene i testene aldri kan gli fra hverandre.
 *
 * Merk om straffespark: målforskjell og resultat regnes ut fra ordinær tid pluss
 * ekstraomgang, slik fotballstatistikk normalt gjør. En cupkamp som endte 1–1 og ble
 * avgjort på straffer teller som uavgjort — avansementet leses av `wonOnPenalties`.
 */
export function toAafkPerspective(m: Match): AafkPerspective {
  const isHome = m.home.clubId === AAFK_CLUB_ID;
  const us = isHome ? m.home : m.away;
  const them = isHome ? m.away : m.home;

  const extraUs = isHome ? m.extraTime?.home : m.extraTime?.away;
  const extraThem = isHome ? m.extraTime?.away : m.extraTime?.home;

  const aafkScore = us.score === null ? null : us.score + (extraUs ?? 0);
  const opponentScore = them.score === null ? null : them.score + (extraThem ?? 0);

  const goalDifference =
    aafkScore === null || opponentScore === null ? null : aafkScore - opponentScore;

  let result: Result | null = null;
  if (goalDifference !== null) {
    result = goalDifference > 0 ? "S" : goalDifference < 0 ? "T" : "U";
  }

  // Om kampen gikk til ekstraomganger. Et 2-1 etter ekstraomganger er en annen
  // opplysning enn et 2-1 på ordinær tid, og skillet forsvinner i selve sifferet
  // fordi ekstraomgangsmål er lagt inn i det. Derfor bæres det som eget felt.
  const afterExtraTime = m.extraTime !== undefined;

  const shootout = m.penaltyShootout;
  const decidedOnPenalties =
    shootout !== undefined && shootout.home !== null && shootout.away !== null;

  let wonOnPenalties: boolean | null = null;
  if (decidedOnPenalties && shootout) {
    const ourPens = isHome ? shootout.home : shootout.away;
    const theirPens = isHome ? shootout.away : shootout.home;
    if (ourPens !== null && theirPens !== null) wonOnPenalties = ourPens > theirPens;
  }

  return {
    isHome,
    opponentClubId: them.clubId,
    aafkScore,
    opponentScore,
    goalDifference,
    result,
    afterExtraTime,
    decidedOnPenalties,
    wonOnPenalties,
  };
}

/** Feltene bidragssiden ber om, i prioritert rekkefølge. */
const COMPLETENESS_FIELDS: { key: string; has: (m: Match) => boolean; weight: number }[] = [
  { key: "score", has: (m) => m.home.score !== null && m.away.score !== null, weight: 3 },
  { key: "venue", has: (m) => m.venueId !== undefined, weight: 1 },
  { key: "attendance", has: (m) => m.attendance !== undefined, weight: 1 },
  { key: "referee", has: (m) => m.referee !== undefined, weight: 1 },
  { key: "events", has: (m) => m.events.length > 0, weight: 2 },
  { key: "lineups", has: (m) => m.lineups !== undefined, weight: 2 },
  { key: "report", has: (m) => m.report?.body !== undefined, weight: 2 },
  { key: "providers", has: (m) => m.providers.length > 0, weight: 2 },
];

const COMPLETENESS_TOTAL = COMPLETENESS_FIELDS.reduce((sum, f) => sum + f.weight, 0);

/**
 * Hvor komplett kampen er, 0–1. Driver «kamper som mangler data» på bidragssiden,
 * så bidragsytere kan se hvor innsatsen faktisk trengs.
 */
export function completeness(m: Match): number {
  const score = COMPLETENESS_FIELDS.reduce(
    (sum, f) => sum + (f.has(m) ? f.weight : 0),
    0,
  );
  return Math.round((score / COMPLETENESS_TOTAL) * 100) / 100;
}

/** Hvilke felt som mangler, brukt til å foreslå oppgaver på bidragssiden. */
export function missingFields(m: Match): string[] {
  return COMPLETENESS_FIELDS.filter((f) => !f.has(m)).map((f) => f.key);
}
