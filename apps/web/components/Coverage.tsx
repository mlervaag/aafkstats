import type { SeasonSummary } from "@/lib/archive";

/**
 * Merkelappen som sier hvor mye av en sesong arkivet faktisk har.
 *
 * «85 sesonger» har hele tiden betydd 85 år med minst én registrert kamp. For en
 * leser er det ikke til å skille fra 85 komplette sesonger, og forskjellen er
 * stor: 2011 er en hel serie, mens 1951 er tre løsrevne kamper.
 *
 * Verdien regnes ut i byggesteget fra rundenumrene i kampene, så den kan ikke bli
 * utdatert slik en håndskrevet setning kan. Se `seasons`-viewet.
 *
 * Cup og treningskamper får ingen merkelapp. En cupsesong slutter når laget ryker
 * ut, så «ufullstendig» ville vært feil ord for en helt normal sesong.
 */
export function CoverageTag({ season }: { season: SeasonSummary }) {
  if (season.coverage === "not_applicable") return null;

  const text = coverageText(season);
  return (
    <span className={`coverage-tag coverage-${season.coverage}`} title={coverageExplanation(season)}>
      {text}
    </span>
  );
}

function coverageText(season: SeasonSummary): string {
  switch (season.coverage) {
    case "complete":
      return `Komplett · ${season.lastRound} runder`;
    case "partial":
      return `Delvis · ${season.played} av ${season.lastRound ?? "?"} runder`;
    default:
      return `${season.played} kjente ${season.played === 1 ? "kamp" : "kamper"}`;
  }
}

function coverageExplanation(season: SeasonSummary): string {
  switch (season.coverage) {
    case "complete":
      return "Arkivet har runde 1 til siste runde uten hull.";
    case "partial":
      return "Det mangler runder i denne sesongen, eller den pågår fortsatt.";
    default:
      return "Kampene mangler rundenummer, så arkivet vet bare at de ble spilt.";
  }
}

/**
 * Én setning om hvor mange av årene som faktisk er hele sesonger.
 *
 * Står under sesongoversikten, der påstanden «85 sesonger» ellers ville stått
 * alene og lovet mer enn arkivet har.
 */
export function CoverageSummary({ seasons }: { seasons: SeasonSummary[] }) {
  const leagues = seasons.filter((season) => season.coverage !== "not_applicable");
  const complete = leagues.filter((season) => season.coverage === "complete").length;
  const fragments = leagues.filter((season) => season.coverage === "isolated").length;
  if (leagues.length === 0) return null;

  return (
    <p className="small muted coverage-summary">
      {complete} av {leagues.length} seriesesonger ligger inne komplett, med hver runde fra
      første til siste.
      {fragments > 0 && (
        <> {fragments} {fragments === 1 ? "år har" : "år har"} bare enkeltkamper vi kjenner til.</>
      )}{" "}
      Cupen telles ikke her: den slutter når laget ryker ut, så det finnes ingen komplett
      cupsesong å måle mot.
    </p>
  );
}
