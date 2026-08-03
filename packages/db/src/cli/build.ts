import { dataDir } from "@aafkstats/schema/load";
import { archiveBuildPath } from "../index.js";
import { loadValidateAndBuild } from "../build.js";

const GREEN = "[32m";
const RED = "[31m";
const DIM = "[2m";
const RESET = "[0m";

const source = dataDir();
const out = archiveBuildPath();

try {
  const r = await loadValidateAndBuild(source, out);
  const kb = Math.round(r.bytes / 102.4) / 10;
  console.log(
    `${GREEN}✓${RESET} Bygget arkivet fra ${source}\n` +
      `  ${DIM}${r.matches} kamper · ${r.seasons} sesonger · ${r.clubs} klubber` +
      ` · ${kb} kB · ${r.durationMs} ms${RESET}\n` +
      `  ${DIM}→ ${r.path}${RESET}`,
  );
} catch (err) {
  console.error(`${RED}✗${RESET} ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
