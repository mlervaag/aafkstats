import type { FetchResult, SourceMatch, SourceTeamStats } from "./types.js";
import type { ReconcilePlan } from "./reconcile.js";

export interface PilotReportOptions {
  generatedAt: string;
  leagueId: string;
  season: number;
  competitionId: string;
  withDetails: boolean;
}

export function pilotReport(result: FetchResult, plan: ReconcilePlan, options: PilotReportOptions): string {
  const played = result.matches.filter((match) => match.status === "played").length;
  const coverage = (field: keyof SourceMatch) => result.matches.filter((match) => match[field] !== undefined).length;
  const withEvents = result.matches.filter((match) => (match.events?.length ?? 0) > 0).length;
  const withLineups = coverage("lineups");
  const withStats = coverage("stats");
  const withAttendance = coverage("attendance");
  const statFields: { key: keyof SourceTeamStats; label: string }[] = [
    { key: "possession", label: "Ballbesittelse" },
    { key: "shots", label: "Skudd" },
    { key: "shotsOnTarget", label: "Skudd på mål" },
    { key: "corners", label: "Cornere" },
    { key: "fouls", label: "Frispark/fouls" },
    { key: "offsides", label: "Offside" },
    { key: "xg", label: "xG" },
  ];
  const statCoverage = statFields.map(({ key, label }) => ({
    label,
    count: result.matches.filter((match) => match.statsReport?.foundFields.includes(key) ?? false).length,
  }));
  const perMatch = result.matches
    .filter((match) => match.statsReport)
    .map((match) => {
      const found = match.statsReport!.foundFields.join(", ") || "ingen";
      const unknown = match.statsReport!.unknownTitles.join(", ") || "–";
      return `| ${match.date} | ${match.home.name}–${match.away.name} | ${found} | ${unknown} |`;
    })
    .join("\n");
  const field = (count: number) => `${count}/${result.matches.length} (${percent(count, result.matches.length)} %)`;

  return `# FotMob-pilot ${options.season}

Generert ${options.generatedAt} av \`pnpm ingest:fotmob\`.

## Omfang

- Eksplisitt turnerings-ID: \`${options.leagueId}\`
- Arkivkonkurranse: \`${options.competitionId}\`
- Sesong: ${options.season}
- Kampdetaljer: ${options.withDetails ? "ja" : "nei"}
- Kamper funnet: ${result.matches.length} (${played} ferdigspilt)
- Nettverkskall i denne kjøringen: ${result.requests} (cachetreff telles ikke)
- Feil: ${result.failures.length}

Piloten henter bare strukturerte kampfakta. Den henter ikke livekommentarer, artikler,
bilder, odds, momentum eller skuddkart, og den lager ikke kampreferat.

## Feltdekning

| Felt | Kamper |
|---|---:|
| Tilskuertall | ${field(withAttendance)} |
| Hendelser | ${field(withEvents)} |
| Lagoppstillinger | ${field(withLineups)} |
| Lagstatistikk | ${field(withStats)} |
${statCoverage.map((entry) => `| ${entry.label} | ${field(entry.count)} |`).join("\n")}

## Statistikk per kamp

| Dato | Kamp | Felt funnet | Ukjente titler |
|---|---|---|---|
${perMatch || "| – | Ingen kampdetaljer lest | – | – |"}

## Planlagt arkivendring

| Type | Nye | Oppdaterte |
|---|---:|---:|
| Kamper | ${plan.summary.matchesCreated} | ${plan.summary.matchesUpdated} |
| Klubber | ${plan.summary.clubsCreated} | ${plan.summary.clubsUpdated} |
| Stadioner | ${plan.summary.venuesCreated} | 0 |
| Sesonger | ${plan.summary.seasonsCreated} | 0 |

Uløste reconcile-problemer: ${plan.issues.length}.

## Vurdering

Dette er en avgrenset teknisk dekningsprøve mot et udokumentert endepunkt. FotMobs
vilkår og robots.txt tillater ikke en generell, løpende crawler. Råresponsene ligger bare
i gitignorert cache. Før en større backfill må prosjektet avklare rettighetsgrunnlaget og
velge en lisensiert hovedkilde; FotMob bør i så fall være en sekundær faktakilde.

En vellykket pilot beviser mapping, validering og visning. Den beviser ikke at FotMob er
komplett for andre sesonger, eller at data kan hentes og gjenbrukes systematisk.
`;
}

function percent(count: number, total: number): string {
  return total === 0 ? "0" : ((count / total) * 100).toFixed(0);
}
