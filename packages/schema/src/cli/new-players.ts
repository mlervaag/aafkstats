/**
 * Rapport over nye spillere i kamptroppen, og om overgangen deres er ført inn.
 *
 * Samme rolle som `uncertain` og `duplicates`: `pnpm validate` feiler på det
 * den er sikker på, denne sier fra om det bare et menneske kan avgjøre. En
 * manglende overgang er ikke en datafeil — kilden kan mangle, eller spilleren
 * kan være hentet opp fra egen ungdomsavdeling uten at noen skrev om det.
 *
 * Kjøres uten argumenter ser den på de siste 30 dagene, som er vinduet en
 * rutine som kjøres etter kamp trenger. `--sesong 2026` tar hele sesongen,
 * `--fra 2020-01-01` en periode, og `--alle` hele arkivet.
 *
 * Sluttkoden er alltid 0. Rapporten er til for å leses, ikke til for å stoppe
 * en byggejobb.
 */

import { dataDir, loadArchive } from "../load.js";
import { newPlayers, type NewPlayer } from "../new-players.js";

const DIM = "[2m";
const YELLOW = "[33m";
const GREEN = "[32m";
const RESET = "[0m";

const DEFAULT_DAYS = 30;

interface Args {
  since?: string;
  season?: number;
}

function parseArgs(argv: string[]): Args {
  const value = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };

  if (argv.includes("--alle")) return {};

  const season = value("--sesong");
  if (season !== undefined) {
    const parsed = Number(season);
    if (!Number.isInteger(parsed)) throw new Error(`--sesong må være et årstall, ikke «${season}»`);
    return { season: parsed };
  }

  const since = value("--fra");
  if (since !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error(`--fra må være en dato (ÅÅÅÅ-MM-DD), ikke «${since}»`);
    return { since };
  }

  const cutoff = new Date(Date.now() - DEFAULT_DAYS * 24 * 60 * 60 * 1000);
  return { since: cutoff.toISOString().slice(0, 10) };
}

function window(args: Args): string {
  if (args.season !== undefined) return `sesongen ${args.season}`;
  if (args.since !== undefined) return `fra og med ${args.since}`;
  return "hele arkivet";
}

/** Én linje om hva arkivet vet om ankomsten. */
function explain({ debut, arrival }: NewPlayer): string {
  switch (arrival.status) {
    case "documented":
      return `${GREEN}✓${RESET} ${arrival.kind} fra ${arrival.club ?? "ukjent klubb"} (${arrival.date})`;
    case "later":
      return (
        `${YELLOW}!${RESET} eneste inngående overgang er ${arrival.date} — etter debuten `
        + `${debut.date}. Enten er datoen feil, eller så mangler ankomsten han faktisk spilte på.`
      );
    case "undocumented":
      return `${YELLOW}!${RESET} personfila har ingen inngående overgang`;
    case "unknown":
      return `${YELLOW}!${RESET} ingen personfil — data/people/ har ikke navnet`;
  }
}

const args = parseArgs(process.argv.slice(2));
const archive = await loadArchive(dataDir());
const players = newPlayers(archive, args);
const open = players.filter((player) => player.arrival.status !== "documented");

console.log(`Nye spillere i kamptroppen · ${window(args)}\n`);

if (players.length === 0) {
  console.log(`${GREEN}✓${RESET} Ingen debutanter i vinduet.`);
} else {
  for (const player of players) {
    const { debut } = player;
    const rolle = debut.role === "start" ? "fra start" : "på benken";
    console.log(`  ${debut.name}${debut.personId === undefined ? "" : ` ${DIM}(${debut.personId})${RESET}`}`);
    console.log(`    ${DIM}debut ${debut.date} ${rolle} · ${debut.matchId}${RESET}`);
    console.log(`    ${explain(player)}`);
    console.log();
  }

  const alle = players.length === 1 ? "Debutanten har" : `Alle ${players.length} debutantene har`;
  const summary =
    open.length === 0
      ? `${GREEN}✓${RESET} ${alle} en overgang som forklarer ankomsten.`
      : `${YELLOW}!${RESET} ${open.length} av ${players.length} debutant${players.length === 1 ? "" : "er"} mangler en overgang.`;
  console.log(summary);
}

if (open.length > 0) {
  console.log(
    `\n${DIM}Dette er en rapport, ikke en feil. En overgang skrives bare inn når en kilde\n`
    + `sier den: se «ingest:wikipedia-transfers» og «ingest:nb-transfer-candidates» for\n`
    + `kandidater, og før den inn i data/people/<id>.yaml med kilden som sa den.${RESET}`,
  );
}
