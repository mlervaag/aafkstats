import { resolve } from "node:path";
import { loadArchive } from "@aafkstats/schema/load";
import { publicationAltoPages, readAltoPage } from "./src/adapters/nb-publications.js";
import { readPageColumns, pairedRows } from "./src/adapters/nb-pages.js";
const archive = await loadArchive(resolve(process.cwd(), "../../data"));
const src = archive.sources.find((s) => s.id === "tango-siden-1914-2013-806b")!;
const opts = { cacheDir: resolve(process.cwd(), "../../.cache/nb-extract"), retrievedAt: "2026-08-11", delayMs: 0, concurrency: 1 };
const page = (await publicationAltoPages(src, opts)).find((p) => p.page === "351")!;
const cols = readPageColumns(await readAltoPage(page, opts));
for (const [i, c] of cols.entries()) {
  const years = c.lines.filter((l) => /^(1[89]\d{2}|20\d{2})[.\s]*$/.test(l)).length;
  console.log(`spalte ${i+1}: ${c.from}-${c.to}, ${c.lines.length} linjer, ${years} rene årstall`);
}
console.log("\nparede rader:", pairedRows(cols).length);
for (const r of pairedRows(cols).slice(0, 6)) console.log("   ", r);
console.log("\nsiste linjer i spalte 1:", JSON.stringify(cols[0]!.lines.slice(-5)));
