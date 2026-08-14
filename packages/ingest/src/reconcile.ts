import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { stringify } from "yaml";
import { match as matchSchema, observation as observationSchema, observationPath, payloadHash } from "@aafkstats/schema";
import type { Club, Match, Observation, ObservationValue, Season, Venue } from "@aafkstats/schema";
import type { Archive } from "@aafkstats/schema/load";
import { clubKey, clubNameForms, matchId, slugify } from "./ids.js";

// Re-eksportert fordi adaptere importerer clubKey herfra. Definisjonen ligger i
// @aafkstats/schema, slik at valideringen bruker nøyaktig samme regel.
export { clubKey } from "./ids.js";
import type { SourceMatch } from "./types.js";

export interface ReconcileOptions {
  providerId: string;
  competitionId: string;
  retrievedAt: string;
  /**
   * Hvilken adapter som leste kilden, med versjon: `rsssf@1`.
   *
   * Står i hver observasjon. Uten den er en verdi fra en adapter med en kjent
   * parsefeil ikke til å skille fra en fra den rettede, og en omkjøring etter
   * rettelsen kan ikke begrunne hvorfor den endret noe.
   */
  adapter?: string;
  /**
   * La kamper en annen kilde allerede eier stå i fred, i stedet for å stoppe
   * kjøringen.
   *
   * Standard er å stoppe: to kilder på samme kamp krever et observasjonslag som
   * ikke er bygget ennå, og en stille sammenslåing ville skjult hvem som mente
   * hva. Men når en kilde kan fylle hullene i en sesong en annen kilde bare har
   * halve av, er det bortkastet å nekte hele kjøringen. Da hoppes de overlappende
   * kampene over og telles, mens de nye skrives. Hver kamp har fortsatt nøyaktig
   * én kilde — dette er en oppdeling per kamp, ikke en sammenslåing.
   */
  skipExisting?: boolean;
}

export interface PlannedFile {
  relativePath: string;
  value: Club | Venue | Season | Match | Observation;
  action: "create" | "update";
}

export interface ReconcilePlan {
  files: PlannedFile[];
  issues: string[];
  /** Kamp-ID-er en annen kilde eier, hoppet over fordi `skipExisting` var satt. */
  skipped: string[];
  summary: {
    matchesCreated: number;
    matchesUpdated: number;
    clubsCreated: number;
    clubsUpdated: number;
    venuesCreated: number;
    seasonsCreated: number;
    matchesSkipped: number;
    observationsWritten: number;
  };
}

/**
 * Lager en deterministisk skriveplan. Tvetydige treff blir issues og skrives ikke.
 * Eksisterende kamper oppdateres bare når de allerede har samme kilde-ID.
 */
export function reconcile(
  archive: Archive,
  sourceMatches: SourceMatch[],
  options: ReconcileOptions,
): ReconcilePlan {
  const files: PlannedFile[] = [];
  const issues: string[] = [];
  const skipped: string[] = [];
  const clubs = archive.clubs.map((club) => structuredClone(club));
  const venues = archive.venues.map((venue) => structuredClone(venue));
  const clubFiles = new Map(archive.clubs.map((club) => [club.id, `clubs/${club.id}.yaml`]));
  const changedClubs = new Set<string>();
  const newClubs = new Set<string>();
  const newVenues = new Set<string>();

  const clubByExternalId = () => new Map(
    clubs.flatMap((club) => club.aliases[options.providerId] === undefined
      ? []
      : [[String(club.aliases[options.providerId]), club] as const]),
  );

  const resolveClub = (externalId: string, name: string): Club | undefined => {
    const byAlias = clubByExternalId().get(externalId);
    if (byAlias) return byAlias;
    const base = slugify(name);
    const nameMatches = clubs.filter((club) =>
      clubNameForms(club).some((candidate) => clubKey(candidate) === clubKey(name)),
    );
    const existing = clubs.find((club) => club.id === base) ?? (nameMatches.length === 1 ? nameMatches[0] : undefined);
    if (existing && existing.aliases[options.providerId] === undefined) {
      existing.aliases[options.providerId] = externalId;
      changedClubs.add(existing.id);
      return existing;
    }
    if (existing) {
      issues.push(`klubb-ID ${externalId} (${name}) kolliderer med ${existing.id}`);
      return undefined;
    }
    let id = base;
    let suffix = 2;
    while (clubs.some((club) => club.id === id)) id = `${base}-${suffix++}`;
    const sourceTeam = sourceMatches
      .flatMap((match) => [match.home, match.away])
      .find((team) => team.externalId === externalId);
    const club: Club = {
      id,
      name,
      nameVariants: [],
      names: [],
      country: sourceTeam?.country ?? "NO",
      aliases: { [options.providerId]: externalId },
      sources: [],
    };
    clubs.push(club);
    newClubs.add(id);
    return club;
  };

  const resolveVenue = (source: SourceMatch): Venue | undefined => {
    if (!source.venueName || source.venueReliable === false) return undefined;
    const slug = slugify(source.venueName);
    const existing = venues.find((venue) => venue.id === slug || venue.name.toLowerCase() === source.venueName?.toLowerCase());
    if (existing) return existing;
    const venue: Venue = {
      id: slug,
      name: source.venueName,
      names: [],
      city: source.venueCity,
      country: source.venueCountry ?? "NO",
      capacity: source.venueCapacity,
      surfaceHistory: [],
      homePeriods: [],
      attendanceRecords: [],
      events: [],
      sources: [],
    };
    venues.push(venue);
    newVenues.add(venue.id);
    return venue;
  };

  const existingBySource = new Map(
    archive.matches.flatMap((match) => match.aliases[options.providerId] === undefined
      ? []
      : [[String(match.aliases[options.providerId]), match] as const]),
  );
  const existingById = new Map(archive.matches.map((match) => [match.id, match]));

  // Observasjonene samles for seg og legges bakerst, slik at én kilde som ser
  // en kamp den ikke får plassert likevel setter spor. Uten det ville nettopp de
  // vanskeligste tilfellene vært de eneste uten dokumentasjon.
  const observations: PlannedFile[] = [];
  const existingObservations = new Set(
    archive.observations.map((entry) => `${entry.providerId}|${entry.externalId}`),
  );
  const observe = (
    source: SourceMatch,
    resolved: { matchId: string | null; homeClubId?: string; awayClubId?: string; venueId?: string },
  ) => {
    const raw = compact({
      externalId: source.externalId,
      date: source.date,
      kickoff: source.kickoff,
      status: source.rawStatus ?? source.status,
      home: source.home.name,
      homeId: source.home.externalId,
      away: source.away.name,
      awayId: source.away.externalId,
      homeScore: source.homeScore,
      awayScore: source.awayScore,
      homeHalfTime: source.homeHalfTime,
      awayHalfTime: source.awayHalfTime,
      competition: source.competitionName,
      competitionId: source.competitionExternalId,
      season: source.season,
      round: source.round,
      stage: source.stage,
      venue: source.venueName,
      attendance: source.attendance,
      referee: source.referee,
      url: source.url,
    });
    const normalized = compact({
      date: source.date,
      kickoff: source.kickoff,
      status: source.status,
      "home.clubId": resolved.homeClubId,
      "away.clubId": resolved.awayClubId,
      "home.score": source.homeScore,
      "away.score": source.awayScore,
      "home.halfTimeScore": source.homeHalfTime,
      "away.halfTimeScore": source.awayHalfTime,
      "competition.id": options.competitionId,
      "competition.season": source.season,
      "competition.round": source.round,
      "competition.stage": source.stage ?? "regular_season",
      venueId: resolved.venueId,
      attendance: source.attendance,
      "referee.name": source.referee,
    });
    const relativePath = observationPath(options.providerId, source.externalId);
    observations.push({
      relativePath,
      value: observationSchema.parse({
        providerId: options.providerId,
        externalId: source.externalId,
        matchId: resolved.matchId,
        retrievedAt: options.retrievedAt,
        adapter: options.adapter ?? `${options.providerId}@1`,
        payloadHash: payloadHash(raw),
        raw,
        normalized,
        fields: source.fields,
        warnings: source.warnings ?? [],
      } satisfies Observation),
      action: existingObservations.has(`${options.providerId}|${source.externalId}`) ? "update" : "create",
    });
  };

  for (const source of sourceMatches) {
    const home = resolveClub(source.home.externalId, source.home.name);
    const away = resolveClub(source.away.externalId, source.away.name);
    if (!home || !away) {
      observe(source, { matchId: null, homeClubId: home?.id, awayClubId: away?.id });
      continue;
    }
    const venue = resolveVenue(source);
    const id = matchId(source.date, home.id, away.id);
    const resolved = { matchId: id, homeClubId: home.id, awayClubId: away.id, venueId: venue?.id };
    const bySource = existingBySource.get(source.externalId);
    const collision = existingById.get(id);
    if (!bySource && collision) {
      // Kampen skrives ikke, men observasjonen skrives. Det er hele grunnen til
      // at laget finnes: at kilde nummer to sa noe om en kamp kilde nummer én
      // eier, er en opplysning, ikke støy å kaste.
      observe(source, resolved);
      if (options.skipExisting) {
        skipped.push(id);
        continue;
      }
      issues.push(`${id}: finnes fra før uten ${options.providerId}-alias; krever manuell reconcile`);
      continue;
    }
    observe(source, resolved);

    // Adapteren så noe den ikke turde tolke. Det løftes til et kontrollpunkt her,
    // slik at kampen stopper skrivingen framfor å bli skrevet på en gjetning.
    for (const warning of source.warnings ?? []) {
      issues.push(`${id}: ${warning}`);
    }

    const fresh = matchSchema.parse({
      id,
      date: source.date,
      kickoff: source.kickoff,
      status: source.status,
      competition: {
        id: options.competitionId,
        season: source.season,
        stage: source.stage ?? "regular_season",
        round: source.round,
      },
      home: {
        clubId: home.id,
        score: source.homeScore ?? null,
        halfTimeScore: source.homeHalfTime ?? null,
      },
      away: {
        clubId: away.id,
        score: source.awayScore ?? null,
        halfTimeScore: source.awayHalfTime ?? null,
      },
      extraTime: source.extraTime,
      penaltyShootout: source.penaltyShootout,
      venueId: venue?.id,
      attendance: source.attendance,
      referee: source.referee,
      events: source.events ?? [],
      lineups: source.lineups,
      stats: source.stats,
      providers: [{
        providerId: options.providerId,
        url: source.url,
        retrievedAt: options.retrievedAt,
        fields: source.fields,
        note: source.rawStatus ? `Kildestatus: ${source.rawStatus}` : undefined,
      }],
      confidence: "probable",
      note: source.note,
      aliases: { [options.providerId]: source.externalId },
    });

    const value = bySource ? mergeExisting(bySource, fresh) : fresh;
    files.push({
      relativePath: `seasons/${source.season}/matches/${value.id}.yaml`,
      value,
      action: bySource ? "update" : "create",
    });
  }

  for (const id of [...newClubs, ...changedClubs].sort()) {
    const value = clubs.find((club) => club.id === id)!;
    files.push({ relativePath: clubFiles.get(id) ?? `clubs/${id}.yaml`, value, action: newClubs.has(id) ? "create" : "update" });
  }
  for (const id of [...newVenues].sort()) {
    files.push({ relativePath: `venues/${id}.yaml`, value: venues.find((venue) => venue.id === id)!, action: "create" });
  }
  for (const season of [...new Set(sourceMatches.map((match) => match.season))]) {
    if (!archive.seasons.some((entry) => entry.year === season)) {
      files.push({
        relativePath: `seasons/${season}/season.yaml`,
        value: { year: season, competitionId: options.competitionId, finalPosition: null, sources: [], promoted: false, relegated: false },
        action: "create",
      });
    }
  }

  files.push(...observations);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return {
    files,
    issues,
    summary: {
      matchesCreated: files.filter((file) => file.relativePath.includes("/matches/") && file.action === "create").length,
      matchesUpdated: files.filter((file) => file.relativePath.includes("/matches/") && file.action === "update").length,
      clubsCreated: newClubs.size,
      clubsUpdated: changedClubs.size,
      venuesCreated: newVenues.size,
      seasonsCreated: files.filter((file) => /seasons\/\d+\/season\.yaml$/.test(file.relativePath)).length,
      matchesSkipped: skipped.length,
      observationsWritten: observations.length,
    },
    skipped,
  };
}

/**
 * Dropper feltene kilden ikke hadde.
 *
 * `undefined` og `null` er ikke det samme her: en observasjon uten `attendance`
 * betyr at kilden ikke sa noe om tilskuertallet, mens `attendance: null` ville
 * betydd at den påsto at tallet ikke finnes. Bare det første er sant.
 */
function compact(values: Record<string, ObservationValue | undefined>): Record<string, ObservationValue> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== null),
  ) as Record<string, ObservationValue>;
}

function mergeExisting(existingWithFile: Match & { file: string }, fresh: Match): Match {
  const { file: _file, ...existing } = existingWithFile;
  const freshProvider = fresh.providers[0];
  const existingSource = freshProvider
    ? existing.providers.find((source) => source.providerId === freshProvider.providerId)
    : undefined;
  const freshFields = new Set(freshProvider?.fields ?? []);
  const preservedFields = (existingSource?.fields ?? []).filter((field) => !freshFields.has(field));
  const mergedProvider = freshProvider
    ? { ...freshProvider, fields: [...new Set([...freshProvider.fields, ...preservedFields])] }
    : undefined;
  const providers = mergedProvider
    ? existing.providers.some((source) => source.providerId === mergedProvider.providerId)
      ? existing.providers.map((source) => source.providerId === mergedProvider.providerId ? mergedProvider : source)
      : [...existing.providers, mergedProvider]
    : existing.providers;
  const merged: Match = {
    ...fresh,
    providers,
    report: existing.report,
    externalReports: existing.externalReports,
    conflicts: existing.conflicts,
    tags: existing.tags,
    manual: existing.manual,
    note: existing.note,
  };
  for (const path of preservedFields) copyPath(existing, merged, path);
  for (const path of existing.manual) copyPath(existing, merged, path);
  return matchSchema.parse(merged);
}

function copyPath(from: object, to: object, path: string): void {
  const parts = path.split(".");
  let source: unknown = from;
  let target: Record<string, unknown> = to as Record<string, unknown>;
  for (const [index, part] of parts.entries()) {
    if (!source || typeof source !== "object") return;
    const value = (source as Record<string, unknown>)[part];
    if (index === parts.length - 1) {
      target[part] = structuredClone(value);
      return;
    }
    if (!target[part] || typeof target[part] !== "object") target[part] = {};
    target = target[part] as Record<string, unknown>;
    source = value;
  }
}

export async function writePlan(root: string, plan: ReconcilePlan): Promise<void> {
  if (plan.issues.length > 0) throw new Error(`skriver ikke en plan med ${plan.issues.length} uløste problemer`);
  for (const file of plan.files) {
    const absolute = resolve(root, file.relativePath);
    await mkdir(dirname(absolute), { recursive: true });
    const yaml = stringify(file.value, { lineWidth: 0, defaultStringType: "PLAIN" });
    await writeFile(absolute, yaml, "utf8");
  }
}
