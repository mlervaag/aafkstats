import { readFile, writeFile, readdir } from "node:fs/promises";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { repoRoot } from "@aafkstats/schema/load";

export interface MigrationMappingItem {
  oldCoordinate: {
    sourceId: string;
    season: number;
    no: number;
    hypothesisId: string;
  };
  newCoordinate: {
    sourceId: string;
    season: number;
    no: number;
    hypothesisId: string;
  };
  claim: {
    opponent: string;
    score: [number, number];
    page: number;
    note?: string;
    opponentClubId?: string;
    resultGroupId?: string;
  };
  hadMatchId?: string;
  action: "MOVED_SEASON" | "RENUMBERED_IN_SEASON";
  matchAction:
    | "KEEP_MATCH_REMOVE_SOURCE_LINK"
    | "KEEP_MATCH_RELINK_CORRECTED_SOURCE"
    | "INVALIDATE_MATCH_LINK_PENDING_REVIEW"
    | "NO_EXISTING_MATCH_LINK";
}

export interface ShiftRepairReport {
  contract: "medlemsblad-1965-year-shift-repair@1";
  generatedAt: string;
  summary: {
    totalMovedRows: number;
    totalRenumberedRows: number;
    seasonCountsBefore: Record<number, number>;
    seasonCountsAfter: Record<number, number>;
    matchesUpdated: number;
    matchesRemovedMedlemsbladSource: number;
  };
  movedItems: MigrationMappingItem[];
  renumberedItems: MigrationMappingItem[];
}

export async function executeYearShiftRepair(apply: boolean = false): Promise<ShiftRepairReport> {
  const root = repoRoot();
  const sourceFilePath = `${root}/data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml`;
  const sourceRaw = await readFile(sourceFilePath, "utf8");
  const sourceData = parseYaml(sourceRaw, { schema: "core" });

  const s1954 = sourceData.seasons.find((s: any) => s.year === 1954);
  const s1955 = sourceData.seasons.find((s: any) => s.year === 1955);
  const s1956 = sourceData.seasons.find((s: any) => s.year === 1956);
  const s1957 = sourceData.seasons.find((s: any) => s.year === 1957);

  const seasonCountsBefore = {
    1954: s1954?.results?.length || 0,
    1955: s1955?.results?.length || 0,
    1956: s1956?.results?.length || 0,
    1957: s1957?.results?.length || 0,
  };

  const movedItems: MigrationMappingItem[] = [];
  const renumberedItems: MigrationMappingItem[] = [];

  // Group 1: 1955 #1..#23 -> 1954 #10..#32 (23 rows)
  const rows1955_to_1954: any[] = [];
  for (let i = 0; i < 23; i++) {
    const r = s1955.results[i];
    const oldNo = r.no;
    const newNo = oldNo + 9;
    const hadMatchId = r.matchId;

    const newRow = { ...r, no: newNo };
    if (newRow.matchId) {
      delete newRow.matchId;
    }
    if (newRow.resultGroupId) {
      delete newRow.resultGroupId;
    }
    rows1955_to_1954.push(newRow);

    movedItems.push({
      oldCoordinate: {
        sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
        season: 1955,
        no: oldNo,
        hypothesisId: `medlemsblad-for-aalesunds-fotb-1965-a2c9#1955-${String(oldNo).padStart(3, "0")}`,
      },
      newCoordinate: {
        sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
        season: 1954,
        no: newNo,
        hypothesisId: `medlemsblad-for-aalesunds-fotb-1965-a2c9#1954-${String(newNo).padStart(3, "0")}`,
      },
      claim: {
        opponent: r.opponent,
        score: r.score,
        page: r.page,
        note: r.note,
        opponentClubId: r.opponentClubId,
        resultGroupId: r.resultGroupId,
      },
      hadMatchId,
      action: "MOVED_SEASON",
      matchAction: hadMatchId ? "KEEP_MATCH_REMOVE_SOURCE_LINK" : "NO_EXISTING_MATCH_LINK",
    });
  }

  // Group 2: 1955 #24..#36 -> 1955 #1..#13 (13 rows)
  const rows1955_start: any[] = [];
  for (let i = 23; i < s1955.results.length; i++) {
    const r = s1955.results[i];
    const oldNo = r.no;
    const newNo = oldNo - 23;
    const hadMatchId = r.matchId;

    const newRow = { ...r, no: newNo };
    rows1955_start.push(newRow);

    renumberedItems.push({
      oldCoordinate: {
        sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
        season: 1955,
        no: oldNo,
        hypothesisId: `medlemsblad-for-aalesunds-fotb-1965-a2c9#1955-${String(oldNo).padStart(3, "0")}`,
      },
      newCoordinate: {
        sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
        season: 1955,
        no: newNo,
        hypothesisId: `medlemsblad-for-aalesunds-fotb-1965-a2c9#1955-${String(newNo).padStart(3, "0")}`,
      },
      claim: {
        opponent: r.opponent,
        score: r.score,
        page: r.page,
        note: r.note,
        opponentClubId: r.opponentClubId,
        resultGroupId: r.resultGroupId,
      },
      hadMatchId,
      action: "RENUMBERED_IN_SEASON",
      matchAction: hadMatchId ? "KEEP_MATCH_RELINK_CORRECTED_SOURCE" : "NO_EXISTING_MATCH_LINK",
    });
  }

  // Group 3: 1956 #1..#16 -> 1955 #14..#29 (16 rows)
  const rows1956_to_1955: any[] = [];
  for (let i = 0; i < 16; i++) {
    const r = s1956.results[i];
    const oldNo = r.no;
    const newNo = oldNo + 13;
    const hadMatchId = r.matchId;

    const newRow = { ...r, no: newNo };
    if (newRow.matchId) {
      delete newRow.matchId;
    }
    if (newRow.resultGroupId) {
      delete newRow.resultGroupId;
    }
    rows1956_to_1955.push(newRow);

    movedItems.push({
      oldCoordinate: {
        sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
        season: 1956,
        no: oldNo,
        hypothesisId: `medlemsblad-for-aalesunds-fotb-1965-a2c9#1956-${String(oldNo).padStart(3, "0")}`,
      },
      newCoordinate: {
        sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
        season: 1955,
        no: newNo,
        hypothesisId: `medlemsblad-for-aalesunds-fotb-1965-a2c9#1955-${String(newNo).padStart(3, "0")}`,
      },
      claim: {
        opponent: r.opponent,
        score: r.score,
        page: r.page,
        note: r.note,
        opponentClubId: r.opponentClubId,
        resultGroupId: r.resultGroupId,
      },
      hadMatchId,
      action: "MOVED_SEASON",
      matchAction: hadMatchId ? "KEEP_MATCH_REMOVE_SOURCE_LINK" : "NO_EXISTING_MATCH_LINK",
    });
  }

  // Group 4: 1956 #17..#29 -> 1956 #1..#13 (13 rows)
  const rows1956_start: any[] = [];
  for (let i = 16; i < s1956.results.length; i++) {
    const r = s1956.results[i];
    const oldNo = r.no;
    const newNo = oldNo - 16;
    const hadMatchId = r.matchId;

    const newRow = { ...r, no: newNo };
    rows1956_start.push(newRow);

    renumberedItems.push({
      oldCoordinate: {
        sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
        season: 1956,
        no: oldNo,
        hypothesisId: `medlemsblad-for-aalesunds-fotb-1965-a2c9#1956-${String(oldNo).padStart(3, "0")}`,
      },
      newCoordinate: {
        sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
        season: 1956,
        no: newNo,
        hypothesisId: `medlemsblad-for-aalesunds-fotb-1965-a2c9#1956-${String(newNo).padStart(3, "0")}`,
      },
      claim: {
        opponent: r.opponent,
        score: r.score,
        page: r.page,
        note: r.note,
        opponentClubId: r.opponentClubId,
        resultGroupId: r.resultGroupId,
      },
      hadMatchId,
      action: "RENUMBERED_IN_SEASON",
      matchAction: hadMatchId ? "KEEP_MATCH_RELINK_CORRECTED_SOURCE" : "NO_EXISTING_MATCH_LINK",
    });
  }

  // Group 5: 1957 #1..#15 -> 1956 #14..#28 (15 rows)
  const rows1957_to_1956: any[] = [];
  for (let i = 0; i < 15; i++) {
    const r = s1957.results[i];
    const oldNo = r.no;
    const newNo = oldNo + 13;
    const hadMatchId = r.matchId;

    const newRow = { ...r, no: newNo };
    if (newRow.matchId) {
      delete newRow.matchId;
    }
    if (newRow.resultGroupId) {
      delete newRow.resultGroupId;
    }
    rows1957_to_1956.push(newRow);

    movedItems.push({
      oldCoordinate: {
        sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
        season: 1957,
        no: oldNo,
        hypothesisId: `medlemsblad-for-aalesunds-fotb-1965-a2c9#1957-${String(oldNo).padStart(3, "0")}`,
      },
      newCoordinate: {
        sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
        season: 1956,
        no: newNo,
        hypothesisId: `medlemsblad-for-aalesunds-fotb-1965-a2c9#1956-${String(newNo).padStart(3, "0")}`,
      },
      claim: {
        opponent: r.opponent,
        score: r.score,
        page: r.page,
        note: r.note,
        opponentClubId: r.opponentClubId,
        resultGroupId: r.resultGroupId,
      },
      hadMatchId,
      action: "MOVED_SEASON",
      matchAction: hadMatchId ? "KEEP_MATCH_REMOVE_SOURCE_LINK" : "NO_EXISTING_MATCH_LINK",
    });
  }

  // Group 6: 1957 #16..#44 -> 1957 #1..#29 (29 rows)
  const rows1957_start: any[] = [];
  for (let i = 15; i < s1957.results.length; i++) {
    const r = s1957.results[i];
    const oldNo = r.no;
    const newNo = oldNo - 15;
    const hadMatchId = r.matchId;

    const newRow = { ...r, no: newNo };
    rows1957_start.push(newRow);

    renumberedItems.push({
      oldCoordinate: {
        sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
        season: 1957,
        no: oldNo,
        hypothesisId: `medlemsblad-for-aalesunds-fotb-1965-a2c9#1957-${String(oldNo).padStart(3, "0")}`,
      },
      newCoordinate: {
        sourceId: "medlemsblad-for-aalesunds-fotb-1965-a2c9",
        season: 1957,
        no: newNo,
        hypothesisId: `medlemsblad-for-aalesunds-fotb-1965-a2c9#1957-${String(newNo).padStart(3, "0")}`,
      },
      claim: {
        opponent: r.opponent,
        score: r.score,
        page: r.page,
        note: r.note,
        opponentClubId: r.opponentClubId,
        resultGroupId: r.resultGroupId,
      },
      hadMatchId,
      action: "RENUMBERED_IN_SEASON",
      matchAction: hadMatchId ? "KEEP_MATCH_RELINK_CORRECTED_SOURCE" : "NO_EXISTING_MATCH_LINK",
    });
  }

  // Construct updated season arrays
  s1954.results = [...s1954.results, ...rows1955_to_1954];
  s1955.results = [...rows1955_start, ...rows1956_to_1955];
  s1956.results = [...rows1956_start, ...rows1957_to_1956];
  s1957.results = [...rows1957_start];

  const seasonCountsAfter = {
    1954: s1954.results.length,
    1955: s1955.results.length,
    1956: s1956.results.length,
    1957: s1957.results.length,
  };

  // Check 10 match files in 1955 where medlemsblad-1965 source link should be removed
  const matchesToUpdate: { path: string; data: any }[] = [];
  const matchIdsToRemoveMedlemsblad = new Set(
    movedItems.filter((m) => m.hadMatchId != null).map((m) => m.hadMatchId!)
  );

  const m1955Dir = `${root}/data/seasons/1955/matches`;
  try {
    const matchFiles = await readdir(m1955Dir);
    for (const f of matchFiles) {
      if (!f.endsWith(".yaml")) continue;
      const mPath = `${m1955Dir}/${f}`;
      const mRaw = await readFile(mPath, "utf8");
      const matchData = parseYaml(mRaw, { schema: "core" });

      if (matchIdsToRemoveMedlemsblad.has(matchData.id)) {
        if (matchData.sources) {
          const beforeLen = matchData.sources.length;
          matchData.sources = matchData.sources.filter(
            (s: any) => s.sourceId !== "medlemsblad-for-aalesunds-fotb-1965-a2c9"
          );
          if (matchData.sources.length !== beforeLen) {
            matchesToUpdate.push({ path: mPath, data: matchData });
          }
        }
      }
    }
  } catch {
    // 1955 matches dir might not exist
  }

  const report: ShiftRepairReport = {
    contract: "medlemsblad-1965-year-shift-repair@1",
    generatedAt: new Date().toISOString(),
    summary: {
      totalMovedRows: movedItems.length,
      totalRenumberedRows: renumberedItems.length,
      seasonCountsBefore,
      seasonCountsAfter,
      matchesUpdated: matchesToUpdate.length,
      matchesRemovedMedlemsbladSource: matchIdsToRemoveMedlemsblad.size,
    },
    movedItems,
    renumberedItems,
  };

  if (apply) {
    // 1. Write updated source-results file
    await writeFile(sourceFilePath, stringifyYaml(sourceData), "utf8");
    console.log(`Updated ${sourceFilePath}`);

    // 2. Write migration mapping artifact
    const mappingPath = `${root}/data/discovery/medlemsblad-1965-year-shift-mapping.yaml`;
    await writeFile(mappingPath, stringifyYaml(report), "utf8");
    console.log(`Saved migration mapping to ${mappingPath}`);

    // 3. Write updated match files
    for (const m of matchesToUpdate) {
      await writeFile(m.path, stringifyYaml(m.data), "utf8");
      console.log(`Removed medlemsblad source reference from ${m.path}`);
    }
  }

  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");

  console.log(`=== Medlemsblad 1965 Year Shift Repair [${isApply ? "APPLY" : "DRY-RUN"}] ===\n`);

  const report = await executeYearShiftRepair(isApply);

  console.log("Repair Summary:");
  console.log(`- Total Moved Rows:             ${report.summary.totalMovedRows} (expected 54)`);
  console.log(`- Total Renumbered Rows:        ${report.summary.totalRenumberedRows}`);
  console.log(`- Season Counts Before:        `, report.summary.seasonCountsBefore);
  console.log(`- Season Counts After:         `, report.summary.seasonCountsAfter);
  console.log(`- Matches Removed Medlemsblad:  ${report.summary.matchesRemovedMedlemsbladSource}`);
  console.log(`- Matches Updated on Disk:      ${report.summary.matchesUpdated}`);

  if (!isApply) {
    console.log("\n[DRY RUN COMPLETE] Run with --apply to apply source-result changes.");
  } else {
    console.log("\n[APPLY COMPLETE] Source-result file and matches repaired successfully.");
  }
}

if (process.argv[1]?.endsWith("repair-medlemsblad-1965-year-shift.ts")) {
  main().catch(console.error);
}
