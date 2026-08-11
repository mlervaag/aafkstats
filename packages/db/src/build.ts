import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crossValidate, loadArchive } from "@aafkstats/schema/load";
import {
  completeness,
  missingFields,
  nameAt,
  personKey,
  preferredPersonName,
  toAafkPerspective,
  flattenSourceResults,
} from "@aafkstats/schema";
import type { Archive } from "@aafkstats/schema/load";
import { openForBuild } from "./index.js";

const schemaSql = () =>
  readFileSync(resolve(fileURLToPath(new URL(".", import.meta.url)), "schema.sql"), "utf8");

export interface BuildResult {
  path: string;
  matches: number;
  seasons: number;
  clubs: number;
  sourceResults: number;
  bytes: number;
  durationMs: number;
}

/**
 * Bygger arkivfilen fra en validert YAML-katalog.
 *
 * Filen skrives fra bunnen hver gang i stedet for å oppdateres inkrementelt. Det er
 * både enklest og mest korrekt: resultatet avhenger kun av innholdet i data/, så to
 * bygg av samme commit gir samme fil, og en slettet YAML-fil forsvinner faktisk.
 */
export function buildArchive(archive: Archive, outPath: string): BuildResult {
  const started = Date.now();

  mkdirSync(dirname(outPath), { recursive: true });
  // Rydd bort en tidligere fil. SQLite ville ellers klaget på at tabellene finnes.
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(`${outPath}${suffix}`, { force: true });
  }

  const db = openForBuild(outPath);
  db.exec(schemaSql());

  const clubById = new Map(archive.clubs.map((c) => [c.id, c]));
  const venueById = new Map(archive.venues.map((v) => [v.id, v]));
  const competitionById = new Map(archive.competitions.map((c) => [c.id, c]));

  const json = (value: unknown) => JSON.stringify(value);
  const bool = (value: boolean) => (value ? 1 : 0);

  db.exec("BEGIN");
  try {
    const insertClub = db.prepare(
      `INSERT INTO core_clubs (id, name, short_name, country, city, founded, founded_date, names, aliases, sources, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const c of archive.clubs) {
      insertClub.run(
        c.id, c.name, c.shortName ?? null, c.country, c.city ?? null,
        c.founded ?? null, c.foundedDate ?? null, json(c.names), json(c.aliases), json(c.sources), c.note ?? null,
      );
    }

    const insertVenue = db.prepare(
      `INSERT INTO core_venues (id, name, city, country, capacity, opened, opened_date, closed, closed_date, surface, names, surface_history, home_periods, attendance_records, events, sources, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const v of archive.venues) {
      insertVenue.run(
        v.id, v.name, v.city ?? null, v.country, v.capacity ?? null,
        v.opened ?? null, v.openedDate ?? null, v.closed ?? null, v.closedDate ?? null,
        v.surface ?? null, json(v.names), json(v.surfaceHistory), json(v.homePeriods),
        json(v.attendanceRecords), json(v.events), json(v.sources), v.note ?? null,
      );
    }

    const insertCompetition = db.prepare(
      `INSERT INTO core_competitions (id, name, type, tier, organizer, country, names, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const c of archive.competitions) {
      insertCompetition.run(
        c.id, c.name, c.type, c.tier ?? null, c.organizer ?? null,
        c.country ?? null, json(c.names), c.note ?? null,
      );
    }

    const insertProvider = db.prepare(
      `INSERT INTO core_providers (id, name, url, priority, license,
         automated_access, public_redistribution, attribution_required,
         permission_status, ingest_decision, permission_requested_at,
         risk_accepted_at, risk_accepted_by,
         terms_checked_at, robots_checked_at, permission_note, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const s of archive.providers) {
      insertProvider.run(
        s.id, s.name, s.url ?? null, s.priority, s.license ?? null,
        s.automatedAccess, s.publicRedistribution, bool(s.attributionRequired),
        s.permissionStatus, s.ingestDecision,
        s.permissionRequestedAt ?? null, s.riskAcceptedAt ?? null, s.riskAcceptedBy ?? null,
        s.termsCheckedAt ?? null, s.robotsCheckedAt ?? null,
        s.permissionNote ?? null, s.note ?? null,
      );
    }

    const insertContribution = db.prepare(
      `INSERT INTO core_contributions (id, scope, target_id, category, text, contributor, submitted_at, verification, source_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const c of archive.contributions) {
      insertContribution.run(
        c.id, c.scope, c.targetId, c.category, c.text,
        c.contributor ?? null, c.submittedAt, c.verification, c.sourceUrl ?? null
      );
    }

    const insertSource = db.prepare(
      `INSERT INTO core_sources (id, parent_source_id, title, source_type, issue, volume, publisher, year,
         urn, author, description, cover_url, access_url, providers)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    // Foreldreseriene må finnes før utgavene når SQLite håndhever fremmednøkkelen.
    // Filnavnrekkefølge er ikke en kontrakt og kan ikke brukes som innsettingsrekkefølge.
    const orderedSources = [...archive.sources].sort((a, b) =>
      Number(a.parentSourceId !== undefined) - Number(b.parentSourceId !== undefined),
    );
    for (const p of orderedSources) {
      insertSource.run(
        p.id, p.parentSourceId ?? null, p.title, p.sourceType, p.issue ?? null, p.volume ?? null, p.publisher ?? null, p.year ?? null,
        p.urn ?? null, p.author ?? null, p.description ?? null,
        p.coverUrl ?? null, p.accessUrl ?? null, json(p.providers ?? [])
      );
    }

    const insertSourceResult = db.prepare(
      `INSERT INTO core_source_results
         (source_id, id, season, source_order, page, opponent, opponent_club_id,
          aafk_score, opponent_score, competition_id, status, replay,
          after_extra_time, round, match_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const collection of archive.sourceResults) {
      for (const result of flattenSourceResults(collection)) {
        insertSourceResult.run(
          result.sourceId, result.id, result.season, result.order, result.page,
          result.opponent, result.opponentClubId, result.aafkGoals, result.opponentGoals,
          result.competitionId, result.status, bool(result.replay), bool(result.extraTime),
          result.round, result.matchId, result.note ?? null,
        );
      }
    }

    const insertExtraction = db.prepare(
      `INSERT INTO core_publication_extractions
         (source_id, provider_id, adapter, retrieved_at, ocr_access, pages_expected, pages_processed, pages_failed, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertCandidate = db.prepare(
      `INSERT INTO core_fact_candidates
         (source_id, id, kind, page, confidence, keywords, names, years, scores, person_ids, match_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const extraction of archive.extractions) {
      insertExtraction.run(
        extraction.sourceId, extraction.providerId, extraction.adapter, extraction.retrievedAt,
        extraction.ocrAccess, extraction.pagesExpected, extraction.pagesProcessed,
        json(extraction.pagesFailed), extraction.contentHash ?? null,
      );
      for (const candidate of extraction.candidates) {
        insertCandidate.run(
          extraction.sourceId, candidate.id, candidate.kind, candidate.page, candidate.confidence,
          json(candidate.keywords), json(candidate.names), json(candidate.years), json(candidate.scores),
          json(candidate.personIds), json(candidate.matchIds),
        );
      }
    }

    const insertPerson = db.prepare(
      `INSERT INTO core_people (id, person_key, name, nationality, position, wikidata, sources, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertPersonName = db.prepare(
      `INSERT OR IGNORE INTO core_person_names (person_id, person_key, name) VALUES (?, ?, ?)`,
    );
    const insertSquadNumber = db.prepare(
      `INSERT INTO core_squad_numbers (person_id, season, number) VALUES (?, ?, ?)`,
    );
    const insertDeclaredSpell = db.prepare(
      `INSERT INTO core_declared_coach_spells (person_id, from_season, to_season) VALUES (?, ?, ?)`,
    );
    const insertPersonRole = db.prepare(
      `INSERT INTO core_person_roles
         (person_id, role_id, category, title, body, from_date, to_date, sources, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const p of archive.people) {
      insertPerson.run(
        p.id, personKey(p.name), p.name, p.nationality ?? null,
        p.position ?? null, p.wikidata ?? null, json(p.sources ?? []), p.note ?? null,
      );
      for (const written of [p.name, ...p.names]) {
        insertPersonName.run(p.id, personKey(written), written);
      }
      for (const entry of p.squadNumbers) insertSquadNumber.run(p.id, entry.season, entry.number);
      for (const spell of p.coachSpells) {
        insertDeclaredSpell.run(p.id, spell.fromSeason, spell.toSeason);
      }
      for (const role of p.roles) {
        insertPersonRole.run(
          p.id, role.id, role.category, role.title, role.body ?? null,
          role.from, role.to, json(role.sources), role.note ?? null,
        );
      }
    }

    const insertSeason = db.prepare(
      `INSERT INTO core_seasons
         (year, competition_id, competition_name, final_position, teams_in_league,
          expected_matches, expected_rounds, head_coach, promoted, relegated, sources, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const s of archive.seasons) {
      // Midt i sesongen som referansedato — et navnebytte skjer mellom sesonger,
      // så 1. juli treffer alltid navnet som gjaldt det året.
      const competition = competitionById.get(s.competitionId);
      const competitionName = competition
        ? nameAt(competition.names, competition.name, `${s.year}-07-01`)
        : s.competitionId;
      insertSeason.run(
        s.year, s.competitionId, competitionName, s.finalPosition, s.teamsInLeague ?? null,
        s.expectedMatches ?? null, s.expectedRounds ?? null,
        s.headCoach ?? null, bool(s.promoted), bool(s.relegated), json(s.sources), s.note ?? null,
      );
    }

    const insertStanding = db.prepare(
      `INSERT INTO core_standings
         (competition_id, season, position, team, club_id, played, wins, draws,
          losses, goals_for, goals_against, points, outcome, sources, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertProgression = db.prepare(
      `INSERT INTO core_standings_progression
         (competition_id, season, round, position, points, played, goal_difference)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const table of archive.standings) {
      for (const row of table.table) {
        insertStanding.run(
          table.competitionId, table.season, row.position, row.name, row.clubId,
          row.played, row.wins, row.draws, row.losses, row.goalsFor, row.goalsAgainst,
          row.points, row.outcome, json(table.sources ?? []), row.note ?? null,
        );
      }
      for (const point of table.progression) {
        insertProgression.run(
          table.competitionId, table.season, point.round, point.position,
          point.points, point.played, point.goalDifference,
        );
      }
    }

    // Samles under kamploopen og skrives etterpå, når alle navnevariantene er
    // kjent. Se under COMMIT.
    const appearances: { matchId: string; season: number; name: string; role: "start" | "bench" }[] = [];
    const coachMatches: { matchId: string; season: number; date: string; name: string }[] = [];

    const insertMatch = db.prepare(
      `INSERT INTO core_matches (
         id, match_date, date_confidence, kickoff, status,
         competition_id, season, stage, round, leg, group_name,
         home_club_id, away_club_id, home_score, away_score,
         home_ht_score, away_ht_score, home_et_score, away_et_score, home_pens, away_pens,
         venue_id, neutral_venue, attendance, referee,
         is_home, opponent_club_id, aafk_score, opponent_score, goal_difference,
         result, after_extra_time, decided_on_pens, won_on_pens,
         competition_name, opponent_name, venue_name,
         events, lineups, stats, report_summary, report_body, report_byline,
         external_reports, providers, sources, confidence, conflicts, tags, aliases,
         completeness, missing_fields, note, source_file
       ) VALUES (${Array.from({ length: 54 }, () => "?").join(", ")})`,
    );

    const insertReport = db.prepare(
      `INSERT INTO reports
         (match_id, date, season, opponent, is_home, result, summary, body, byline, url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const m of archive.matches) {
      const p = toAafkPerspective(m);

      // Navnene som gjaldt på kampdatoen, slått opp én gang her i stedet for per
      // spørring. nameAt() er den samme funksjonen visningslaget bruker.
      const opponent = clubById.get(p.opponentClubId);
      const competition = competitionById.get(m.competition.id);
      const venue = m.venueId ? venueById.get(m.venueId) : undefined;

      const opponentName = opponent
        ? nameAt(opponent.names, opponent.name, m.date)
        : p.opponentClubId;
      const competitionName = competition
        ? nameAt(competition.names, competition.name, m.date)
        : m.competition.id;
      const venueName = venue ? nameAt(venue.names, venue.name, m.date) : null;

      insertMatch.run(
        m.id, m.date, m.dateConfidence, m.kickoff ?? null, m.status,
        m.competition.id, m.competition.season, m.competition.stage,
        m.competition.round ?? null, m.competition.leg ?? null, m.competition.groupName ?? null,
        m.home.clubId, m.away.clubId, m.home.score, m.away.score,
        m.home.halfTimeScore, m.away.halfTimeScore,
        m.extraTime?.home ?? null, m.extraTime?.away ?? null,
        m.penaltyShootout?.home ?? null, m.penaltyShootout?.away ?? null,
        m.venueId ?? null, bool(m.neutralVenue), m.attendance ?? null, m.referee ?? null,
        bool(p.isHome), p.opponentClubId, p.aafkScore, p.opponentScore, p.goalDifference,
        p.result, bool(p.afterExtraTime), bool(p.decidedOnPenalties),
        p.wonOnPenalties === null ? null : bool(p.wonOnPenalties),
        competitionName, opponentName, venueName,
        json(m.events), m.lineups ? json(m.lineups) : null, m.stats ? json(m.stats) : null,
        m.report?.summary ?? null, m.report?.body ?? null, m.report?.byline ?? null,
        json(m.externalReports ?? []), json(m.providers ?? []), json(m.sources ?? []), m.confidence, json(m.conflicts ?? []),
        json(m.tags ?? []), json(m.aliases ?? {}),
        completeness(m), json(missingFields(m)),
        m.note ?? null, m.file,
      );

      // Oppstillingen på vår egen side av kampen. Motstanderens elleve er
      // registrert, men de er ikke vår stall, og å telle dem ville gjort
      // «spillere i 2011» til 22 i stedet for 11.
      const ours = p.isHome ? m.lineups?.home : m.lineups?.away;
      if (ours) {
        for (const [role, players] of [["start", ours.starters], ["bench", ours.subs]] as const) {
          for (const player of players ?? []) {
            appearances.push({ matchId: m.id, season: m.competition.season, name: player, role });
          }
        }
        if (ours.coach) {
          coachMatches.push({
            matchId: m.id,
            season: m.competition.season,
            date: m.date,
            name: ours.coach,
          });
        }
      }

      if (m.report?.summary || m.report?.body) {
        insertReport.run(
          m.id, m.date, m.competition.season, opponentName, bool(p.isHome),
          p.result, m.report.summary ?? "", m.report.body ?? "",
          m.report.byline ?? "", `/kamp/${m.id}`,
        );
      }
    }

    // Navnene samles først, slik at hver person kan få én skrivemåte før noe
    // skrives. Å velge den underveis ville gjort svaret avhengig av hvilken kamp
    // som ble lest først.
    const variants = new Map<string, Map<string, number>>();
    const countName = (name: string) => {
      const key = personKey(name);
      const forKey = variants.get(key) ?? new Map<string, number>();
      forKey.set(name, (forKey.get(name) ?? 0) + 1);
      variants.set(key, forKey);
    };
    for (const a of appearances) countName(a.name);
    for (const c of coachMatches) countName(c.name);

    const display = new Map<string, string>();
    for (const [key, forKey] of variants) {
      display.set(key, preferredPersonName([...forKey].map(([name, count]) => ({ name, count }))));
    }

    const insertAppearance = db.prepare(
      `INSERT OR IGNORE INTO core_appearances (match_id, season, person_key, name, role)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const a of appearances) {
      const key = personKey(a.name);
      insertAppearance.run(a.matchId, a.season, key, display.get(key) ?? a.name, a.role);
    }

    const insertCoachMatch = db.prepare(
      `INSERT OR IGNORE INTO core_coach_matches (match_id, season, match_date, person_key, name)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const c of coachMatches) {
      const key = personKey(c.name);
      insertCoachMatch.run(c.matchId, c.season, c.date, key, display.get(key) ?? c.name);
    }

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    db.close();
    throw err;
  }

  // Pakk filen tett og bygg statistikk, så spørreplanleggeren tar gode valg.
  db.exec("ANALYZE");
  db.exec("VACUUM");
  db.close();

  return {
    path: outPath,
    matches: archive.matches.length,
    seasons: archive.seasons.length,
    clubs: archive.clubs.length,
    sourceResults: archive.sourceResults.reduce((sum, collection) => sum + collection.seasons.reduce((seasonSum, season) => seasonSum + season.results.length, 0), 0),
    bytes: statSync(outPath).size,
    durationMs: Date.now() - started,
  };
}

/** Laster, validerer og bygger. Kaster hvis arkivet ikke validerer. */
export async function loadValidateAndBuild(
  dataRoot: string,
  outPath: string,
): Promise<BuildResult> {
  const archive = await loadArchive(dataRoot);
  const issues = [...archive.issues, ...crossValidate(archive)];
  if (issues.length > 0) {
    throw new Error(
      `${issues.length} valideringsfeil — kjør «pnpm validate» for detaljer.\n` +
        "Bygger ikke: en halvgyldig database er verre enn ingen.",
    );
  }
  if (archive.matches.length === 0 && archive.clubs.length === 0) {
    throw new Error(`Fant ingen data i ${dataRoot}`);
  }
  return buildArchive(archive, outPath);
}
