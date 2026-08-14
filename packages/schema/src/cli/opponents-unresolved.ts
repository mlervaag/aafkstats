/**
 * Rapport over kildedokumenterte resultater (source-results) som mangler `opponentClubId`.
 *
 * Rapporten analyserer original kildetekst (`opponent`) og foreslår mulige klubbkandidater
 * basert på eksakt navn, kortnavn, historiske navn, `nameVariants` og forsiktig normalisering.
 *
 * VIKTIG: Dette skriptet endrer ingenting automatisk. "Navnelikhet er et kandidatgrunnlag, ikke bevis."
 */

import { clubKey, clubNameForms } from "../identity.js";
import { dataDir, loadArchive } from "../load.js";
import type { Club } from "../entities.js";
import { flattenSourceResults, type SourceResult } from "../source-result.js";

const DIM = "\x1b[2m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

export interface CandidateResolution {
  club: Club | null;
  matchType:
    | "exact name"
    | "exact shortName"
    | "exact historical name"
    | "exact nameVariant"
    | "normalized candidate"
    | "ambiguous"
    | "none";
  ambiguousCandidates?: Club[];
}

export function resolveOpponentCandidate(opponentText: string, clubs: Club[]): CandidateResolution {
  const target = opponentText.trim();
  const lower = target.toLowerCase();

  // 1. Eksakt match mot name
  const exactName = clubs.find((c) => c.name.toLowerCase() === lower);
  if (exactName) return { club: exactName, matchType: "exact name" };

  // 2. Eksakt match mot shortName
  const exactShort = clubs.find((c) => c.shortName && c.shortName.toLowerCase() === lower);
  if (exactShort) return { club: exactShort, matchType: "exact shortName" };

  // 3. Eksakt match mot historiske navn i names[]
  const exactHist = clubs.find((c) => (c.names ?? []).some((n) => n.name.toLowerCase() === lower));
  if (exactHist) return { club: exactHist, matchType: "exact historical name" };

  // 4. Eksakt match mot nameVariants[]
  const exactVariant = clubs.find((c) => (c.nameVariants ?? []).some((v) => v.toLowerCase() === lower));
  if (exactVariant) return { club: exactVariant, matchType: "exact nameVariant" };

  // 5. Forsiktig normalisert matching
  const normKey = clubKey(target);
  const normCandidates = clubs.filter((c) => clubNameForms(c).some((form) => clubKey(form) === normKey));

  if (normCandidates.length === 1) {
    return { club: normCandidates[0]!, matchType: "normalized candidate" };
  }
  if (normCandidates.length > 1) {
    return { club: null, matchType: "ambiguous", ambiguousCandidates: normCandidates };
  }

  return { club: null, matchType: "none" };
}

const archive = await loadArchive(dataDir());
const clubs = archive.clubs;

const unresolvedByOpponent = new Map<string, SourceResult[]>();
let totalCount = 0;

for (const col of archive.sourceResults) {
  for (const res of flattenSourceResults(col)) {
    if (res.opponent && !res.opponentClubId) {
      totalCount++;
      const key = res.opponent.trim();
      const list = unresolvedByOpponent.get(key) ?? [];
      list.push(res);
      unresolvedByOpponent.set(key, list);
    }
  }
}

console.log(`${CYAN}Ukoblede motstandernavn i kilderesultater (source-results)${RESET}`);
console.log(`${DIM}Analyserer kilder mot ${clubs.length} registrerte klubber...${RESET}\n`);

if (unresolvedByOpponent.size === 0) {
  console.log(`${GREEN}✓${RESET} Alle kilderesultater med motstander har registrert opponentClubId.`);
  process.exit(0);
}

const sortedGroups = [...unresolvedByOpponent.entries()].sort((a, b) => b[1].length - a[1].length);

console.log(`${YELLOW}Aggregert oversikt over ukoblede motstanderstrenger:${RESET}`);
console.log("─".repeat(95));
console.log(
  "Motstanderstreng".padEnd(25)
  + "Antall".padStart(6)
  + "  "
  + "Sesonger".padEnd(28)
  + "Kandidat".padEnd(16)
  + "Matchtype",
);
console.log("─".repeat(95));

for (const [opponentText, items] of sortedGroups) {
  const resolution = resolveOpponentCandidate(opponentText, clubs);
  const seasons = [...new Set(items.map((i) => i.season))].sort((a, b) => a - b);
  const seasonStr = seasons.length <= 5 ? seasons.join(", ") : `${seasons.slice(0, 4).join(", ")}.. (${seasons.length} år)`;

  let candStr = "-";
  let reasonStr = `${DIM}Ingen kjent klubb${RESET}`;

  if (resolution.club) {
    candStr = resolution.club.id;
    reasonStr = `${GREEN}${resolution.matchType}${RESET}`;
  } else if (resolution.matchType === "ambiguous") {
    candStr = `${YELLOW}?${RESET}`;
    const ambig = (resolution.ambiguousCandidates ?? []).map((c) => c.id).join(", ");
    reasonStr = `${YELLOW}Tvetydig (${ambig})${RESET}`;
  }

  console.log(
    opponentText.padEnd(25)
    + String(items.length).padStart(6)
    + "  "
    + seasonStr.padEnd(28)
    + candStr.padEnd(16)
    + reasonStr,
  );
}

console.log("─".repeat(95));
console.log(`Totalt: ${totalCount} ukoblede forekomster fordelt på ${unresolvedByOpponent.size} unike motstanderstrenger.`);
console.log(`${DIM}Tips: Rediger data/clubs/*.yaml med nameVariants og sett opponentClubId i data/source-results/*.yaml manuelt.${RESET}\n`);

process.exit(0);
