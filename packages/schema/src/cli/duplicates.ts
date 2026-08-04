/**
 * Rapport over det som *ligner* dubletter, uten å endre noe.
 *
 * `pnpm validate` feiler på det den er sikker på: to klubber med samme
 * kanoniske identitet, to kamper på samme dato mot samme motstander. Denne
 * kommandoen er for det laget under — navn som er mistenkelig like, men der
 * bare et menneske kan avgjøre om det er én klubb eller to.
 *
 * Skillet er med vilje. «Vard Haugesund» og «Haugesund» er to klubber. «Ørn
 * Horten» og «Ørn-Horten» er én. Ingen regel skiller dem, så maskinen sier fra
 * og lar det være med det.
 */

import { canonicalClubKey, clubKey } from "../identity.js";
import { dataDir, loadArchive } from "../load.js";
import type { Club } from "../entities.js";

const DIM = "[2m";
const YELLOW = "[33m";
const GREEN = "[32m";
const RESET = "[0m";

const archive = await loadArchive(dataDir());

/**
 * Levenshtein-avstand, avkortet: vi trenger bare å vite om den er liten.
 *
 * Uten taket ville hver klubb sammenlignes fullt ut mot hver andre klubb, og
 * det er 128 × 128 kjøringer for å finne noen få par.
 */
function closeEnough(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(current[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + cost);
      current.push(value);
      best = Math.min(best, value);
    }
    if (best > max) return false;
    previous = current;
  }
  return previous[b.length]! <= max;
}

const label = (club: Club) => `${club.id} ${DIM}«${club.name}»${RESET}`;

// ── Klubber med samme kanoniske identitet. Dette er de valideringen alt feiler
//    på; de tas med her så rapporten er komplett når noen kjører den først.
const byIdentity = new Map<string, Club[]>();
for (const club of archive.clubs) {
  const key = canonicalClubKey(club);
  byIdentity.set(key, [...(byIdentity.get(key) ?? []), club]);
}
const identical = [...byIdentity].filter(([, group]) => group.length > 1);

// ── Klubber som er nesten like. Én tegns forskjell etter normalisering fanger
//    bindestrek, dobbeltkonsonant og de vanligste stavefeilene.
const near: [Club, Club][] = [];
for (let i = 0; i < archive.clubs.length; i++) {
  for (let j = i + 1; j < archive.clubs.length; j++) {
    const a = archive.clubs[i]!;
    const b = archive.clubs[j]!;
    const ka = canonicalClubKey(a);
    const kb = canonicalClubKey(b);
    if (ka === kb) continue;
    if (closeEnough(ka, kb, 1)) near.push([a, b]);
  }
}

// ── Kamper på samme dato der motstanderen normaliserer likt, men klubb-ID-ene
//    er ulike. Dette er formen Haugesund-dubletten hadde.
const AAFK = "aalesunds-fk";
const identityOf = new Map(archive.clubs.map((club) => [club.id, canonicalClubKey(club)]));
const byFixture = new Map<string, { file: string; opponent: string }[]>();
for (const match of archive.matches) {
  const opponentId = match.home.clubId === AAFK ? match.away.clubId : match.home.clubId;
  const key = `${match.date}|${identityOf.get(opponentId) ?? clubKey(opponentId)}`;
  byFixture.set(key, [...(byFixture.get(key) ?? []), { file: match.file, opponent: opponentId }]);
}
const sameFixture = [...byFixture].filter(([, group]) => group.length > 1);

let found = 0;

if (identical.length > 0) {
  found += identical.length;
  console.log(`${YELLOW}Samme kanoniske identitet${RESET} ${DIM}(valideringen feiler på disse)${RESET}`);
  for (const [key, group] of identical) {
    console.log(`  ${key}: ${group.map(label).join(", ")}`);
  }
  console.log("");
}

if (near.length > 0) {
  found += near.length;
  console.log(`${YELLOW}Nesten like navn${RESET} ${DIM}(kan være samme klubb — vurder manuelt)${RESET}`);
  for (const [a, b] of near) console.log(`  ${label(a)}  vs  ${label(b)}`);
  console.log("");
}

if (sameFixture.length > 0) {
  found += sameFixture.length;
  console.log(`${YELLOW}Samme dato og motstander${RESET}`);
  for (const [key, group] of sameFixture) {
    console.log(`  ${key}`);
    for (const entry of group) console.log(`    ${entry.file} ${DIM}(${entry.opponent})${RESET}`);
  }
  console.log("");
}

if (found === 0) {
  console.log(`${GREEN}✓${RESET} Ingen mistenkelige dubletter. ${DIM}${archive.clubs.length} klubber · ${archive.matches.length} kamper${RESET}`);
} else {
  console.log(`${DIM}${found} funn. Rapporten endrer ingenting — vurder hvert par selv.${RESET}`);
}

// Rapporten skal kunne kjøres i CI uten å felle bygget. Det er valideringens jobb.
process.exit(0);
