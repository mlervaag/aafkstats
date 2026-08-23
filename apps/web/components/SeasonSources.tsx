import { SourceChips, type CitedRef } from "@/components/SourceChips";
import type { SeasonSourceRef } from "@/lib/historical-observations";

/**
 * Feltnavnene i sesongposten, slik en leser sier dem.
 *
 * Navnene er de samme som i `packages/schema/src/entities.ts`. Et felt uten
 * oppføring her nevnes ikke: `competitionId` belegger at kampene hører til denne
 * konkurransen, og det er en opplysning om datamodellen, ikke om sesongen.
 */
const FIELD_NAMES: Record<string, string> = {
  finalPosition: "sluttplassen",
  teamsInLeague: "antall lag",
  expectedMatches: "antall kamper i sesongen",
  expectedRounds: "antall runder",
  headCoach: "treneren",
  promoted: "opprykket",
  relegated: "nedrykket",
};

function joinWords(words: string[]): string {
  if (words.length === 1) return words[0]!;
  return `${words.slice(0, -1).join(", ")} og ${words.at(-1)}`;
}

/**
 * Kildene bak sesongposten.
 *
 * Sto som «Kilder til sesongoversikten» i store bokstaver over én brikke. Tre av
 * fire sesonger med kilde har nøyaktig én, så flertallsformen var som regel feil,
 * og «sesongoversikten» er ikke noe leseren kan peke på: brikka belegger ikke
 * kamplista, men tallene i sesongposten — sluttplassen, antall lag, omfanget som
 * «komplett» måles mot. Feltene står i dataene, så overskriften kan si det.
 */
export function SeasonSources({ refs, titles }: { refs: SeasonSourceRef[]; titles: Map<string, string> }) {
  if (refs.length === 0) return null;

  const fields = [...new Set(refs.flatMap((ref) => ref.fields))]
    .map((field) => FIELD_NAMES[field])
    .filter((name): name is string => name !== undefined);

  return (
    <div className="season-sources">
      <h3 className="subsection-heading">
        {refs.length === 1 ? "Kilde til sesongtallene" : `${refs.length} kilder til sesongtallene`}
      </h3>
      {fields.length > 0 ? (
        <p className="small muted">
          Belegger {joinWords(fields)}. Kildene til hver enkelt kamp står på kampsidene.
        </p>
      ) : null}
      <SourceChips refs={refs as CitedRef[]} titles={titles} />
    </div>
  );
}
