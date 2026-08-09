/**
 * Rapport over opplysninger som ser tvilsomme ut, uten å endre noe.
 *
 * Samme rolle som `duplicates`: `pnpm validate` feiler på det den er sikker på,
 * denne sier fra om det bare et menneske kan avgjøre.
 *
 * Den finnes fordi et 14-0 borte mot et Bryne som endte på tredjeplass sto i
 * arkivet merket «confirmed», og ingen kontroll hadde noe å si om det. Feilen
 * lå ikke i importen: fotball.no oppgir tallet, og NFFs egen tabell er regnet
 * ut av det samme tallet, så de to bekrefter ikke hverandre. Et arkiv som lever
 * av etterprøvbarhet må kunne peke på hvilke tall som fortjener et blikk.
 */

import { dataDir, loadArchive } from "../load.js";
import type { Match } from "../match.js";

const DIM = "[2m";
const YELLOW = "[33m";
const GREEN = "[32m";
const RESET = "[0m";

const archive = await loadArchive(dataDir());

interface Finding {
  match: Match & { file: string };
  why: string;
}

/**
 * Målforskjellen der en seriekamp slutter å være troverdig.
 *
 * Terskelen er høyere i cupen og i lavere divisjoner, der et toppklubblag møter
 * et lag fra kretsserien og elleve mål er et helt vanlig resultat. I en serie
 * spiller lagene på omtrent samme nivå, og da er åtte måls margin sjeldent nok
 * til å fortjene en kontroll.
 */
const LEAGUE_MARGIN = 8;

const byId = new Map(archive.competitions.map((c) => [c.id, c]));

const findings: Finding[] = [];

for (const match of archive.matches) {
  const home = match.home.score;
  const away = match.away.score;
  if (home === null || home === undefined || away === null || away === undefined) continue;

  const competition = byId.get(match.competition.id);
  const margin = Math.abs(home - away);

  // Et stort siffer i en serie der lagene ligger på samme nivå.
  if (competition?.type === "league" && margin >= LEAGUE_MARGIN) {
    findings.push({
      match,
      why: `${home}-${away} i ${competition.name}, ${margin} måls margin mellom lag på samme nivå`,
    });
    continue;
  }

  // Et resultat merket «bekreftet» på én kilde alene er en sterkere påstand enn
  // arkivet kan stå inne for. Rapporteres bare når marginen også er stor, ellers
  // ville hele NFF-importen stått her.
  if (match.confidence === "confirmed" && match.providers.length < 2 && margin >= LEAGUE_MARGIN) {
    findings.push({
      match,
      why: `${home}-${away} merket «confirmed» med bare én kilde (${match.providers[0]?.providerId ?? "ingen"})`,
    });
  }
}

if (findings.length === 0) {
  console.log(`${GREEN}✓${RESET} Ingen mistenkelige resultater. ${DIM}${archive.matches.length} kamper${RESET}`);
} else {
  console.log(
    `${YELLOW}!${RESET} ${findings.length} resultat${findings.length === 1 ? "" : "er"} verdt et blikk:\n`,
  );
  for (const { match, why } of findings) {
    const merket = match.confidence === "confirmed" ? `${YELLOW}confirmed${RESET}` : match.confidence;
    console.log(`  ${match.id}`);
    console.log(`    ${DIM}${why} · ${merket}${RESET}`);
    if (match.note) console.log(`    ${DIM}${match.note.trim().split("\n")[0]}${RESET}`);
    console.log();
  }
  console.log(
    `${DIM}Dette er en rapport, ikke en feil. Er tallet riktig, la det stå. Er det ikke\n` +
      `kontrollert mot en uavhengig kilde, hører «probable» hjemme framfor «confirmed».${RESET}`,
  );
}
