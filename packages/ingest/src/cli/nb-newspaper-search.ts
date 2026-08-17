import { parseArgs } from "node:util";
import { searchNewspaperForMatch, stripSearchMarkup } from "../adapters/nb-newspaper-search.js";

const args = parseArgs({
  // `pnpm ingest:nb-newspaper-search -- --year 1976` sender skilletegnet videre
  // til skriptet, og da leser parseArgs alt etter det som posisjonsargumenter.
  // Uten denne fjerningen forsvinner hver eneste flagg brukeren skrev.
  args: process.argv.slice(2).filter((argument, index) => argument !== "--" || index > 0),
  options: {
    opponent: { type: "string" },
    year: { type: "string" },
    newspaper: { type: "string" },
    score: { type: "string" },
    competition: { type: "string" },
    round: { type: "string" },
    from: { type: "string" },
    to: { type: "string" },
    limit: { type: "string" },
    details: { type: "string" },
    refresh: { type: "boolean" },
    json: { type: "boolean" },
  },
});

const opponent = args.values.opponent?.trim();
const year = Number(args.values.year);
if (!opponent || !Number.isInteger(year) || year < 1900 || year > 2100) {
  console.error("Bruk: pnpm ingest:nb-newspaper-search -- --year 1976 --opponent Sunndal [--score 2-0] [--competition nm] [--round 2]");
  process.exit(1);
}

const round = args.values.round === undefined ? undefined : Number(args.values.round);
const limit = args.values.limit === undefined ? undefined : Number(args.values.limit);
const detailsLimit = args.values.details === undefined ? undefined : Number(args.values.details);

if (round !== undefined && (!Number.isInteger(round) || round < 1)) throw new Error("--round må være et positivt heltall");
if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) throw new Error("--limit må være 1–100");
if (detailsLimit !== undefined && (!Number.isInteger(detailsLimit) || detailsLimit < 0 || detailsLimit > 20)) throw new Error("--details må være 0–20");

const candidates = await searchNewspaperForMatch({
  opponent,
  year,
  newspaper: args.values.newspaper ?? "Sunnmørsposten",
  ...(args.values.score ? { score: args.values.score } : {}),
  ...(args.values.competition ? { competition: args.values.competition } : {}),
  ...(round !== undefined ? { round } : {}),
  ...(args.values.from ? { from: args.values.from } : {}),
  ...(args.values.to ? { to: args.values.to } : {}),
  ...(limit !== undefined ? { limit } : {}),
  ...(detailsLimit !== undefined ? { detailsLimit } : {}),
  ...(args.values.refresh ? { refresh: true } : {}),
});

if (args.values.json) {
  console.log(JSON.stringify(candidates, null, 2));
  process.exit(0);
}

if (candidates.length === 0) {
  console.log("Ingen kandidater funnet.");
  process.exit(0);
}

for (const [index, candidate] of candidates.slice(0, 10).entries()) {
  console.log(`\n${index + 1}. ${candidate.issued ?? "ukjent dato"} · score ${candidate.score}`);
  console.log(`   ${candidate.title ?? "Uten tittel"}`);
  console.log(`   ${candidate.itemUrl}`);
  console.log(`   ${candidate.reasons.join(", ") || "ingen sterke signaler"}`);
  // Vinduene er sortert med det sterkeste først, så de tre linjene under er den
  // beste begrunnelsen kandidaten har for å stå der den står.
  for (const fragment of candidate.fragments.slice(0, 3)) {
    const page = fragment.pageNumber ?? fragment.pageId ?? "ukjent side";
    console.log(`   [${page}] (${fragment.score}) ${plainText(fragment.text)}`);
  }
}

/** OCR-teksten uten søketjenestens uthevinger og linjeskift. */
function plainText(text: string): string {
  return stripSearchMarkup(text).replace(/\s+/g, " ").trim();
}
