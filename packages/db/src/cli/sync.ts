import { crossValidate, dataDir, loadArchive } from "@aafkstats/schema/load";
import { completeness, missingFields, toAafkPerspective } from "@aafkstats/schema";
import { connect } from "../index.js";

/**
 * Laster hele arkivet fra data/ inn i core, i én transaksjon.
 *
 * Full reload i stedet for inkrementell oppdatering: datasettet er lite nok til at det
 * går på sekunder, og det gjør synkroniseringen idempotent. Kjøres den to ganger blir
 * resultatet identisk, og en slettet YAML-fil forsvinner faktisk fra databasen —
 * noe en inkrementell oppsert ville oversett.
 */

const root = dataDir();
const archive = await loadArchive(root);
const issues = [...archive.issues, ...crossValidate(archive)];

if (issues.length > 0) {
  console.error(`✗ ${issues.length} valideringsfeil — kjør «pnpm validate» for detaljer.`);
  console.error("  Synkroniserer ikke: en halvgyldig database er verre enn en gammel.");
  process.exit(1);
}

if (archive.matches.length === 0 && archive.clubs.length === 0) {
  console.error(`✗ Fant ingen data i ${root}`);
  process.exit(1);
}

const sql = connect();

try {
  await sql.begin(async (tx) => {
    // Rekkefølgen følger fremmednøklene bakover.
    await tx.unsafe("TRUNCATE core.matches, core.seasons RESTART IDENTITY");
    await tx.unsafe("TRUNCATE core.clubs, core.venues, core.competitions, core.sources CASCADE");

    for (const c of archive.clubs) {
      await tx`INSERT INTO core.clubs ${tx({
        id: c.id,
        name: c.name,
        short_name: c.shortName ?? null,
        country: c.country,
        city: c.city ?? null,
        founded: c.founded ?? null,
        names: tx.json(c.names),
        aliases: tx.json(c.aliases),
        note: c.note ?? null,
      })}`;
    }

    for (const v of archive.venues) {
      await tx`INSERT INTO core.venues ${tx({
        id: v.id,
        name: v.name,
        city: v.city ?? null,
        country: v.country,
        capacity: v.capacity ?? null,
        opened: v.opened ?? null,
        closed: v.closed ?? null,
        names: tx.json(v.names),
        note: v.note ?? null,
      })}`;
    }

    for (const c of archive.competitions) {
      await tx`INSERT INTO core.competitions ${tx({
        id: c.id,
        name: c.name,
        type: c.type,
        tier: c.tier ?? null,
        organizer: c.organizer ?? null,
        country: c.country,
        names: tx.json(c.names),
        note: c.note ?? null,
      })}`;
    }

    for (const s of archive.sources) {
      await tx`INSERT INTO core.sources ${tx({
        id: s.id,
        name: s.name,
        url: s.url ?? null,
        priority: s.priority,
        license: s.license ?? null,
        note: s.note ?? null,
      })}`;
    }

    for (const s of archive.seasons) {
      await tx`INSERT INTO core.seasons ${tx({
        year: s.year,
        competition_id: s.competitionId,
        final_position: s.finalPosition,
        teams_in_league: s.teamsInLeague ?? null,
        head_coach: s.headCoach ?? null,
        promoted: s.promoted,
        relegated: s.relegated,
        note: s.note ?? null,
      })}`;
    }

    for (const m of archive.matches) {
      // Avledningen gjøres her, med samme funksjon som testene bruker — ikke i SQL.
      // Én implementasjon betyr at databasen og testene ikke kan bli uenige.
      const p = toAafkPerspective(m);

      await tx`INSERT INTO core.matches ${tx({
        id: m.id,
        match_date: m.date,
        date_confidence: m.dateConfidence,
        kickoff: m.kickoff ?? null,
        status: m.status,

        competition_id: m.competition.id,
        season: m.competition.season,
        stage: m.competition.stage,
        round: m.competition.round ?? null,
        leg: m.competition.leg ?? null,
        group_name: m.competition.groupName ?? null,

        home_club_id: m.home.clubId,
        away_club_id: m.away.clubId,
        home_score: m.home.score,
        away_score: m.away.score,
        home_ht_score: m.home.halfTimeScore,
        away_ht_score: m.away.halfTimeScore,
        home_et_score: m.extraTime?.home ?? null,
        away_et_score: m.extraTime?.away ?? null,
        home_pens: m.penaltyShootout?.home ?? null,
        away_pens: m.penaltyShootout?.away ?? null,

        venue_id: m.venueId ?? null,
        neutral_venue: m.neutralVenue,
        attendance: m.attendance ?? null,
        referee: m.referee ?? null,

        is_home: p.isHome,
        opponent_club_id: p.opponentClubId,
        aafk_score: p.aafkScore,
        opponent_score: p.opponentScore,
        goal_difference: p.goalDifference,
        result: p.result,
        decided_on_pens: p.decidedOnPenalties,
        won_on_pens: p.wonOnPenalties,

        events: tx.json(m.events),
        lineups: m.lineups ? tx.json(m.lineups) : null,
        stats: m.stats ? tx.json(m.stats) : null,
        report_summary: m.report?.summary ?? null,
        report_body: m.report?.body ?? null,
        report_byline: m.report?.byline ?? null,
        external_reports: tx.json(m.externalReports),
        sources: tx.json(m.sources),
        confidence: m.confidence,
        conflicts: tx.json(m.conflicts),
        tags: m.tags,
        aliases: tx.json(m.aliases),
        completeness: completeness(m),
        missing_fields: missingFields(m),
        note: m.note ?? null,
        source_file: m.file,
      })}`;
    }
  });

  const [{ count }] = await sql<{ count: string }[]>`SELECT count(*)::text FROM core.matches`;
  console.log(
    `✓ Synkronisert fra ${root}\n` +
      `  ${count} kamper · ${archive.seasons.length} sesonger · ${archive.clubs.length} klubber`,
  );
} catch (err) {
  console.error("✗ Synkronisering feilet:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
