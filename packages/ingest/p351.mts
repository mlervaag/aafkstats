import { resolve } from "node:path";
import { loadArchive } from "@aafkstats/schema/load";
import { publicationAltoPages, readAltoPage } from "./src/adapters/nb-publications.js";
import { readPageColumns, pairedRows, joinLines } from "./src/adapters/nb-pages.js";
import { resolveRoles, knownPeople } from "./src/adapters/nb-roles.js";
const archive = await loadArchive(resolve(process.cwd(), "../../data"));
const src = archive.sources.find((s) => s.id === "tango-siden-1914-2013-806b")!;
const people = knownPeople(archive.people.map((p) => ({ id: p.id, name: p.name, names: p.names })));
const opts = { cacheDir: resolve(process.cwd(), "../../.cache/nb-extract"), retrievedAt: "2026-08-11", delayMs: 0, concurrency: 1 };
const page = (await publicationAltoPages(src, opts)).find((p) => p.page === "351")!;
const cols = readPageColumns(await readAltoPage(page, opts));
const rows = pairedRows(cols);
const ctx = cols.map((c) => joinLines(c.lines)).join(" ");
const all = [
  ...resolveRoles(rows, rows.join(" "), { sourceId: src.id, page: "351", people, pageContext: ctx, publicationYear: 2013 }),
  ...cols.flatMap((c, i) => resolveRoles(c.lines, joinLines(c.lines), { sourceId: src.id, page: "351", column: i, people, pageContext: ctx, publicationYear: 2013 })),
];
const uniq = [...new Map(all.map((r) => [`${r.personName}|${r.from}`, r])).values()].sort((a, b) => (a.from ?? "").localeCompare(b.from ?? ""));
console.log(`roller fra side 351: ${uniq.length}`);
for (const r of uniq) console.log(`  ${r.from}  ${r.title.padEnd(8)} ${r.personName.padEnd(30)} ${r.confidence}${r.personId ? " →" + r.personId : ""}`);
