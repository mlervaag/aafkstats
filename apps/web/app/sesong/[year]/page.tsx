import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoverageTag } from "@/components/Coverage";
import { MatchList } from "@/components/MatchList";
import { Contributions } from "@/components/Contributions";
import { SeasonGaps } from "@/components/SeasonGaps";
import { SeasonCoaches, SquadList } from "@/components/Squad";
import { ProgressionChart, StandingsTable } from "@/components/Standings";
import {
  loadDeclaredCoaches,
  loadNeighbourSeasons,
  loadSeason,
  loadSeasonGaps,
  loadSeasonCoaches,
  loadSeasonYears,
  loadSquad,
  loadStandings,
  loadContributions,
  loadCompetitionTitles,
  loadOpponentIds,
} from "@/lib/archive";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { pageMetadata, seasonDescription, seasonTitle } from "@/lib/metadata";
import { SourceChips } from "@/components/SourceChips";
import { HistoricalObservations } from "@/components/HistoricalObservations";
import { UnlinkedResults } from "@/components/UnlinkedResults";
import { getSeasonObservations, getSeasonSources } from "@/lib/historical-observations";
import { getSourceTitles } from "@/lib/people";

export function generateStaticParams(): { year: string }[] {
  return loadSeasonYears().map((entry) => ({ year: String(entry.year) }));
}

type Props = { params: Promise<{ year: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year } = await params;
  const data = loadSeason(Number(year));
  const lead = data?.summaries[0];
  if (!lead) return pageMetadata(`Sesongen ${year}`, `${data?.sourceResults.length ?? 0} kildedokumenterte AaFK-resultater fra ${year}.`, `/sesong/${year}`);
  return pageMetadata(
    seasonTitle({ ...lead, year: lead.season }),
    seasonDescription({ ...lead, year: lead.season }),
    `/sesong/${year}`,
  );
}

export default async function SeasonPage({ params }: Props) {
  const { year: rawYear } = await params;
  const year = Number(rawYear);
  if (!Number.isInteger(year)) notFound();
  const data = loadSeason(year);
  if (!data) notFound();
  const { summaries, matches, sourceResults } = data;
  const lead = summaries[0] ?? null;
  const { previous, next } = loadNeighbourSeasons(year);
  const coaches = loadSeasonCoaches(year);
  const declaredCoaches = loadDeclaredCoaches(year);
  const gaps = loadSeasonGaps(year);
  const squad = loadSquad(year);
  const contributions = loadContributions(year.toString(), "season");
  const observations = getSeasonObservations(year);
  const seasonSources = getSeasonSources(year);
  const sourceTitles = getSourceTitles();
  const competitionNames = loadCompetitionTitles();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Sesonger", path: "/sesonger" },
          { name: String(year), path: `/sesong/${year}` },
        ])}
      />
      <p className="breadcrumb"><a href="/sesonger">Sesonger</a> / {year}</p>
      <header className="page-intro compact">
        <p className="eyebrow">
          {lead ? lead.competition : "Historisk resultatliste"}
          {lead?.competitionTier ? ` · nivå ${lead.competitionTier}` : ""}
        </p>
        <h1>Sesongen {year}</h1>
        <SeasonCoaches coaches={coaches} declared={declaredCoaches} season={year} />
      </header>

      {/* Én seksjon per konkurranse, hver med sine egne tall over sine egne kamper.
          Tidligere sto ett tallsett øverst som bare gjaldt serien, over en liste som
          inneholdt alt — så statistikken og lista fortalte hver sin historie. */}
      {summaries.map((summary) => {
        const group = matches.filter((match) => match.competition === summary.competition);
        const played = group.filter((match) => match.status !== "scheduled");
        const upcoming = group.filter((match) => match.status === "scheduled");
        return (
          <section className="content-section" key={summary.competitionId}>
            <h2 className="section-heading">
              {/* Navn og dekning hører sammen til venstre; kamptallet står til
                  høyre. Uten grupperingen fordeler flexen de tre jevnt utover
                  og merket havner midt i linja. */}
              <span className="section-heading-title">
                {summary.competition}
                <CoverageTag season={summary} />
              </span>
              <span className="muted section-count">
                {summary.played} {summary.played === 1 ? "kamp" : "kamper"}
              </span>
            </h2>

            <div className="stat-strip" aria-label={`Tall for ${summary.competition} ${year}`}>
              <Stat value={summary.wins} label="Seire" />
              <Stat value={summary.draws} label="Uavgjort" />
              <Stat value={summary.losses} label="Tap" />
              <Stat value={`${summary.goalsFor}–${summary.goalsAgainst}`} label="Mål" />
              {summary.finalPosition !== null && (
                <Stat value={`${summary.finalPosition}.`} label="Plass" />
              )}
            </div>

            {summary.note && (
              <div className="notice prose" style={{ marginTop: "1rem" }}>
                <strong>Forbehold:</strong> {summary.note}
              </div>
            )}

            {/* Tabellen står over kamplista. Den svarer på det folk kommer for
                først — hvor det endte — og lista svarer på hvordan. */}
            <SeasonStandings competitionId={summary.competitionId} season={year} />

            <MatchList matches={played} />
            {upcoming.length > 0 && (
              <>
                {/* Terminlista står for seg. Blandet inn i resultatlista ser en
                    kamp som ikke er spilt ut som en kamp uten resultat. */}
                <h3 className="subsection-heading">
                  Står igjen
                  <span className="muted small">
                    {" "}
                    {upcoming.length} {upcoming.length === 1 ? "kamp" : "kamper"}
                  </span>
                </h3>
                <MatchList matches={upcoming} />
              </>
            )}

            {summary === lead && seasonSources.length > 0 ? (
              <div style={{ marginTop: "1.25rem" }}>
                <h3 className="subsection-heading">Kilder til sesongoversikten</h3>
                <SourceChips refs={seasonSources} titles={sourceTitles} />
              </div>
            ) : null}
          </section>
        );
      })}

      {/* Kamper i en konkurranse der ingen er spilt ennå. Sesongsammendraget
          bygges på spilte kamper, så uten dette ville en terminliste som kom før
          første kamp forsvunnet helt fra sida. */}
      {(() => {
        const covered = new Set(summaries.map((summary) => summary.competition));
        const orphans = matches.filter((match) => !covered.has(match.competition));
        if (orphans.length === 0) return null;
        return (
          <section className="content-section">
            <h2 className="section-heading">
              <span className="section-heading-title">Ikke spilt ennå</span>
              <span className="muted section-count">{orphans.length} kamper</span>
            </h2>
            <MatchList matches={orphans} />
          </section>
        );
      })()}

      {lead ? (
        <section className="content-section season-help">
          <p className="eyebrow">Gjør arkivet bedre</p>
          <h2>Kan du hjelpe oss å dokumentere {year} bedre?</h2>
          <SeasonGaps year={year} gaps={gaps} />
        </section>
      ) : null}

      <HistoricalObservations observations={observations} titles={sourceTitles} />

      <UnlinkedResults
        results={sourceResults}
        year={year}
        titles={sourceTitles}
        competitionNames={competitionNames}
        validOpponentIds={loadOpponentIds()}
      />

      <SquadList players={squad} />

      <Contributions contributions={contributions} />

      <nav className="season-nav" aria-label="Andre sesonger">
        {previous ? <a href={`/sesong/${previous}`}>← {previous}</a> : <span />}
        <a href="/sesonger">Alle sesonger</a>
        {next ? <a href={`/sesong/${next}`}>{next} →</a> : <span />}
      </nav>
    </>
  );
}

/**
 * Sluttabellen for én konkurranse, med kurven over.
 *
 * Renders ingenting når vi ikke har tabellen for året. 27 av 32 seriesesonger
 * har den; cupen har ingen, og den inneværende sesongen har ingen ennå.
 */
function SeasonStandings({ competitionId, season }: { competitionId: string; season: number }) {
  const { table, progression } = loadStandings(competitionId, season);
  if (table.length === 0) return null;

  return (
    <section className="season-standings">
      <h3 className="subsection-heading">Tabell</h3>
      <ProgressionChart points={progression} teams={table.length} season={season} />
      <StandingsTable rows={table} season={season} />
    </section>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return <div><strong className="num">{value}</strong><span>{label}</span></div>;
}
