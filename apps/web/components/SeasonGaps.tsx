import { ContributionButton } from "@/components/ContributionButton";
import type { SeasonGaps as SeasonGapsData } from "@/lib/archive";
import { contributionIssueUrl } from "@/lib/contribution-links";

/**
 * Feltnavnene fra `missing_fields`, slik en leser sier dem.
 *
 * Nøklene er de samme som `COMPLETENESS_FIELDS` i `packages/schema/src/derive.ts`.
 * Et felt uten oppføring her nevnes ikke: et navn arkivet ikke kan si på norsk er
 * ikke et hull noen kan hjelpe med å fylle.
 */
const FIELD_NAMES: Record<string, string> = {
  score: "resultat",
  attendance: "tilskuertall",
  lineups: "lagoppstilling",
  events: "mål og kort",
  report: "kampreferat",
  referee: "dommer",
  venue: "stadion",
};

/** Felt som mangler på nesten hver eneste kamp sier ingenting om nettopp dette året. */
const NEARLY_ALL = 0.95;

/**
 * Under så få kamper er «mangler på alle» ikke et mønster, bare et lite tall.
 *
 * 1917 har én kamp i arkivet. Uten denne grensa ville alt som mangler på den ene
 * kampen blitt filtrert bort som «mangler overalt», og sida hadde svart «alt er på
 * plass for 1917» om en sesong arkivet knapt vet noe om.
 */
const MIN_FOR_SHARE = 5;

/**
 * Hva arkivet mangler i denne sesongen, sagt i klartekst, med veien videre.
 *
 * Dekningsmerket sier «Delvis · 24 av 26 kamper». Det er sant, men det er ikke
 * noe å gjøre noe med. Setningen her sier hvilke opplysninger som mangler og på
 * hvor mange kamper. Et sesongminne går til minneskjemaet, mens kampdata går til
 * riktig GitHub-mal. Dermed havner ikke en rettelse i innboksen for minner.
 *
 * Den sier bare det databasen kan stå inne for. Ingen andel, ingen «nesten
 * komplett» der grunnlaget mangler, og ingenting om felt som mangler overalt.
 */
export function SeasonGaps({ year, gaps }: { year: number; gaps: SeasonGapsData }) {
  const contribute = (label: string) => (
    <ContributionButton scope="season" targetId={String(year)} title={`Sesongen ${year}`} label={label} />
  );
  const dataLinks = (includeMissingMatch: boolean) => (
    <div className="season-contribution-actions">
      {contribute("Del et sesongminne")}
      {includeMissingMatch && (
        <a href={contributionIssueUrl("manglende-kamp", `Sesongen ${year}`, {
          dato: String(year),
          annet: `Gjelder sesongen ${year}, /sesong/${year}`,
        })}>
          Meld manglende kamp
        </a>
      )}
      <a href={contributionIssueUrl("ny-kilde", `Sesongen ${year}`, {
        kamp: `Sesongen ${year} — /sesong/${year}`,
      })}>
        Legg til kampdetaljer
      </a>
    </div>
  );

  // Et år som bare har kamper på terminlista mangler ingenting ennå.
  if (gaps.played === 0) return dataLinks(false);

  const named = gaps.gaps.filter((gap) => FIELD_NAMES[gap.field] !== undefined);

  // Et felt som mangler på alle kampene er en egenskap ved arkivet, ikke ved året —
  // «kampreferat for 26 av 26 kamper» står allerede på /bidra som en setning om hele
  // arkivet. Men det gjelder bare når det finnes noe mer treffende å peke på i stedet.
  // Er det ingenting igjen etter filteret, står de brede hullene: å tie om dem ville
  // vært å påstå at sesongen er hel.
  const specific = gaps.played >= MIN_FOR_SHARE
    ? named.filter((gap) => gap.matches < gaps.played * NEARLY_ALL)
    : named;
  const shown = (specific.length > 0 ? specific : named).slice(0, 3);

  if (gaps.missingMatches === 0 && shown.length === 0) {
    return (
      <div className="season-gaps">
        <p className="small muted">
          Alt arkivet pleier å registrere er på plass for {year}, på{" "}
          {gaps.played === 1 ? "den ene kampen året har" : `hver av de ${gaps.played} kampene`}.
        </p>
        {contribute("Del et sesongminne")}
      </div>
    );
  }

  // «Tilskuertall for 29 kamper, mål og kort for 29 kamper og lagoppstilling for 29
  // kamper» av 29 er tre ganger det samme tallet. Et felt som mangler på hele året
  // sies én gang, uten telling; bare de delvise hullene trenger et antall.
  const everywhere = shown.filter((gap) => gap.matches === gaps.played);
  const partial = shown.filter((gap) => gap.matches !== gaps.played);

  return (
    <div className="notice prose season-gaps">
      <p>
        <strong>Dette mangler for {year}.</strong>{" "}
        {gaps.missingMatches > 0 && (
          <>
            {gaps.missingMatches} {gaps.missingMatches === 1 ? "seriekamp" : "seriekamper"} mangler
            helt: sluttabellen sier at AaFK spilte flere enn arkivet har.{" "}
          </>
        )}
        {partial.length > 0 && (
          <>
            Av de {gaps.played} kampene som ligger inne mangler{" "}
            {joinNorwegian(
              partial.map(
                (gap) => `${FIELD_NAMES[gap.field]} for ${gap.matches} ${gap.matches === 1 ? "kamp" : "kamper"}`,
              ),
            )}
            .{" "}
          </>
        )}
        {everywhere.length > 0 && (
          <>
            {gaps.played === 1 ? "Den ene kampen året har mangler " : `Ingen av de ${gaps.played} kampene har `}
            {joinNorwegian(everywhere.map((gap) => FIELD_NAMES[gap.field]!))}.{" "}
          </>
        )}
        Sitter du på et programblad, et avisutklipp eller et minne som fyller noe av dette,
        hjelper det.
      </p>
      {dataLinks(gaps.missingMatches > 0)}
    </div>
  );
}

/** «a, b og c». Oxford-komma finnes ikke på norsk. */
function joinNorwegian(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} og ${parts.at(-1)}`;
}
