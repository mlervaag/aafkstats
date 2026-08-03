import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { stringify } from "yaml";
import { match as matchSchema } from "@aafkstats/schema";
import type { Club, Match, Season, Venue } from "@aafkstats/schema";
import type { Archive } from "@aafkstats/schema/load";
import { matchId, slugify } from "./ids.js";
import type { SourceMatch } from "./types.js";

export interface ReconcileOptions {
  sourceId: string;
  competitionId: string;
  retrievedAt: string;
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
  value: Club | Venue | Season | Match;
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
    clubs.flatMap((club) => club.aliases[options.sourceId] === undefined
      ? []
      : [[String(club.aliases[options.sourceId]), club] as const]),
  );

  const resolveClub = (externalId: string, name: string): Club | undefined => {
    const byAlias = clubByExternalId().get(externalId);
    if (byAlias) return byAlias;
    const base = slugify(name);
    const nameMatches = clubs.filter((club) => {
      const candidates = [club.id, club.name, club.shortName, ...club.names.map((entry) => entry.name)]
        .filter((candidate): candidate is string => candidate !== undefined);
      return candidates.some((candidate) => clubKey(candidate) === clubKey(name));
    });
    const existing = clubs.find((club) => club.id === base) ?? (nameMatches.length === 1 ? nameMatches[0] : undefined);
    if (existing && existing.aliases[options.sourceId] === undefined) {
      existing.aliases[options.sourceId] = externalId;
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
    const club: Club = { id, name, names: [], country: "NO", aliases: { [options.sourceId]: externalId } };
    clubs.push(club);
    newClubs.add(id);
    return club;
  };

  const resolveVenue = (source: SourceMatch): Venue | undefined => {
    if (!source.venueName) return undefined;
    const slug = slugify(source.venueName);
    const existing = venues.find((venue) => venue.id === slug || venue.name.toLowerCase() === source.venueName?.toLowerCase());
    if (existing) return existing;
    const venue: Venue = {
      id: slug,
      name: source.venueName,
      names: [],
      city: source.venueCity,
      country: "NO",
      capacity: source.venueCapacity,
    };
    venues.push(venue);
    newVenues.add(venue.id);
    return venue;
  };

  const existingBySource = new Map(
    archive.matches.flatMap((match) => match.aliases[options.sourceId] === undefined
      ? []
      : [[String(match.aliases[options.sourceId]), match] as const]),
  );
  const existingById = new Map(archive.matches.map((match) => [match.id, match]));

  for (const source of sourceMatches) {
    const home = resolveClub(source.home.externalId, source.home.name);
    const away = resolveClub(source.away.externalId, source.away.name);
    if (!home || !away) continue;
    const venue = resolveVenue(source);
    const id = matchId(source.date, home.id, away.id);
    const bySource = existingBySource.get(source.externalId);
    const collision = existingById.get(id);
    if (!bySource && collision) {
      if (options.skipExisting) {
        skipped.push(id);
        continue;
      }
      issues.push(`${id}: finnes fra før uten ${options.sourceId}-alias; krever manuell reconcile`);
      continue;
    }

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
      sources: [{
        sourceId: options.sourceId,
        url: source.url,
        retrievedAt: options.retrievedAt,
        fields: source.fields,
        note: source.rawStatus ? `Kildestatus: ${source.rawStatus}` : undefined,
      }],
      confidence: "probable",
      note: source.note,
      aliases: { [options.sourceId]: source.externalId },
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
        value: { year: season, competitionId: options.competitionId, finalPosition: null, promoted: false, relegated: false },
        action: "create",
      });
    }
  }

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
    },
    skipped,
  };
}

/**
 * Normaliserer et klubbnavn til nøkkelen navnematchingen bruker.
 *
 * Eksportert fordi kilder uten egne klubb-ID-er må lage sine egne, og de må lages
 * på nøyaktig denne formen. Gjør de ikke det, gir «Kristiansund» og
 * «Kristiansund BK» hver sin ID for samme klubb, og den andre kolliderer med
 * aliaset den første la igjen.
 */
export function clubKey(value: string): string {
  return slugify(value).replace(/-(fotballklubb|fotball|fk|il|bk|sk)$/, "");
}

function mergeExisting(existingWithFile: Match & { file: string }, fresh: Match): Match {
  const { file: _file, ...existing } = existingWithFile;
  const freshSource = fresh.sources[0];
  const existingSource = freshSource
    ? existing.sources.find((source) => source.sourceId === freshSource.sourceId)
    : undefined;
  const freshFields = new Set(freshSource?.fields ?? []);
  const preservedFields = (existingSource?.fields ?? []).filter((field) => !freshFields.has(field));
  const mergedSource = freshSource
    ? { ...freshSource, fields: [...new Set([...freshSource.fields, ...preservedFields])] }
    : undefined;
  const sources = mergedSource
    ? existing.sources.some((source) => source.sourceId === mergedSource.sourceId)
      ? existing.sources.map((source) => source.sourceId === mergedSource.sourceId ? mergedSource : source)
      : [...existing.sources, mergedSource]
    : existing.sources;
  const merged: Match = {
    ...fresh,
    sources,
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
