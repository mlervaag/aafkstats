import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { club, competition, season, source, venue } from "./entities.js";
import { match } from "./match.js";
import { canonicalClubKey } from "./identity.js";
import type { Club, Competition, Season, Source, Venue } from "./entities.js";
import type { Match } from "./match.js";

/** Rota på monorepoet, utledet fra hvor denne filen ligger. */
export function repoRoot(): string {
  const here = fileURLToPath(new URL(".", import.meta.url));
  return resolve(here, "../../..");
}

/**
 * Rota på datakatalogen. Overstyres av AAFK_DATA_DIR i tester og verktøy.
 *
 * En relativ AAFK_DATA_DIR tolkes mot repo-rota, ikke mot cwd. Uten dette peker
 * `AAFK_DATA_DIR=fixtures/data pnpm validate` på feil sted, fordi pnpm kjører
 * skriptet med pakkemappen som cwd — og resultatet blir et tomt arkiv som består.
 */
export function dataDir(): string {
  const override = process.env.AAFK_DATA_DIR;
  if (override) return resolve(repoRoot(), override);
  return resolve(repoRoot(), "data");
}

export interface LoadIssue {
  file: string;
  path: string;
  message: string;
}

export interface Archive {
  clubs: Club[];
  venues: Venue[];
  competitions: Competition[];
  sources: Source[];
  seasons: (Season & { file: string })[];
  matches: (Match & { file: string })[];
  issues: LoadIssue[];
}

async function listYaml(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && (e.name.endsWith(".yaml") || e.name.endsWith(".yml")))
    .map((e) => join(dir, e.name))
    .sort();
}

async function parseFile<T extends z.ZodTypeAny>(
  file: string,
  schema: T,
  root: string,
  issues: LoadIssue[],
): Promise<z.infer<T> | null> {
  const rel = relative(root, file);
  let raw: unknown;
  try {
    // 'core' holder oss på YAML 1.2, der datoer forblir strenger. Uten dette blir
    // datoer noen ganger Date og noen ganger streng avhengig av sitattegn i filen.
    raw = parseYaml(await readFile(file, "utf8"), { schema: "core" });
  } catch (err) {
    issues.push({ file: rel, path: "", message: `kunne ikke lese YAML: ${String(err)}` });
    return null;
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({ file: rel, path: issue.path.join("."), message: issue.message });
    }
    return null;
  }
  return parsed.data;
}

/**
 * Leser hele arkivet fra disk og validerer hver fil.
 *
 * Returnerer alltid — feil samles i `issues` i stedet for å kaste, slik at én ødelagt
 * fil ikke skjuler alle de andre. Kalleren avgjør om `issues` er fatalt.
 */
export async function loadArchive(root = dataDir()): Promise<Archive> {
  const issues: LoadIssue[] = [];

  const readAll = async <T extends z.ZodTypeAny>(dir: string, schema: T) => {
    const files = await listYaml(join(root, dir));
    const out: z.infer<T>[] = [];
    for (const file of files) {
      const parsed = await parseFile(file, schema, root, issues);
      if (parsed !== null) out.push(parsed);
    }
    return out;
  };

  const clubs = await readAll("clubs", club);
  const venues = await readAll("venues", venue);
  const competitions = await readAll("competitions", competition);
  const sources = await readAll("sources", source);

  const seasons: (Season & { file: string })[] = [];
  const matches: (Match & { file: string })[] = [];

  const seasonsDir = join(root, "seasons");
  if (existsSync(seasonsDir)) {
    const seasonDirs = (await readdir(seasonsDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    for (const dir of seasonDirs) {
      const seasonPath = join(seasonsDir, dir, "season.yaml");
      if (existsSync(seasonPath)) {
        const parsed = await parseFile(seasonPath, season, root, issues);
        if (parsed !== null) {
          if (String(parsed.year) !== dir) {
            issues.push({
              file: relative(root, seasonPath),
              path: "year",
              message: `år ${parsed.year} stemmer ikke med mappenavnet «${dir}»`,
            });
          }
          seasons.push({ ...parsed, file: relative(root, seasonPath) });
        }
      }

      for (const file of await listYaml(join(seasonsDir, dir, "matches"))) {
        const parsed = await parseFile(file, match, root, issues);
        if (parsed === null) continue;
        const rel = relative(root, file);
        const expectedName = `${parsed.id}.yaml`;
        if (basename(file) !== expectedName) {
          issues.push({
            file: rel,
            path: "id",
            message: `filnavnet må være «${expectedName}» (ID-en er filnavnet)`,
          });
        }
        if (String(parsed.competition.season) !== dir) {
          issues.push({
            file: rel,
            path: "competition.season",
            message: `sesong ${parsed.competition.season} stemmer ikke med mappen «${dir}»`,
          });
        }
        matches.push({ ...parsed, file: rel });
      }
    }
  }

  return { clubs, venues, competitions, sources, seasons, matches, issues };
}

/**
 * Referanseintegritet og unikhet.
 *
 * Zod validerer hver fil for seg; dette er kontrollene som bare kan gjøres når hele
 * arkivet er lest — at hver `clubId` finnes, at ingen ID er brukt to ganger, og at
 * ingen kamp er registrert to ganger under ulike ID-er.
 */
export function crossValidate(archive: Archive): LoadIssue[] {
  const issues: LoadIssue[] = [];
  const ids = <T extends { id: string }>(xs: T[]) => new Set(xs.map((x) => x.id));

  const clubIds = ids(archive.clubs);
  const venueIds = ids(archive.venues);
  const competitionIds = ids(archive.competitions);
  const sourceIds = ids(archive.sources);

  const duplicates = <T extends { id: string }>(xs: T[], kind: string) => {
    const seen = new Set<string>();
    for (const x of xs) {
      if (seen.has(x.id)) {
        issues.push({ file: `${kind}/${x.id}.yaml`, path: "id", message: `duplikat ID «${x.id}»` });
      }
      seen.add(x.id);
    }
  };
  duplicates(archive.clubs, "clubs");
  duplicates(archive.venues, "venues");
  duplicates(archive.competitions, "competitions");
  duplicates(archive.sources, "sources");

  // Klubber som normaliserer til samme identitet er nesten alltid samme klubb
  // ført to ganger, fordi én kilde skriver «FK Haugesund» og en annen «Haugesund».
  // Dette rapporteres, ikke slås sammen: en sammenslåing for mye gir gale tall
  // uten at noe feiler, mens en dublett som står er synlig og rettbar.
  const clubsByIdentity = new Map<string, Club[]>();
  for (const club of archive.clubs) {
    const key = canonicalClubKey(club);
    clubsByIdentity.set(key, [...(clubsByIdentity.get(key) ?? []), club]);
  }
  for (const [key, group] of clubsByIdentity) {
    if (group.length < 2) continue;
    const names = group.map((club) => `${club.id} («${club.name}»)`).join(", ");
    for (const club of group) {
      issues.push({
        file: `clubs/${club.id}.yaml`,
        path: "name",
        message: `samme klubbidentitet «${key}» som ${names} — slå dem sammen, og la kortformen bli et kildealias`,
      });
    }
  }

  // Klubb-ID → kanonisk identitet, slik at kamper ført på hver sin ID for samme
  // klubb gir samme nøkkel under.
  const identityOf = new Map(archive.clubs.map((club) => [club.id, canonicalClubKey(club)]));

  const seenMatchIds = new Set<string>();
  // Samme dato + samme motstander betyr nesten alltid at kampen er lagt inn to ganger,
  // typisk fordi to kilder brukte ulik navnerekkefølge i slugen — eller ulik
  // skrivemåte av klubbnavnet, som er grunnen til at nøkkelen bruker kanonisk
  // identitet og ikke klubb-ID.
  const seenFixtures = new Map<string, string>();

  for (const m of archive.matches) {
    const at = (path: string, message: string) => issues.push({ file: m.file, path, message });

    if (seenMatchIds.has(m.id)) at("id", `duplikat kamp-ID «${m.id}»`);
    seenMatchIds.add(m.id);

    const sides = [m.home.clubId, m.away.clubId].map((id) => identityOf.get(id) ?? id);
    const fixtureKey = `${m.date}|${sides.sort().join("|")}`;
    const existing = seenFixtures.get(fixtureKey);
    if (existing !== undefined && existing !== m.file) {
      at("date", `samme dato og motstander som ${existing} — er dette samme kamp?`);
    }
    seenFixtures.set(fixtureKey, m.file);

    for (const clubId of [m.home.clubId, m.away.clubId]) {
      if (!clubIds.has(clubId)) at("clubId", `ukjent klubb «${clubId}» — mangler data/clubs/${clubId}.yaml`);
    }
    if (m.venueId !== undefined && !venueIds.has(m.venueId)) {
      at("venueId", `ukjent stadion «${m.venueId}» — mangler data/venues/${m.venueId}.yaml`);
    }
    if (!competitionIds.has(m.competition.id)) {
      at("competition.id", `ukjent konkurranse «${m.competition.id}»`);
    }
    for (const s of m.sources) {
      if (!sourceIds.has(s.sourceId)) {
        at("sources", `ukjent kilde «${s.sourceId}» — mangler data/sources/${s.sourceId}.yaml`);
      }
    }
    for (const c of m.conflicts) {
      for (const v of c.values) {
        if (!sourceIds.has(v.sourceId)) {
          at("conflicts", `ukjent kilde «${v.sourceId}» i konflikt på feltet «${c.field}»`);
        }
      }
    }
  }

  for (const s of archive.seasons) {
    if (!competitionIds.has(s.competitionId)) {
      issues.push({
        file: s.file,
        path: "competitionId",
        message: `ukjent konkurranse «${s.competitionId}»`,
      });
    }
  }

  return issues;
}
