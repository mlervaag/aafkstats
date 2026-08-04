import type { ArchiveMatch } from "@/lib/archive";

/**
 * Hvordan et resultat skal leses.
 *
 * Sifferet alene forteller ikke hele historien i cupen. Målene fra ekstraomganger
 * ligger allerede inne i tallet, så «2–1» kan like gjerne være avgjort på
 * overtid som i ordinær tid — og en cupkamp som står «3–3» er ikke uavgjort,
 * den ble avgjort på straffer. Uten merknaden ser arkivet ut til å påstå noe
 * som ikke stemmer.
 */
export interface ReadableScore {
  /** Stillingen skrevet hjemmelag–bortelag, slik resultater leses. */
  score: string;
  /** «e.e.o.» eller «str. 5–6», eller null når kampen gikk til ordinær tid. */
  qualifier: string | null;
  /** Full setning til aria-label og tittelattributt. */
  label: string;
}

export function readableScore(match: ArchiveMatch): ReadableScore {
  // Terminlista står i samme liste som resten. Uten dette skillet ser en kamp som
  // ikke er spilt ut som en kamp vi mangler resultatet for.
  if (match.status === "scheduled") {
    return {
      score: match.kickoff ?? "–",
      qualifier: null,
      label: match.kickoff ? `Ikke spilt, avspark ${match.kickoff}` : "Ikke spilt ennå",
    };
  }
  if (match.aafkScore === null || match.opponentScore === null) {
    return { score: "–", qualifier: null, label: "Resultat ikke registrert" };
  }

  const home = match.isHome ? match.aafkScore : match.opponentScore;
  const away = match.isHome ? match.opponentScore : match.aafkScore;
  const score = `${home}–${away}`;

  if (match.decidedOnPenalties) {
    const outcome = match.wonOnPenalties === null
      ? "avgjort på straffer"
      : match.wonOnPenalties
        ? "AaFK vant på straffer"
        : "AaFK tapte på straffer";
    return {
      score,
      qualifier: "str.",
      label: `${score} etter ekstraomganger, ${outcome}`,
    };
  }

  if (match.afterExtraTime) {
    return { score, qualifier: "e.e.o.", label: `${score} etter ekstraomganger` };
  }

  return { score, qualifier: null, label: score };
}
