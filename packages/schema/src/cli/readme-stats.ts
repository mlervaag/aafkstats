/**
 * Holder tallene i «Arkivet i tall» i README lik arkivet.
 *
 * `archive-truths.test.ts` feller bygget når et tall i README ikke stemmer.
 * Denne kommandoen er måten å rette det på uten å telle for hånd:
 *
 *   pnpm data:readme-stats               # sier hva som er utdatert
 *   pnpm data:readme-stats -- --write    # retter tallene i README.md
 *
 * `pnpm etter-kamp -- --write` gjør det samme av seg selv etter at den har
 * skrevet. Kommandoen er for alt annet som lar arkivet vokse: en ny person fra
 * innboksen, en ny kilde, en importert sesong.
 *
 * Den regner alltid på `data/`, ikke på `AAFK_DATA_DIR`. README beskriver det
 * ekte arkivet, og tall fra fixture-arkivet har ingenting der å gjøre.
 *
 * Sluttkoden er 0 også når tallene er utdaterte. Testen er porten; dette er
 * verktøyet som åpner den.
 */

import { resolve } from "node:path";
import { loadArchive, repoRoot } from "../load.js";
import { syncReadmeFile } from "../readme-stats.js";

const DIM = "\u001b[2m";
const YELLOW = "\u001b[33m";
const GREEN = "\u001b[32m";
const RESET = "\u001b[0m";

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const unknown = args.filter((arg) => arg !== "--write");
  if (unknown.length > 0) throw new Error(`ukjent argument: ${unknown.join(" ")}`);
  const write = args.includes("--write");

  const root = repoRoot();
  const archive = await loadArchive(resolve(root, "data"));
  const result = await syncReadmeFile(root, archive, { write });

  for (const label of result.missing) {
    console.log(`${YELLOW}!${RESET} fant ikke raden for «${label}» i README.md — ikke rørt`);
  }
  if (result.changes.length === 0) {
    console.log(`${GREEN}✓${RESET} Tallene i README.md stemmer med arkivet.`);
    return;
  }
  for (const change of result.changes) {
    console.log(`  ${change.label}: ${change.from} → ${change.to}`);
  }
  if (write) {
    console.log(`${GREEN}✓${RESET} README.md er rettet. ${DIM}Commit den sammen med dataendringen.${RESET}`);
  } else {
    console.log(`${YELLOW}!${RESET} README.md er utdatert. Kjør «pnpm data:readme-stats -- --write» for å rette tallene.`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
