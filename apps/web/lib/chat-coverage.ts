import { open } from "@aafkstats/db";
import { readCoverage } from "@aafkstats/query/coverage";
import type { DatasetCoverage } from "@aafkstats/query/coverage";

/**
 * Dekningstallene, lest én gang per prosess.
 *
 * Leses ved første forespørsel og ikke ved import: en modul som åpner databasen
 * mens den lastes, feiler i testene og i ethvert bygg som ikke har arkivfila
 * ennå. Arkivet kan ikke endre seg mens prosessen lever, det bygges ved
 * utrulling, så én lesing er nok, og systemprompten forblir identisk mellom
 * kall slik prompt-cachen krever.
 *
 * Bor her og ikke i én av modellklientene fordi begge trenger den, og to
 * kopier kunne gitt Anthropic-svaret og OpenAI-svaret ulike tall om samme arkiv.
 */
let coverage: DatasetCoverage | undefined;

export function datasetCoverage(): DatasetCoverage | undefined {
  if (coverage) return coverage;
  try {
    const db = open();
    try {
      coverage = readCoverage(db);
    } finally {
      db.close();
    }
  } catch {
    // Uten arkivfil svarer vi fortsatt, bare uten dekningstall i prompten.
    // Modellen slår da opp omfanget selv i stedet for å få det servert.
    return undefined;
  }
  return coverage;
}
