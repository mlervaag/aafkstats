import { SourceChips } from "./SourceChips";
import type { HistoricalObservation } from "@/lib/historical-observations";
import { formatObservationDate } from "@/lib/date";

/**
 * Overskriftsnivået følger siden, ikke komponenten.
 *
 * Lista står som en egen seksjon på person-, sesong- og kampsiden, men inne i et
 * banekort på hjemmebanesiden, der `h2` allerede er banenavnet. Uten dette valget
 * ville kortet fått to `h2` på samme nivå med ulik betydning.
 */
export function HistoricalObservations({ observations, titles, className = "content-section", level = 2 }: {
  observations: HistoricalObservation[]; titles: Map<string, string>; className?: string; level?: 2 | 3;
}) {
  if (observations.length === 0) return null;
  const Heading = level === 2 ? "h2" : "h3";
  const ItemHeading = level === 2 ? "h3" : "h4";
  return <section className={className || undefined}>
    <Heading>Historiske observasjoner</Heading>
    <ol className="historical-observation-list">
      {observations.map((observation) => <li id={`observasjon-${observation.id}`} key={observation.id}>
        {observation.date ? <time className="num muted" dateTime={observation.date}>{formatObservationDate(observation.date)}</time> : null}
        <ItemHeading>{observation.title}</ItemHeading>
        <p>{observation.text}</p>
        {observation.note ? <p className="small muted">{observation.note}</p> : null}
        <SourceChips refs={observation.sources} titles={titles} />
      </li>)}
    </ol>
  </section>;
}
