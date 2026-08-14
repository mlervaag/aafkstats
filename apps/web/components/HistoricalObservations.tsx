import { SourceChips } from "./SourceChips";
import type { HistoricalObservation } from "@/lib/historical-observations";

export function HistoricalObservations({ observations, titles, className = "content-section" }: {
  observations: HistoricalObservation[]; titles: Map<string, string>; className?: string;
}) {
  if (observations.length === 0) return null;
  return <section className={className}>
    <h2>Historiske observasjoner</h2>
    <ol className="historical-observation-list">
      {observations.map((observation) => <li id={`observasjon-${observation.id}`} key={observation.id}>
        {observation.date ? <time className="num muted">{observation.date}</time> : null}
        <h3>{observation.title}</h3>
        <p>{observation.text}</p>
        {observation.note ? <p className="small muted">{observation.note}</p> : null}
        <SourceChips refs={observation.sources} titles={titles} />
      </li>)}
    </ol>
  </section>;
}
