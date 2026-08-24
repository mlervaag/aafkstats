import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { loadArchive, repoRoot } from "@aafkstats/schema/load";

interface SafeLink { sourceClaimId: string; targetMatchId: string }
interface BlockedLink { sourceClaimId: string; targetMatchId: string; reason: string }
interface NewMatchAction {
  sourceClaimId: string;
  match: {
    id: string; date: string; competitionId: string; homeClubId: string; awayClubId: string;
    homeScore: number; awayScore: number; venueId?: string;
  };
  newspaper: { title: string; issueDate: string; printedPage: string; pageUrl: string };
}

interface ReviewManifest {
  contract: "nb-dateless-canonical-review@1";
  existingMatchReconciliation: { safeLinks: SafeLink[]; blocked: BlockedLink[] };
  canonicalActions: { createMatches: NewMatchAction[] };
}

interface RawSourceFile { path: string; raw: any; original: string; modified: boolean }
interface LocatedClaim { file: RawSourceFile; sourceId: string; season: number; result: any }

export interface DatelessCanonicalPlan {
  safeLinks: SafeLink[];
  blocked: BlockedLink[];
  newMatches: Array<NewMatchAction & { alreadyPresent: boolean }>;
  filesToWrite: Map<string, string>;
  counts: { linksCreated: number; matchesCreated: number; observationsCreated: number; filesWritten: number };
}

const MANIFEST = "data/discovery/nb-dateless-canonical-review-1950-1971.yaml";
const RETRIEVED_AT = "2026-08-24";

function hash(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex")}`;
}

function aafkScore(match: any): [number | null, number | null] {
  return match.home.clubId === "aalesunds-fk"
    ? [match.home.score ?? null, match.away.score ?? null]
    : [match.away.score ?? null, match.home.score ?? null];
}

function opponentId(match: any): string {
  return match.home.clubId === "aalesunds-fk" ? match.away.clubId : match.home.clubId;
}

function assertClaimMatches(claim: LocatedClaim, match: any, label: string): void {
  if (match.competition.season !== claim.season) throw new Error(`${label}: season mismatch`);
  if (claim.result.opponentClubId !== opponentId(match)) throw new Error(`${label}: opponent mismatch`);
  const [aafk, opponent] = aafkScore(match);
  if (claim.result.score?.[0] !== aafk || claim.result.score?.[1] !== opponent) {
    throw new Error(`${label}: score mismatch`);
  }
  if (claim.result.competitionId && claim.result.competitionId !== match.competition.id) {
    throw new Error(`${label}: competition mismatch`);
  }
  if (claim.result.round && claim.result.round !== match.competition.round) throw new Error(`${label}: round mismatch`);
}

async function loadSourceFiles(root: string): Promise<{ files: RawSourceFile[]; claims: Map<string, LocatedClaim> }> {
  const dir = `${root}/data/source-results`;
  const files: RawSourceFile[] = [];
  const claims = new Map<string, LocatedClaim>();
  for (const name of (await readdir(dir)).filter((entry) => entry.endsWith(".yaml")).sort()) {
    const path = `${dir}/${name}`;
    const original = await readFile(path, "utf8");
    const raw = parseYaml(original, { schema: "core" });
    const file = { path, raw, original, modified: false };
    files.push(file);
    for (const season of raw.seasons ?? []) {
      for (const result of season.results ?? []) {
        if (claims.has(result.claimId)) throw new Error(`duplicate sourceClaimId ${result.claimId}`);
        claims.set(result.claimId, { file, sourceId: raw.sourceId, season: season.year, result });
      }
    }
  }
  return { files, claims };
}

function matchFromAction(action: NewMatchAction, sourceId: string, page: number): any {
  const { match, newspaper } = action;
  return {
    id: match.id,
    date: match.date,
    dateConfidence: "exact",
    status: "played",
    competition: { id: match.competitionId, season: Number(match.date.slice(0, 4)), stage: "regular_season" },
    home: { clubId: match.homeClubId, score: match.homeScore, halfTimeScore: null },
    away: { clubId: match.awayClubId, score: match.awayScore, halfTimeScore: null },
    neutralVenue: false,
    ...(match.venueId ? { venueId: match.venueId } : {}),
    events: [],
    externalReports: [{
      publisher: newspaper.title,
      title: `${newspaper.title}: ÅFK–Guard 6–2`,
      date: newspaper.issueDate,
      url: newspaper.pageUrl,
    }],
    providers: [{
      providerId: "nasjonalbiblioteket",
      url: newspaper.pageUrl,
      retrievedAt: RETRIEVED_AT,
      fields: ["date", "status", "competition", "home.clubId", "away.clubId", "home.score", "away.score", "venueId"],
    }],
    sources: [{
      sourceId,
      page: String(page),
      fields: ["status", "competition", "home.clubId", "away.clubId", "home.score", "away.score"],
      note: "Sesongoversikten dokumenterer privatkampen; faksimilen fastsetter dato, kampform og bane.",
    }],
    confidence: "confirmed",
    conflicts: [],
    tags: [],
    aliases: {},
    manual: [],
  };
}

function observationFromAction(action: NewMatchAction): { pathPart: string; data: any } {
  const { match, newspaper } = action;
  const externalId = `sunnmorsposten-${newspaper.issueDate}-s${newspaper.printedPage}-guard`;
  const raw = {
    avis: newspaper.title,
    dato: newspaper.issueDate,
    side: newspaper.printedPage,
    tittel: "ÅFK–Guard 6–2",
    kamp: `${match.homeClubId} - ${match.awayClubId} ${match.homeScore}-${match.awayScore}`,
    url: newspaper.pageUrl,
  };
  return {
    pathPart: `${externalId}.yaml`,
    data: {
      providerId: "nasjonalbiblioteket",
      externalId,
      matchId: match.id,
      retrievedAt: RETRIEVED_AT,
      adapter: "nasjonalbiblioteket@1",
      payloadHash: hash(raw),
      raw,
      normalized: {
        date: match.date,
        "home.clubId": match.homeClubId,
        "away.clubId": match.awayClubId,
        "home.score": match.homeScore,
        "away.score": match.awayScore,
      },
      fields: ["date", "home.clubId", "away.clubId", "home.score", "away.score"],
      warnings: [],
    },
  };
}

export async function buildDatelessCanonicalPlan(): Promise<DatelessCanonicalPlan> {
  const root = repoRoot();
  const manifest = parseYaml(await readFile(`${root}/${MANIFEST}`, "utf8"), { schema: "core" }) as ReviewManifest;
  if (manifest.contract !== "nb-dateless-canonical-review@1") throw new Error("unexpected review contract");

  const archive = await loadArchive();
  if (archive.issues.length) throw new Error(`archive has ${archive.issues.length} validation issues`);
  const matches = new Map(archive.matches.map((match) => [match.id, match]));
  const clubs = new Set(archive.clubs.map((club) => club.id));
  const competitions = new Set(archive.competitions.map((competition) => competition.id));
  const { files, claims } = await loadSourceFiles(root);
  const filesToWrite = new Map<string, string>();
  let linksCreated = 0;
  let matchesCreated = 0;
  let observationsCreated = 0;

  const reviewedIds = [
    ...manifest.existingMatchReconciliation.safeLinks.map((item) => item.sourceClaimId),
    ...manifest.existingMatchReconciliation.blocked.map((item) => item.sourceClaimId),
  ];
  if (reviewedIds.length !== 28 || new Set(reviewedIds).size !== 28) throw new Error("existing-match review must cover 28 unique claims");
  if (manifest.existingMatchReconciliation.safeLinks.length !== 24 || manifest.existingMatchReconciliation.blocked.length !== 4) {
    throw new Error("existing-match accounting must be 24 safe + 4 blocked");
  }

  for (const item of manifest.existingMatchReconciliation.safeLinks) {
    const claim = claims.get(item.sourceClaimId);
    const target = matches.get(item.targetMatchId);
    if (!claim || !target) throw new Error(`${item.sourceClaimId}: missing claim or target match`);
    assertClaimMatches(claim, target, item.sourceClaimId);
    if (claim.result.matchId && claim.result.matchId !== item.targetMatchId) throw new Error(`${item.sourceClaimId}: matchId conflict`);
    if (!claim.result.matchId) {
      claim.result.matchId = item.targetMatchId;
      claim.file.modified = true;
      linksCreated++;
    }
  }

  const newMatches: Array<NewMatchAction & { alreadyPresent: boolean }> = [];
  for (const action of manifest.canonicalActions.createMatches) {
    const claim = claims.get(action.sourceClaimId);
    if (!claim) throw new Error(`${action.sourceClaimId}: missing claim`);
    const { match } = action;
    for (const id of [match.homeClubId, match.awayClubId]) if (!clubs.has(id)) throw new Error(`${action.sourceClaimId}: unknown club ${id}`);
    if (!competitions.has(match.competitionId)) throw new Error(`${action.sourceClaimId}: unknown competition ${match.competitionId}`);
    if (!match.id.startsWith(match.date)) throw new Error(`${action.sourceClaimId}: match id/date mismatch`);
    const proposed = matchFromAction(action, claim.sourceId, claim.result.page);
    assertClaimMatches(claim, proposed, action.sourceClaimId);

    const eventCollisions = archive.matches.filter((candidate) => candidate.date === match.date && opponentId(candidate) === claim.result.opponentClubId);
    const existing = matches.get(match.id);
    if (!existing && eventCollisions.length) throw new Error(`${action.sourceClaimId}: event collision`);
    if (existing) assertClaimMatches(claim, existing, action.sourceClaimId);
    if (!existing) {
      const matchPath = `${root}/data/seasons/${match.date.slice(0, 4)}/matches/${match.id}.yaml`;
      filesToWrite.set(matchPath, stringifyYaml(proposed, { lineWidth: 0 }));
      matchesCreated++;
    }

    if (claim.result.matchId && claim.result.matchId !== match.id) throw new Error(`${action.sourceClaimId}: matchId conflict`);
    if (!claim.result.matchId) {
      claim.result.matchId = match.id;
      claim.file.modified = true;
      linksCreated++;
    }

    const observation = observationFromAction(action);
    const obsPath = `${root}/data/observations/nasjonalbiblioteket/${observation.pathPart}`;
    try {
      const current = await readFile(obsPath, "utf8");
      const normalizedCurrent = stringifyYaml(parseYaml(current, { schema: "core" }), { lineWidth: 0 });
      const normalizedNext = stringifyYaml(observation.data, { lineWidth: 0 });
      if (normalizedCurrent !== normalizedNext) throw new Error(`${action.sourceClaimId}: observation conflict`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      filesToWrite.set(obsPath, stringifyYaml(observation.data, { lineWidth: 0 }));
      observationsCreated++;
    }
    newMatches.push({ ...action, alreadyPresent: Boolean(existing) });
  }

  for (const file of files.filter((entry) => entry.modified)) {
    const next = stringifyYaml(file.raw, { lineWidth: 0 });
    if (next !== file.original) filesToWrite.set(file.path, next);
  }

  return {
    safeLinks: manifest.existingMatchReconciliation.safeLinks,
    blocked: manifest.existingMatchReconciliation.blocked,
    newMatches,
    filesToWrite,
    counts: { linksCreated, matchesCreated, observationsCreated, filesWritten: filesToWrite.size },
  };
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const plan = await buildDatelessCanonicalPlan();
  console.log(`Mode: ${apply ? "apply" : "dry-run"}`);
  console.log(`Existing matches: ${plan.safeLinks.length} safe, ${plan.blocked.length} blocked`);
  console.log(`New matches: ${plan.counts.matchesCreated}`);
  console.log(`Links created: ${plan.counts.linksCreated}`);
  console.log(`Observations created: ${plan.counts.observationsCreated}`);
  console.log(`Files written: ${apply ? plan.counts.filesWritten : 0}`);
  if (!apply) return;
  for (const [path, content] of plan.filesToWrite) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
