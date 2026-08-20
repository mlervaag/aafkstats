import { resolveMatchDate } from "./date-inference.js";
import type { DateConfidence } from "./date-inference.js";
import type { NewspaperEvidence } from "./evidence.js";

/**
 * Avisutgaver samlet til kamphendelser.
 *
 * ## Hvorfor utgaver ikke er hendelser
 *
 * En kamp legger igjen spor i flere utgaver:
 *
 *     15. juni  forhåndsomtale, «i morgen»
 *     16. juni  kampdagen, «kveldens kamp»
 *     17. juni  referatet, «i går»
 *
 * Behandler man dem som tre konkurrerende kandidater, konkurrerer de om å bli
 * *den* utgaven — og de tre svekker hverandre i stedet for å styrke det samme
 * funnet. Slått sammen peker de på én dato med tredobbelt belegg, og det er den
 * hendelsen som hører hjemme på høyresiden i fordelingen.
 *
 * ## Hvordan de samles
 *
 * På den datoen tidsuttrykkene peker mot, ikke på utgivelsesdatoen. Utgaver uten
 * tidsuttrykk knyttes til en hendelse de ligger tett nok på i tid til å kunne
 * handle om — og står de alene, blir de sin egen hendelse uten dato. En hendelse
 * uten dato kan fortsatt tildeles en kamp, den kan bare ikke datere den.
 *
 * Tidsmessig kausalitet:
 * Et avisavsnitt med et ferdigspilt kampresultat kan aldri knyttes til en kamp
 * som ble spilt etter avisens utgivelsesdato (f.eks. kan en avis fra 1. juni aldri
 * inneholde sluttresultatet fra en kamp spilt 3. juni).
 */

export interface NewspaperEvent {
  id: string;
  inferredDate?: string;
  dateConfidence?: DateConfidence;
  /** Utgavene som til sammen utgjør hendelsen. */
  evidence: NewspaperEvidence[];
  /** Sterkeste enkeltbevis, pluss et tillegg for uavhengig støtte. */
  score: number;
}

/** Dager en utgave uten tidsuttrykk kan ligge fra kampen og likevel handle om den. */
const NEARBY_DAYS = 3;

export function clusterEvidence(evidence: NewspaperEvidence[]): NewspaperEvent[] {
  const dated = evidence.filter((item) => item.temporal !== undefined);
  const undated = evidence.filter((item) => item.temporal === undefined);

  const byDate = new Map<string, NewspaperEvidence[]>();
  for (const item of dated) {
    const date = item.temporal!.inferredMatchDate;
    byDate.set(date, [...(byDate.get(date) ?? []), item]);
  }

  const events: NewspaperEvent[] = [...byDate].map(([date, members]) => {
    const resolved = resolveMatchDate(members.map((item) => ({ temporal: item.temporal!, weight: item.score })));
    return {
      id: `event:${date}`,
      inferredDate: date,
      ...(resolved ? { dateConfidence: resolved.confidence } : {}),
      evidence: [...members],
      score: 0,
    };
  });

  for (const item of undated) {
    if (item.issueDate === undefined) {
      events.push({ id: `issue:${item.issueId}`, evidence: [item], score: 0 });
      continue;
    }

    const hasScoreResult = item.scoreFound !== undefined || item.scoreMatchesSource !== undefined;

    // Finn alle daterte hendelser som tidsmessig er mulige for dette beviset
    const validCandidates: { event: NewspaperEvent; distance: number }[] = [];

    for (const event of events) {
      if (event.inferredDate === undefined) continue;
      const diff = daysBetween(event.inferredDate, item.issueDate);

      if (hasScoreResult) {
        // Et kampresultat kan bare festes til en kamp som ble spilt samme dag eller FØR avisutgaven
        // (diff >= 0). En avis trykket 1. juni kan aldri omtale resultatet av en kamp 3. juni.
        if (diff >= 0 && diff <= NEARBY_DAYS) {
          validCandidates.push({ event, distance: diff });
        }
      } else {
        // Forhåndsomtaler eller generelle omtaler kan ligge inntil NEARBY_DAYS før eller etter
        if (Math.abs(diff) <= NEARBY_DAYS) {
          validCandidates.push({ event, distance: Math.abs(diff) });
        }
      }
    }

    if (validCandidates.length > 0) {
      // Velg nærmeste gyldige event
      validCandidates.sort((a, b) => a.distance - b.distance);
      validCandidates[0]!.event.evidence.push(item);
    } else {
      events.push({ id: `issue:${item.issueId}`, evidence: [item], score: 0 });
    }
  }

  for (const event of events) {
    event.evidence.sort((a, b) => b.score - a.score);
    // Sterkeste bevis, pluss et avtakende tillegg for hver uavhengige utgave som
    // støtter det samme. To utgaver som sier det samme er mer enn én, men ikke
    // dobbelt så mye.
    event.score = event.evidence.reduce((sum, item, index) => sum + (index === 0 ? item.score : item.score / (index + 3)), 0);
  }

  return events.sort((a, b) => b.score - a.score);
}

/** Dager mellom en ISO-dato og en NB-dato på formen ÅÅÅÅMMDD. */
function daysBetween(isoDate: string, compact: string): number {
  const issued = Date.UTC(Number(compact.slice(0, 4)), Number(compact.slice(4, 6)) - 1, Number(compact.slice(6, 8)));
  return Math.round((issued - Date.parse(`${isoDate}T00:00:00Z`)) / 86_400_000);
}
