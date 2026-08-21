import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { club, competition, season, provider, venue } from "./entities.js";
import { match } from "./match.js";
import { canonicalClubKey, personKey } from "./identity.js";
import { observation, observationPath } from "./observation.js";
import { person } from "./person.js";
import { organization, organizationSnapshot, organizationSnapshotPath } from "./organization.js";
import { standings, standingsPath } from "./standings.js";
import type { Club, Competition, Season, Provider, Venue } from "./entities.js";
import type { Match } from "./match.js";
import type { Observation } from "./observation.js";
import { historicalObservation } from "./historical-observation.js";
import type { HistoricalObservation } from "./historical-observation.js";
import type { Person } from "./person.js";
import type { Organization, OrganizationSnapshot } from "./organization.js";
import type { Standings } from "./standings.js";
import { contribution } from "./contribution.js";
import type { Contribution } from "./contribution.js";
import { source as historicalSource } from "./source.js";
import type { Source as HistoricalSource } from "./source.js";
import { publicationExtraction } from "./extraction.js";
import type { PublicationExtraction } from "./extraction.js";
import { flattenSourceResults, sourceResultCollection } from "./source-result.js";
import type { SourceResult, SourceResultCollection } from "./source-result.js";
import { verificationCaseInput, verificationRevision } from "./verification-case.js";
import type { VerificationCase, VerificationCaseInput } from "./verification-case.js";
import {
  generateNewspaperVerificationCases,
  newspaperVerificationCandidateManifest,
} from "./newspaper-verification-candidates.js";
import { harvestBatchManifest } from "./historical/harvest-manifest.js";
import type { HarvestBatchManifest } from "./historical/harvest-manifest.js";

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
  providers: Provider[];
  seasons: (Season & { file: string })[];
  matches: (Match & { file: string })[];
  /**
   * Hva hver kilde faktisk sa, før normalisering. Tom for kamper som ble hentet
   * inn før laget fantes; se `observation.ts`.
   */
  observations: (Observation & { file: string })[];
  /** Redaksjonelt kontrollerte, kildeførte historiske fakta og hendelser. */
  historicalObservations: (HistoricalObservation & { file: string })[];
  /** Sluttabeller per konkurranse og sesong. Tom for år ingen kilde har tabell for. */
  standings: (Standings & { file: string })[];
  /**
   * Personer det er noe å si om. De fleste som har spilt finnes bare som et navn
   * i en oppstilling, og har ingen fil her.
   */
  people: Person[];
  organizations: Organization[];
  organizationSnapshots: (OrganizationSnapshot & { file: string })[];
  contributions: (Contribution & { file: string })[];
  sources: (HistoricalSource & { file: string })[];
  extractions: (PublicationExtraction & { file: string })[];
  sourceResults: (SourceResultCollection & { file: string })[];
  harvests: (HarvestBatchManifest & { file: string })[];
  /** Konkrete JA/NEI-saker som er redaksjonelt klare for community-kontroll. */
  verificationCases: VerificationCase[];
  issues: LoadIssue[];
}

async function listYaml(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => (e.isFile() || e.isSymbolicLink()) && (e.name.endsWith(".yaml") || e.name.endsWith(".yml")))
    .map((e) => join(dir, e.name))
    .sort();
}

async function parseFile<T extends z.ZodTypeAny>(
  file: string,
  schema: T,
  root: string,
  issues: LoadIssue[],
): Promise<z.infer<T> | null> {
  const rel = relative(root, file).replace(/\\/g, "/");
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
  const people = await readAll("people", person);
  const organizations = await readAll("organizations", organization);
  const venues = await readAll("venues", venue);
  const competitions = await readAll("competitions", competition);
  const providers = await readAll("providers", provider);

  const organizationSnapshots = (await readAll("organization/snapshots", organizationSnapshot)) as
    (OrganizationSnapshot & { file: string })[];
  for (const snapshot of organizationSnapshots) {
    snapshot.file = organizationSnapshotPath(snapshot.date, snapshot.organizationId);
  }

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
              file: relative(root, seasonPath).replace(/\\/g, "/"),
              path: "year",
              message: `år ${parsed.year} stemmer ikke med mappenavnet «${dir}»`,
            });
          }
          seasons.push({ ...parsed, file: relative(root, seasonPath).replace(/\\/g, "/") });
        }
      }

      for (const file of await listYaml(join(seasonsDir, dir, "matches"))) {
        const parsed = await parseFile(file, match, root, issues);
        if (parsed === null) continue;
        const rel = relative(root, file).replace(/\\/g, "/");
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

  // Observasjonene ligger under én mappe per kilde. Stien er utledet av
  // providerId og externalId, og kontrolleres her — ligger fila et annet sted,
  // finner ikke neste kjøring den igjen, og kilden blir ført to ganger.
  const observations: (Observation & { file: string })[] = [];
  const observationsDir = join(root, "observations");
  if (existsSync(observationsDir)) {
    const sourceDirs = (await readdir(observationsDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    for (const dir of sourceDirs) {
      for (const file of await listYaml(join(observationsDir, dir))) {
        const parsed = await parseFile(file, observation, root, issues);
        if (parsed === null) continue;
        const rel = relative(root, file).replace(/\\/g, "/");
        const expected = observationPath(parsed.providerId, parsed.externalId);
        if (rel !== expected) {
          issues.push({ file: rel, path: "externalId", message: `fila må hete «${expected}»` });
        }
        observations.push({ ...parsed, file: rel });
      }
    }
  }

  const historicalObservations: (HistoricalObservation & { file: string })[] = [];
  for (const file of await listYaml(observationsDir)) {
    const parsed = await parseFile(file, historicalObservation, root, issues);
    if (parsed === null) continue;
    const rel = relative(root, file).replace(/\\/g, "/");
    const expected = `observations/${parsed.id}.yaml`;
    if (rel !== expected) issues.push({ file: rel, path: "id", message: `fila må hete «${expected}»` });
    historicalObservations.push({ ...parsed, file: rel });
  }

  // Tabellene ligger under én mappe per konkurranse, som kampene ligger under én
  // mappe per sesong. Stien kontrolleres av samme grunn som for observasjoner:
  // en fil på feil sted blir aldri funnet igjen.
  const tables: (Standings & { file: string })[] = [];
  const standingsDir = join(root, "standings");
  if (existsSync(standingsDir)) {
    const competitionDirs = (await readdir(standingsDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    for (const dir of competitionDirs) {
      for (const file of await listYaml(join(standingsDir, dir))) {
        const parsed = await parseFile(file, standings, root, issues);
        if (parsed === null) continue;
        const rel = relative(root, file).replace(/\\/g, "/");
        const expected = standingsPath(parsed.competitionId, parsed.season);
        if (rel !== expected) {
          issues.push({ file: rel, path: "season", message: `fila må hete «${expected}»` });
        }
        tables.push({ ...parsed, file: rel });
      }
    }
  }

  const contributions = (await readAll("contributions", contribution)) as (Contribution & { file: string })[];
  for (const c of contributions) {
    c.file = relative(root, join(root, "contributions", `${c.id}.yaml`)).replace(/\\/g, "/");
  }

  const sources = (await readAll("sources", historicalSource)) as (HistoricalSource & { file: string })[];
  for (const p of sources) {
    p.file = relative(root, join(root, "sources", `${p.id}.yaml`)).replace(/\\/g, "/");
  }

  const extractions = (await readAll("extractions", publicationExtraction)) as (PublicationExtraction & { file: string })[];
  for (const extraction of extractions) {
    extraction.file = relative(root, join(root, "extractions", `${extraction.sourceId}.yaml`)).replace(/\\/g, "/");
  }

  const sourceResults = (await readAll("source-results", sourceResultCollection)) as (SourceResultCollection & { file: string })[];
  for (const collection of sourceResults) {
    collection.file = relative(root, join(root, "source-results", `${collection.sourceId}.yaml`)).replace(/\\/g, "/");
  }

  const harvests = (await readAll("harvests", harvestBatchManifest)) as (HarvestBatchManifest & { file: string })[];
  for (const harvest of harvests) {
    harvest.file = relative(root, join(root, "harvests", `${harvest.id}.yaml`)).replace(/\\/g, "/");
  }

  const manualCaseInputs = (await readAll("verification-cases", verificationCaseInput)) as VerificationCaseInput[];
  const generatedCaseInputs: VerificationCaseInput[] = [];
  const communityQueueFile = join(root, "discovery", "community-candidate-queue.yaml");
  if (existsSync(communityQueueFile)) {
    const manifest = await parseFile(
      communityQueueFile,
      newspaperVerificationCandidateManifest,
      root,
      issues,
    );
    if (manifest !== null) {
      generatedCaseInputs.push(
        ...generateNewspaperVerificationCases(manifest, manualCaseInputs).cases,
      );
    }
  }
  const caseInputs = [...manualCaseInputs, ...generatedCaseInputs];
  const verificationCases: VerificationCase[] = caseInputs.map((entry) => ({
    ...entry,
    revision: verificationRevision(entry),
    file: manualCaseInputs.includes(entry)
      ? `verification-cases/${entry.id}.yaml`
      : `discovery/community-candidate-queue.yaml#${entry.newspaper?.candidateId ?? entry.id}`,
  }));

  return { clubs, venues, competitions, providers, seasons, matches, observations, historicalObservations, standings: tables, people, organizations, organizationSnapshots, contributions, sources, extractions, sourceResults, harvests, verificationCases, issues };
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
  const providerIds = ids(archive.providers);
  const sourceIds = ids(archive.sources);
  const organizationIds = ids(archive.organizations);
  const personIds = ids(archive.people);

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
  duplicates(archive.providers, "providers");
  duplicates(archive.contributions, "contributions");
  duplicates(archive.sources, "sources");
  duplicates(archive.verificationCases, "verification-cases");
  duplicates(archive.organizations, "organizations");
  duplicates(archive.historicalObservations, "observations");
  duplicates(archive.harvests, "harvests");

  for (const snapshot of archive.organizationSnapshots) {
    const file = organizationSnapshotPath(snapshot.date, snapshot.organizationId);
    if (!organizationIds.has(snapshot.organizationId)) {
      issues.push({ file, path: "organizationId", message: `ukjent organisasjon «${snapshot.organizationId}»` });
    }
    for (const ref of snapshot.sources) {
      if (!sourceIds.has(ref.sourceId)) {
        issues.push({ file, path: "sources", message: `ukjent historisk kilde «${ref.sourceId}»` });
      }
    }
    for (const [index, observed] of snapshot.people.entries()) {
      if (!personIds.has(observed.personId)) {
        issues.push({ file, path: `people.${index}.personId`, message: `ukjent person «${observed.personId}»` });
      }
    }
  }

  for (const club of archive.clubs) {
    for (const ref of club.sources) {
      if (!sourceIds.has(ref.sourceId)) {
        issues.push({ file: `clubs/${club.id}.yaml`, path: "sources", message: `ukjent historisk kilde «${ref.sourceId}»` });
      }
    }
  }
  for (const venue of archive.venues) {
    const refs = [
      ...venue.sources,
      ...venue.surfaceHistory.flatMap((period) => period.sources),
      ...venue.homePeriods.flatMap((period) => period.sources),
      ...venue.attendanceRecords.flatMap((record) => record.sources),
      ...venue.events.flatMap((event) => event.sources),
    ];
    for (const ref of refs) {
      if (!sourceIds.has(ref.sourceId)) {
        issues.push({ file: `venues/${venue.id}.yaml`, path: "sources", message: `ukjent historisk kilde «${ref.sourceId}»` });
      }
    }
    for (const period of venue.homePeriods) {
      if (!clubIds.has(period.clubId)) {
        issues.push({ file: `venues/${venue.id}.yaml`, path: "homePeriods.clubId", message: `ukjent klubb «${period.clubId}»` });
      }
    }
  }

  const matchIds = ids(archive.matches);
  const seasonYears = new Set(archive.seasons.map((entry) => entry.year));
  for (const observation of archive.historicalObservations) {
    const at = (path: string, message: string) => issues.push({ file: observation.file, path, message });
    for (const ref of observation.sources) if (!sourceIds.has(ref.sourceId)) at("sources", `ukjent historisk kilde «${ref.sourceId}»`);
    for (const personId of observation.personIds) if (!personIds.has(personId)) at("personIds", `ukjent person «${personId}»`);
    for (const season of observation.seasonYears) if (!seasonYears.has(season)) at("seasonYears", `ukjent sesong «${season}»`);
    for (const matchId of observation.matchIds) if (!matchIds.has(matchId)) at("matchIds", `ukjent kamp «${matchId}»`);
    for (const competitionId of observation.competitionIds) if (!competitionIds.has(competitionId)) at("competitionIds", `ukjent konkurranse «${competitionId}»`);
    for (const venueId of observation.venueIds) if (!venueIds.has(venueId)) at("venueIds", `ukjent bane «${venueId}»`);
  }
  const caseFingerprints = new Map<string, string>();
  const newspaperFingerprints = new Map<string, string>();
  for (const item of archive.verificationCases) {
    const at = (path: string, message: string) => issues.push({ file: item.file, path, message });
    const targetIds: Record<typeof item.target.type, Set<string>> = {
      person: personIds,
      match: matchIds,
      season: new Set(archive.seasons.map((entry) => String(entry.year))),
      club: clubIds,
      source: sourceIds,
    };
    if (!targetIds[item.target.type].has(item.target.id)) {
      at("target.id", `ukjent ${item.target.type} «${item.target.id}»`);
    }
    for (const [index, ref] of item.sources.entries()) {
      if (ref.sourceId && !sourceIds.has(ref.sourceId)) {
        at(`sources.${index}.sourceId`, `ukjent historisk kilde «${ref.sourceId}»`);
      }
      if (ref.providerId && !providerIds.has(ref.providerId)) {
        at(`sources.${index}.providerId`, `ukjent dataleverandør «${ref.providerId}»`);
      }
    }
    const fingerprint = `${item.target.type}|${item.target.id}|${item.target.field}|${item.claim.toLocaleLowerCase("nb")}`;
    const existing = caseFingerprints.get(fingerprint);
    if (existing) at("claim", `samme aktive påstand som ${existing}`);
    else if (item.status === "open") caseFingerprints.set(fingerprint, item.file);
    if (item.newspaper) {
      const newspaperFingerprint = `${item.newspaper.candidateId}|${item.newspaper.sourceResult.sourceId}|${item.newspaper.sourceResult.year}|${item.newspaper.sourceResult.no}`;
      const duplicate = newspaperFingerprints.get(newspaperFingerprint);
      if (duplicate) at("newspaper.candidateId", `samme aviskandidat og kilderesultat som ${duplicate}`);
      else newspaperFingerprints.set(newspaperFingerprint, item.file);
    }
  }

  for (const person of archive.people) {
    for (const [index, role] of person.roles.entries()) {
      if (role.organizationId && !organizationIds.has(role.organizationId)) {
        issues.push({ file: `people/${person.id}.yaml`, path: `roles.${index}.organizationId`, message: `ukjent organisasjon «${role.organizationId}»` });
      }
    }
  }
  for (const extraction of archive.extractions) {
    if (!sourceIds.has(extraction.sourceId)) {
      issues.push({ file: extraction.file, path: "sourceId", message: `ukjent historisk kilde «${extraction.sourceId}»` });
    }
    if (!providerIds.has(extraction.providerId)) {
      issues.push({ file: extraction.file, path: "providerId", message: `ukjent provider «${extraction.providerId}»` });
    }
    for (const [index, candidate] of extraction.candidates.entries()) {
      for (const personId of candidate.personIds) if (!personIds.has(personId)) {
        issues.push({ file: extraction.file, path: `candidates.${index}.personIds`, message: `ukjent person «${personId}»` });
      }
      for (const matchId of candidate.matchIds) if (!matchIds.has(matchId)) {
        issues.push({ file: extraction.file, path: `candidates.${index}.matchIds`, message: `ukjent kamp «${matchId}»` });
      }
    }
  }

  const seenSourceResultIds = new Set<string>();
  const sourceResultsByGroup = new Map<string, { file: string; result: SourceResult }[]>();
  for (const collection of archive.sourceResults) {
    const at = (path: string, message: string) => issues.push({ file: collection.file, path, message });
    if (!sourceIds.has(collection.sourceId)) at("sourceId", `ukjent historisk kilde «${collection.sourceId}»`);
    for (const [index, result] of flattenSourceResults(collection).entries()) {
      const key = `${collection.sourceId}|${result.id}`;
      if (seenSourceResultIds.has(key)) at(`results.${index}.id`, `duplikat kilderesultat «${result.id}»`);
      seenSourceResultIds.add(key);
      if (result.opponentClubId !== null && !clubIds.has(result.opponentClubId)) at(`results.${index}.opponentClubId`, `ukjent klubb «${result.opponentClubId}»`);
      if (result.competitionId !== null && !competitionIds.has(result.competitionId)) at(`results.${index}.competitionId`, `ukjent konkurranse «${result.competitionId}»`);
      if (result.matchId !== null && !matchIds.has(result.matchId)) at(`results.${index}.matchId`, `ukjent kamp «${result.matchId}»`);
      if (result.resultGroupId) {
        const group = sourceResultsByGroup.get(result.resultGroupId) ?? [];
        group.push({ file: collection.file, result });
        sourceResultsByGroup.set(result.resultGroupId, group);
      }
    }
  }

  for (const [groupId, group] of sourceResultsByGroup) {
    const seasons = new Set(group.map((e) => e.result.season));
    if (seasons.size > 1) {
      for (const entry of group) {
        issues.push({
          file: entry.file,
          path: "resultGroupId",
          message: `resultatgruppe «${groupId}» spenner over ulike sesonger (${[...seasons].join(", ")})`,
        });
      }
    }

    const matchIdsInGroup = new Set(group.map((e) => e.result.matchId).filter((id): id is string => id !== null));
    if (matchIdsInGroup.size > 1) {
      for (const entry of group) {
        issues.push({
          file: entry.file,
          path: "matchId",
          message: `resultatgruppe «${groupId}» peker på flere ulike kamper (${[...matchIdsInGroup].join(", ")})`,
        });
      }
    }

    const opponentClubs = new Set(group.map((e) => e.result.opponentClubId).filter((id): id is string => id !== null));
    if (opponentClubs.size > 1) {
      for (const entry of group) {
        issues.push({
          file: entry.file,
          path: "opponentClubId",
          message: `resultatgruppe «${groupId}» har motstridende klubber (${[...opponentClubs].join(", ")})`,
        });
      }
    }
  }

  // Klubber som normaliserer til samme identitet er nesten alltid samme klubb
  // ført to ganger, fordi én kilde skriver «FK Haugesund» og en annen «Haugesund».
  // Dette rapporteres, ikke slås sammen: en sammenslåing for mye gir gale tall
  // uten at noe feiler, mens en dublett som står er synlig og rettbar.
  const clubsByIdentity = new Map<string, Club[]>();
  const explicitIdentityKeys = new Map<string, Club[]>();
  const nameVariantOwners = new Map<string, Club[]>();

  for (const club of archive.clubs) {
    const key = canonicalClubKey(club);
    clubsByIdentity.set(key, [...(clubsByIdentity.get(key) ?? []), club]);
    if (club.identityKey) {
      explicitIdentityKeys.set(club.identityKey, [...(explicitIdentityKeys.get(club.identityKey) ?? []), club]);
    }
    for (const variant of club.nameVariants) {
      const vKey = variant.trim().toLowerCase();
      nameVariantOwners.set(vKey, [...(nameVariantOwners.get(vKey) ?? []), club]);
    }
  }
  for (const [key, group] of clubsByIdentity) {
    if (group.length < 2) continue;
    const names = group.map((club) => `${club.id} («${club.name}»)`).join(", ");
    for (const club of group) {
      issues.push({
        file: `clubs/${club.id}.yaml`,
        path: "name",
        message: `samme klubbidentitet «${key}» som ${names} — slå dem sammen, eller angi eksplisitt identityKey dersom det er ulike klubber`,
      });
    }
  }
  for (const [idKey, group] of explicitIdentityKeys) {
    if (group.length < 2) continue;
    const names = group.map((club) => `${club.id} («${club.name}»)`).join(", ");
    for (const club of group) {
      issues.push({
        file: `clubs/${club.id}.yaml`,
        path: "identityKey",
        message: `duplikat identityKey «${idKey}» brukt av flere klubber: ${names}`,
      });
    }
  }
  for (const [vKey, group] of nameVariantOwners) {
    if (group.length < 2) continue;
    const names = group.map((club) => `${club.id} («${club.name}»)`).join(", ");
    for (const club of group) {
      issues.push({
        file: `clubs/${club.id}.yaml`,
        path: "nameVariants",
        message: `navnevariant «${vKey}» tilhører flere ulike klubber: ${names}`,
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
    for (const s of m.providers) {
      if (!providerIds.has(s.providerId)) {
        at("providers", `ukjent kilde «${s.providerId}» — mangler data/providers/${s.providerId}.yaml`);
      }
    }
    for (const s of m.sources) {
      if (!sourceIds.has(s.sourceId)) {
        at("sources", `ukjent historisk kilde «${s.sourceId}» — mangler data/sources/${s.sourceId}.yaml`);
      }
    }
    for (const c of m.conflicts) {
      for (const v of c.values) {
        if (!providerIds.has(v.providerId)) {
          at("conflicts", `ukjent kilde «${v.providerId}» i konflikt på feltet «${c.field}»`);
        }
      }
    }
  }

  // Observasjonen er verdiløs hvis den ikke kan spores tilbake til en kilde og en
  // kamp. Den peker på begge deler med ren tekst, så bare et oppslag her fanger
  // en observasjon som er blitt hengende igjen etter en slettet kamp.
  const seenObservations = new Set<string>();
  for (const o of archive.observations) {
    const at = (path: string, message: string) => issues.push({ file: o.file, path, message });
    const key = `${o.providerId}|${o.externalId}`;
    if (seenObservations.has(key)) {
      at("externalId", `duplikat observasjon «${key}»`);
    }
    seenObservations.add(key);
    if (!providerIds.has(o.providerId)) {
      at("providerId", `ukjent kilde «${o.providerId}» — mangler data/providers/${o.providerId}.yaml`);
    }
    if (o.matchId !== null && !seenMatchIds.has(o.matchId)) {
      at("matchId", `ukjent kamp «${o.matchId}» — sett matchId til null hvis kampen ikke ble skrevet`);
    }
  }

  // Tabellen bærer kildens egne lagnavn, ikke klubb-ID-er, så det er lite å slå
  // opp — men det som slås opp må stemme. En tabell for en konkurranse som ikke
  // finnes vises aldri, og en clubId som ikke finnes gir en død lenke i tabellen.
  const seenTables = new Set<string>();
  for (const t of archive.standings) {
    const at = (path: string, message: string) => issues.push({ file: t.file, path, message });
    const key = `${t.competitionId}|${t.season}`;
    if (seenTables.has(key)) at("season", `to tabeller for ${t.competitionId} ${t.season}`);
    seenTables.add(key);

    if (!competitionIds.has(t.competitionId)) {
      at("competitionId", `ukjent konkurranse «${t.competitionId}»`);
    }
    for (const row of t.table) {
      if (row.clubId !== null && !clubIds.has(row.clubId)) {
        at("table", `ukjent klubb «${row.clubId}» på plass ${row.position} — la den stå som null hvis klubben ikke er i arkivet`);
      }
      // `name` skal være kildens eget lagnavn, det som vises i tabellen. Står en
      // klubb-ID der, har innhøstingen skrevet vår egen nøkkel tilbake i stedet
      // for navnet, og sesongsiden viser «fk-haugesund» som om det var et lagnavn.
      // Det skjedde i 1995 og 1996, og gikk gjennom alle kontrollene vi hadde.
      if (clubIds.has(row.name)) {
        at("table", `lagnavnet på plass ${row.position} er klubb-ID-en «${row.name}» — skriv kildens eget navn`);
      }
    }
    for (const s of t.providers) {
      if (!providerIds.has(s.providerId)) {
        at("providers", `ukjent kilde «${s.providerId}» — mangler data/providers/${s.providerId}.yaml`);
      }
    }
    for (const s of t.sources) {
      if (!sourceIds.has(s.sourceId)) {
        at("sources", `ukjent historisk kilde «${s.sourceId}» — mangler data/sources/${s.sourceId}.yaml`);
      }
    }
  }

  // Personfiler finnes bare for dem det er noe å si om, så det er lite å slå opp.
  // Det som må stemme, er at ingen to filer beskriver samme person: to filer for
  // samme mann gir to rader i stallen uten at noe feiler.
  const seenPeople = new Set<string>();
  const seenPersonNames = new Map<string, string>();
  // Wikidata-ID-en er den eneste identiteten her som ikke er en gjetning. Deler
  // to filer den, er de samme person, og det er ingenting å vurdere.
  const seenWikidata = new Map<string, string>();
  for (const p of archive.people) {
    const file = `people/${p.id}.yaml`;
    const at = (path: string, message: string) => issues.push({ file, path, message });
    if (seenPeople.has(p.id)) at("id", `duplikat person-ID «${p.id}»`);
    seenPeople.add(p.id);

    for (const written of [p.name, ...p.names]) {
      const key = personKey(written);
      const owner = seenPersonNames.get(key);
      if (owner !== undefined && owner !== p.id) {
        at("names", `skrivemåten «${written}» er også ført på «${owner}»`);
      }
      seenPersonNames.set(key, p.id);
    }

    if (p.wikidata !== undefined) {
      const owner = seenWikidata.get(p.wikidata);
      if (owner !== undefined) {
        at("wikidata", `${p.wikidata} står også på «${owner}» — det er samme person, slå filene sammen`);
      }
      seenWikidata.set(p.wikidata, p.id);
    }

    for (const s of p.providers) {
      if (!providerIds.has(s.providerId)) {
        at("providers", `ukjent kilde «${s.providerId}» — mangler data/providers/${s.providerId}.yaml`);
      }
    }
    for (const s of p.sources) {
      if (!sourceIds.has(s.sourceId)) {
        at("sources", `ukjent historisk kilde «${s.sourceId}» — mangler data/sources/${s.sourceId}.yaml`);
      }
    }
    for (const role of p.roles) {
      for (const s of role.sources) {
        if (!sourceIds.has(s.sourceId)) {
          at("roles.sources", `ukjent historisk kilde «${s.sourceId}» — mangler data/sources/${s.sourceId}.yaml`);
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
    for (const source of s.sources) {
      if (!sourceIds.has(source.sourceId)) {
        issues.push({
          file: s.file,
          path: "sources",
          message: `ukjent historisk kilde «${source.sourceId}» — mangler data/sources/${source.sourceId}.yaml`,
        });
      }
    }
  }

  const sourceById = new Map(archive.sources.map((entry) => [entry.id, entry]));
  for (const source of archive.sources) {
    for (const provider of source.providers) {
      if (!providerIds.has(provider.providerId)) {
        issues.push({ file: source.file, path: "providers", message: `ukjent kilde «${provider.providerId}» — mangler data/providers/${provider.providerId}.yaml` });
      }
    }
    if (source.parentSourceId !== undefined) {
      const parent = sourceById.get(source.parentSourceId);
      if (!parent) {
        issues.push({ file: source.file, path: "parentSourceId", message: `ukjent kildeserie «${source.parentSourceId}»` });
      } else if (parent.sourceType !== "series") {
        issues.push({ file: source.file, path: "parentSourceId", message: `foreldrekilden «${parent.id}» må ha sourceType «series»` });
      }
    }
    if (source.sourceType === "series" && source.parentSourceId !== undefined) {
      issues.push({ file: source.file, path: "parentSourceId", message: "en kildeserie kan ikke selv være del av en annen serie" });
    }
  }

  return issues;
}
