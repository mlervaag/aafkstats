import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { stringify as stringifyYaml } from "yaml";
import { parseArchiveYaml as parseYaml } from "../yaml.js";
import { loadArchive, repoRoot } from "../load.js";
import { runCanonicalAudit } from "./audit-canonical-review.js";

function sha256(content: string): string {
  return "sha256:" + createHash("sha256").update(content, "utf8").digest("hex");
}

const newClubsData: Record<string, { name: string; identityKey?: string }> = {
  nydalen: {
    name: "Nydalen",
  },
  "sk-reidulf": {
    name: "Reidulf",
  },
  "il-falken-hoyanger": {
    name: "Falken",
    identityKey: "il-falken-hoyanger",
  },
  "vigra-il": {
    name: "Vigra",
  },
  stalkameratene: {
    name: "Stålkameratene",
  },
};

async function main() {
  const root = repoRoot();

  console.log("1. Running Canonical Review Audit...");
  const { manifest, canonicalReadyCases, followupCases } = await runCanonicalAudit();

  console.log(`Audited ${manifest.cases.length} cases.`);
  console.log(`- Canonical ready: ${canonicalReadyCases.length}`);
  console.log(`- Followups / Rejections: ${followupCases.length}`);

  // Ensure new clubs exist
  const clubsDir = `${root}/data/clubs`;
  await mkdir(clubsDir, { recursive: true });
  for (const [clubId, data] of Object.entries(newClubsData)) {
    const clubPath = `${clubsDir}/${clubId}.yaml`;
    const content: any = {
      id: clubId,
      name: data.name,
      names: [],
      country: "NO",
      aliases: {},
    };
    if (data.identityKey) {
      content.identityKey = data.identityKey;
    }
    await writeFile(clubPath, stringifyYaml(content), "utf8");
  }

  // Load existing archive to check for existing matches and clubs
  const archive = await loadArchive();

  // Load source results files cache
  const sourceResultFiles = new Map<string, { path: string; raw: any }>();
  for (const src of archive.sources.values()) {
    const p = `${root}/data/source-results/${src.id}.yaml`;
    try {
      const content = await readFile(p, "utf8");
      sourceResultFiles.set(src.id, { path: p, raw: parseYaml(content) });
    } catch {
      // file might not exist
    }
  }

  let newMatchesCreated = 0;
  let existingMatchesEnriched = 0;
  let observationsCreated = 0;
  let sourceResultsLinked = 0;

  // Process canonical ready cases
  for (const item of canonicalReadyCases) {
    const { sourceResult, newspaper, facsimileReaudit } = item;
    const matchDate = facsimileReaudit.matchDate.value;
    const matchYear = Number(matchDate.slice(0, 4));
    const compId = facsimileReaudit.competition.competitionId!;
    const homeAway = facsimileReaudit.homeAway;
    const oppClubId = facsimileReaudit.observedOpponent.clubId;

    let homeClubId: string;
    let awayClubId: string;
    let homeScore: number;
    let awayScore: number;
    let neutralVenue = false;

    if (homeAway === "away") {
      homeClubId = oppClubId;
      awayClubId = "aalesunds-fk";
      homeScore = facsimileReaudit.score.opponent;
      awayScore = facsimileReaudit.score.aafk;
    } else if (homeAway === "neutral") {
      homeClubId = "aalesunds-fk";
      awayClubId = oppClubId;
      homeScore = facsimileReaudit.score.aafk;
      awayScore = facsimileReaudit.score.opponent;
      neutralVenue = true;
    } else {
      homeClubId = "aalesunds-fk";
      awayClubId = oppClubId;
      homeScore = facsimileReaudit.score.aafk;
      awayScore = facsimileReaudit.score.opponent;
    }

    const matchId = `${matchDate}-${homeClubId}-${awayClubId}`;
    const matchDir = `${root}/data/seasons/${matchYear}/matches`;
    const matchFile = `${matchDir}/${matchId}.yaml`;

    await mkdir(matchDir, { recursive: true });

    // Check if match already exists
    let matchContent: any;

    try {
      const existing = await readFile(matchFile, "utf8");
      matchContent = parseYaml(existing);
      existingMatchesEnriched++;
    } catch {
      newMatchesCreated++;
      matchContent = {
        id: matchId,
        date: matchDate,
        dateConfidence: "exact",
        status: "played",
        competition: {
          id: compId,
          season: matchYear,
          stage: "regular_season",
        },
        home: {
          clubId: homeClubId,
          score: homeScore,
          halfTimeScore: null,
        },
        away: {
          clubId: awayClubId,
          score: awayScore,
          halfTimeScore: null,
        },
        neutralVenue,
        events: [],
        externalReports: [],
        providers: [],
        sources: [],
        confidence: "confirmed",
        conflicts: [],
        tags: [],
        aliases: {},
        manual: [],
        note: facsimileReaudit.reason,
      };
    }

    // Add external report if not present
    if (!matchContent.externalReports) matchContent.externalReports = [];
    const reportTitle = `${newspaper.title} ${newspaper.issueDate} s. ${newspaper.page}`;
    if (!matchContent.externalReports.some((r: any) => r.url === newspaper.pageUrl)) {
      matchContent.externalReports.push({
        publisher: newspaper.title,
        title: reportTitle,
        date: newspaper.issueDate,
        url: newspaper.pageUrl,
      });
    }

    // Add provider if not present
    if (!matchContent.providers) matchContent.providers = [];
    if (!matchContent.providers.some((p: any) => p.providerId === "nasjonalbiblioteket" && p.url === newspaper.pageUrl)) {
      matchContent.providers.push({
        providerId: "nasjonalbiblioteket",
        url: newspaper.pageUrl,
        retrievedAt: "2026-08-21",
        fields: ["date", "status", "competition", "home.clubId", "away.clubId", "home.score", "away.score"],
      });
    }

    // Add source if not present
    if (!matchContent.sources) matchContent.sources = [];
    if (!matchContent.sources.some((s: any) => s.sourceId === sourceResult.sourceId)) {
      matchContent.sources.push({
        sourceId: sourceResult.sourceId,
      });
    }

    await writeFile(matchFile, stringifyYaml(matchContent), "utf8");

    // Write observation in standard schema
    const providerName = newspaper.title.toLowerCase().includes("romsdal") ? "romsdals-budstikke" : "sunnmorsposten";
    const obsExternalId = `${providerName}-${newspaper.issueDate}-s${newspaper.page}-${oppClubId}`;
    const obsDir = `${root}/data/observations/nasjonalbiblioteket`;
    await mkdir(obsDir, { recursive: true });
    const obsFile = `${obsDir}/${obsExternalId}.yaml`;

    const rawPayload = {
      avis: newspaper.title,
      dato: newspaper.issueDate,
      side: String(newspaper.page),
      tittel: reportTitle,
      kamp: `${homeClubId} - ${awayClubId} ${homeScore}-${awayScore}`,
      url: newspaper.pageUrl,
    };

    const obsContent = {
      providerId: "nasjonalbiblioteket",
      externalId: obsExternalId,
      matchId,
      retrievedAt: "2026-08-21",
      adapter: "nasjonalbiblioteket@1",
      payloadHash: sha256(JSON.stringify(rawPayload)),
      raw: rawPayload,
      normalized: {
        date: matchDate,
        "home.clubId": homeClubId,
        "away.clubId": awayClubId,
        "home.score": homeScore,
        "away.score": awayScore,
      },
      fields: [
        "date",
        "home.clubId",
        "away.clubId",
        "home.score",
        "away.score",
      ],
      warnings: [],
    };

    await writeFile(obsFile, stringifyYaml(obsContent), "utf8");
    observationsCreated++;

    // Link sourceResult in memory
    const srcFileEntry = sourceResultFiles.get(sourceResult.sourceId);
    if (srcFileEntry && srcFileEntry.raw?.seasons) {
      for (const season of srcFileEntry.raw.seasons) {
        if (season.year === sourceResult.year && season.results) {
          const matchSr = season.results.find((r: any) => r.no === sourceResult.no);
          if (matchSr) {
            matchSr.matchId = matchId;
            matchSr.opponentClubId = oppClubId;
            sourceResultsLinked++;
          }
        }
      }
    }
  }

  // Save all modified source-results files
  for (const [, fileEntry] of sourceResultFiles.entries()) {
    await writeFile(fileEntry.path, stringifyYaml(fileEntry.raw), "utf8");
  }

  // Write followup file
  const followupDir = `${root}/data/discovery`;
  await mkdir(followupDir, { recursive: true });
  const followupFile = `${followupDir}/nb-visual-review-followup.yaml`;

  const followupData = {
    contract: "nb-visual-review-followup@2",
    generatedAt: "2026-08-21",
    totalCases: followupCases.length,
    summary: {
      score_conflict: followupCases.filter((c) => c.facsimileReaudit.disposition === "score_conflict").length,
      wrong_event: followupCases.filter((c) => c.facsimileReaudit.disposition === "wrong_event").length,
      non_senior: followupCases.filter((c) => c.facsimileReaudit.disposition === "non_senior").length,
      date_uncertain: followupCases.filter((c) => c.facsimileReaudit.disposition === "date_uncertain").length,
      competition_uncertain: followupCases.filter((c) => c.facsimileReaudit.disposition === "competition_uncertain").length,
      insufficient: followupCases.filter((c) => c.facsimileReaudit.disposition === "insufficient").length,
    },
    cases: followupCases.map((c) => ({
      candidateId: c.candidateId,
      disposition: c.facsimileReaudit.disposition,
      sourceResult: c.sourceResult,
      newspaper: c.newspaper,
      facsimileReaudit: c.facsimileReaudit,
    })),
  };

  await writeFile(followupFile, stringifyYaml(followupData), "utf8");
  console.log(`Wrote followup queue to ${followupFile}`);

  console.log(`\nExecution Summary:`);
  console.log(`- New matches created: ${newMatchesCreated}`);
  console.log(`- Existing matches enriched: ${existingMatchesEnriched}`);
  console.log(`- Observations created: ${observationsCreated}`);
  console.log(`- Source results linked: ${sourceResultsLinked}`);
  console.log(`- Followup events recorded: ${followupCases.length}`);
}

main().catch(console.error);
