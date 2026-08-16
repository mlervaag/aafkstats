import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { repoRoot } from "../load.js";
import { source, type Source } from "../source.js";
import { publicationExtraction } from "../extraction.js";
import { loadYamlMap } from "../historical/git.js";
import { SOURCE_PROFILES, inferSourceProfile, type HarvestProfileId } from "../historical/source-profile.js";
import type {
  HarvestBatchManifest,
  HarvestBatchMode,
  HarvestPass,
  HarvestSourceInventoryItem,
} from "../historical/harvest-manifest.js";

export interface HistoricalHarvestInitOptions {
  profile?: HarvestProfileId;
  sources: string[];
  parentSourceId?: string;
  yearFrom?: number;
  yearTo?: number;
  mode: HarvestBatchMode;
  id?: string;
  title?: string;
  output?: string;
  dryRun?: boolean;
}

export function parseInitCliArgs(args: string[]): HistoricalHarvestInitOptions {
  const options: HistoricalHarvestInitOptions = {
    sources: [],
    mode: "initial",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--profile" && args[i + 1] !== undefined) {
      options.profile = args[++i] as HarvestProfileId;
    } else if (arg === "--source" && args[i + 1] !== undefined) {
      options.sources.push(args[++i]!);
    } else if (arg === "--parent-source" && args[i + 1] !== undefined) {
      options.parentSourceId = args[++i]!;
    } else if (arg === "--year-from" && args[i + 1] !== undefined) {
      options.yearFrom = Number.parseInt(args[++i]!, 10);
    } else if (arg === "--year-to" && args[i + 1] !== undefined) {
      options.yearTo = Number.parseInt(args[++i]!, 10);
    } else if (arg === "--mode" && args[i + 1] !== undefined) {
      options.mode = args[++i] as HarvestBatchMode;
    } else if (arg === "--id" && args[i + 1] !== undefined) {
      options.id = args[++i]!;
    } else if (arg === "--title" && args[i + 1] !== undefined) {
      options.title = args[++i]!;
    } else if (arg === "--output" && args[i + 1] !== undefined) {
      options.output = args[++i]!;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

export async function generateHarvestBatchManifest(
  options: HistoricalHarvestInitOptions,
  root = repoRoot(),
): Promise<{ manifest: HarvestBatchManifest; manifestPath: string; reviewPath: string }> {
  // Last kilder og extractions
  const sourcesLoad = await loadYamlMap(null, "data/sources", source, root);
  const extractionsLoad = await loadYamlMap(null, "data/extractions", publicationExtraction, root);

  const sourcesMap = sourcesLoad.items;
  const extractionsMap = extractionsLoad.items;

  // Filtrer kilder i scope
  const matchingSources: Source[] = [];
  const explicitIds = options.sources.length > 0 ? new Set(options.sources) : null;

  for (const [sourceId, src] of sourcesMap) {
    let inScope = true;
    if (explicitIds) {
      inScope = explicitIds.has(sourceId);
    } else {
      if (options.parentSourceId && src.parentSourceId !== options.parentSourceId) {
        inScope = false;
      }
      if (options.yearFrom !== undefined && (src.year === undefined || src.year < options.yearFrom)) {
        inScope = false;
      }
      if (options.yearTo !== undefined && (src.year === undefined || src.year > options.yearTo)) {
        inScope = false;
      }
    }

    if (inScope) {
      matchingSources.push(src);
    }
  }

  matchingSources.sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || a.id.localeCompare(b.id));

  // Inferer profil dersom ikke oppgitt
  let profileId = options.profile;
  if (!profileId) {
    if (matchingSources.length > 0) {
      profileId = inferSourceProfile(matchingSources[0]);
    } else if (options.parentSourceId) {
      profileId = inferSourceProfile({ parentSourceId: options.parentSourceId });
    } else {
      profileId = "generic_publication";
    }
  }

  const profile = SOURCE_PROFILES[profileId] ?? SOURCE_PROFILES.generic_publication;

  // Generer batch-ID
  let batchId = options.id;
  if (!batchId) {
    if (options.parentSourceId) {
      if (options.yearFrom && options.yearTo) {
        batchId = `${options.parentSourceId}-${options.yearFrom}-${options.yearTo}`;
      } else if (options.yearFrom) {
        batchId = `${options.parentSourceId}-${options.yearFrom}`;
      } else {
        batchId = options.parentSourceId;
      }
    } else if (matchingSources.length === 1 && matchingSources[0]) {
      batchId = matchingSources[0].id;
    } else if (matchingSources.length > 1) {
      const first = matchingSources[0]!;
      const last = matchingSources[matchingSources.length - 1]!;
      batchId = `${profileId}-${first.year ?? "x"}-${last.year ?? "y"}`;
    } else {
      batchId = `harvest-batch-${Date.now()}`;
    }
  }

  // Generer tittel
  let title = options.title;
  if (!title) {
    if (options.parentSourceId) {
      const yearRange = options.yearFrom && options.yearTo ? ` ${options.yearFrom}–${options.yearTo}` : "";
      title = `${profile.name}${yearRange}`;
    } else if (matchingSources.length === 1 && matchingSources[0]) {
      title = matchingSources[0].title;
    } else {
      title = `${profile.name} (${batchId})`;
    }
  }

  // Frys kildeinventar
  let totalExpectedPages = 0;
  const sourceInventory: HarvestSourceInventoryItem[] = matchingSources.map((src) => {
    const ext = extractionsMap.get(src.id);
    if (ext) {
      totalExpectedPages += ext.pagesExpected;
    }
    return {
      sourceId: src.id,
      title: src.title,
      year: src.year,
      reviewStatus: "unknown",
    };
  });

  // Sett opp required passes fra profilen
  const passes: Record<string, HarvestPass> = {};
  for (const reqPass of profile.requiredPasses) {
    passes[reqPass.id] = {
      status: "pending",
      findings: 0,
      note: reqPass.description,
    };
  }

  const reviewRelativePath = `docs/data/reviews/${batchId}.md`;

  const manifest: HarvestBatchManifest = {
    version: 1,
    id: batchId,
    title,
    profile: profileId,
    mode: options.mode,
    status: "discovered",
    scope: {
      years: options.yearFrom || options.yearTo ? { from: options.yearFrom, to: options.yearTo } : undefined,
      sourceIds: matchingSources.map((s) => s.id),
      parentSourceId: options.parentSourceId,
    },
    sourceInventory,
    coverage: {
      mode: "pages",
      expected: totalExpectedPages,
      reviewed: 0,
    },
    passes,
    reviewMethod: {
      facsimile: "required",
    },
    review: {
      file: reviewRelativePath,
    },
    findings: [],
    unresolved: [],
    previousWork: options.mode === "reharvest" ? { pullRequests: [], notes: ["Tidligere innhøsting gjennomgås på nytt."] } : undefined,
    createdAt: new Date().toISOString().slice(0, 10),
    notes: [
      `Initialisert for profil «${profile.name}» med ${matchingSources.length} kilder i scope.`,
    ],
  };

  const manifestPath = options.output ? resolve(root, options.output) : resolve(root, `data/harvests/${batchId}.yaml`);
  const reviewPath = resolve(root, reviewRelativePath);

  return { manifest, manifestPath, reviewPath };
}

export async function main() {
  const options = parseInitCliArgs(process.argv.slice(2));
  const root = repoRoot();

  try {
    const { manifest, manifestPath, reviewPath } = await generateHarvestBatchManifest(options, root);

    const yamlStr = stringifyYaml(manifest, { indent: 2 });

    if (options.dryRun) {
      console.log(`[DRY-RUN] Ville ha opprettet batch-manifest:\nSti: ${manifestPath}\n\n${yamlStr}`);
      return;
    }

    // Opprett kataloger
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, yamlStr, "utf8");
    console.log(`✓ Opprettet innhøstingsmanifest: ${manifestPath}`);

    // Opprett review-skjelett dersom det ikke allerede finnes
    if (!existsSync(reviewPath)) {
      await mkdir(dirname(reviewPath), { recursive: true });
      const reviewScaffold = `# Review: ${manifest.title}

- **Batch-ID:** \`${manifest.id}\`
- **Profil:** \`${manifest.profile}\`
- **Modus:** \`${manifest.mode}\`
- **Opprettet:** ${manifest.createdAt}

## Source Inventory
| SourceId | År | Tittel | Disposisjon |
|---|---|---|---|
${manifest.sourceInventory.map((s) => `| \`${s.sourceId}\` | ${s.year ?? "-"} | ${s.title ?? "-"} | \`${s.reviewStatus}\` |`).join("\n")}

## Sjekkpunkter
- [ ] Visuell sidekontroll gjennomført mot faksimile
- [ ] Alle required passes vurdert
- [ ] Findings registrert med disposition og targets i batchmanifestet
`;
      await writeFile(reviewPath, reviewScaffold, "utf8");
      console.log(`✓ Opprettet review-skjelett: ${reviewPath}`);
    }
  } catch (err) {
    console.error(`INIT_ERROR: ${String(err)}`);
    process.exit(1);
  }
}

if (process.argv[1]?.includes("historical-harvest-init")) {
  await main();
}
