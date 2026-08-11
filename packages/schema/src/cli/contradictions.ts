/**
 * Rapport over det som motsier seg selv i arkivet, uten å endre noe.
 *
 * ## Hvorfor dette finnes
 *
 * Tre ganger under innhøstingen fra Nasjonalbiblioteket er en feil funnet av en
 * kontroll kjørt mot data som allerede var skrevet — ni kildehenvisninger til et
 * speilvendt resultat, 535 omtaler av en annen mann med samme navn, og en
 * lagoppstilling som endte «A A A A». Ingen av dem ble funnet av innhøsteren,
 * og ingen av enhetstestene kunne sett dem: feilene oppstår først i møtet med
 * det som alt står i arkivet.
 *
 * `pnpm validate` feiler på det den er sikker på. Denne kommandoen er laget for
 * det laget under: mønstre som nesten alltid betyr at noe er galt, men der bare
 * et menneske kan avgjøre hvilken av opplysningene som skal vike.
 *
 * Rapporterer, feller ikke bygget.
 */

import { dataDir, loadArchive } from "../load.js";
import type { Person } from "../person.js";

const DIM = "[2m";
const YELLOW = "[33m";
const GREEN = "[32m";
const RESET = "[0m";

/** Titler som er samme verv med to navn. Se `nb-apply`. */
const SAME_OFFICE: Record<string, string> = {
  styreleder: "formann",
  nestleder: "nestformann",
  varaformann: "nestformann",
};

function office(title: string): string {
  return SAME_OFFICE[title.toLowerCase()] ?? title.toLowerCase();
}

/** Verv der to samtidige innehavere ikke gir mening. */
const SINGULAR = new Set(["board", "administration", "sporting_staff"]);

const archive = await loadArchive(dataDir());
const findings: string[] = [];

/**
 * To personer i samme klubbverv samme år.
 *
 * Bare verv uten `body`: to gruppeformenn samme år er helt normalt, og det er
 * nettopp `body` som skiller dem.
 */
const holders = new Map<string, Person[]>();
for (const person of archive.people) {
  for (const role of person.roles) {
    if (!SINGULAR.has(role.category) || role.body) continue;
    const key = `${office(role.title)}|${role.from.slice(0, 4)}`;
    holders.set(key, [...(holders.get(key) ?? []), person]);
  }
}
for (const [key, people] of [...holders].sort()) {
  const names = [...new Set(people.map((person) => person.name))];
  if (names.length < 2) continue;
  const [title, year] = key.split("|");
  findings.push(`${YELLOW}to i samme verv${RESET}  ${title} ${year}: ${names.join(", ")}`);
}

/**
 * Et mindre presist verv ved siden av et mer presist, samme år.
 *
 * «Formann» og «Formann i banekomiteen» samme år er som regel den samme
 * opplysningen lest to ganger, én gang uten leddet som forklarer den. Som
 * regel — Georg Haller var faktisk begge deler i 1914.
 */
for (const person of archive.people) {
  for (const role of person.roles) {
    for (const other of person.roles) {
      if (other === role) continue;
      if (other.from.slice(0, 4) !== role.from.slice(0, 4)) continue;
      if (!other.title.toLowerCase().startsWith(`${role.title.toLowerCase()} `)) continue;
      findings.push(`${YELLOW}mindre presis${RESET}    ${person.name} ${role.from.slice(0, 4)}: «${role.title}» ved siden av «${other.title}»`);
    }
  }
}

/**
 * En kilde eldre enn personen den er ført på.
 *
 * Et navnetreff skiller ikke to som heter det samme. Arne Hansen spilte i 1986;
 * medlemsbladene fra 1961 omtaler en annen Arne Hansen.
 */
const sourceYear = new Map(archive.sources.map((source) => [source.id, source.year]));
for (const person of archive.people) {
  const years = [
    ...person.squadNumbers.map((entry) => entry.season),
    ...person.coachSpells.map((spell) => spell.fromSeason),
    ...person.roles.map((role) => Number(role.from.slice(0, 4))),
  ].filter((year) => Number.isFinite(year));
  if (years.length === 0) continue;
  const earliest = Math.min(...years);

  for (const source of person.sources) {
    const year = sourceYear.get(source.sourceId);
    if (year !== undefined && year < earliest - 5) {
      findings.push(`${YELLOW}kilde for gammel${RESET} ${person.name} (fra ${earliest}): ${source.sourceId} (${year})`);
    }
  }
}

/**
 * Navn som ikke er navn.
 *
 * Løse enkeltbokstaver uten punktum og hele ord i versaler er OCR-rester som
 * har sluppet gjennom et navnefilter et sted. Initialer som «R. Eck Olsen» er
 * derimot ekte, og lista blir verdiløs hvis den roper på dem.
 */
for (const person of archive.people) {
  for (const name of [person.name, ...person.names]) {
    const tokens = name.split(/\s+/);
    // «R.» og «Hans J.» er initialer, ikke støy. Det er den løse bokstaven uten
    // punktum som er OCR-rest — en oppstilling endte «… Leif Oterlei, A A A A».
    const suspect = tokens.some((token) => token.length < 2 && !token.endsWith("."))
      || /[[\]{}|<>]/.test(name)
      || tokens.some((token) => token.length > 3 && token === token.toUpperCase());
    if (suspect) findings.push(`${YELLOW}navn ser galt ut${RESET} ${person.id}: «${name}»`);
  }
}

if (findings.length === 0) {
  console.log(`${GREEN}✓${RESET} Fant ingen selvmotsigelser.`);
} else {
  for (const finding of findings) console.log(`  ${finding}`);
  console.log(`\n${DIM}${findings.length} funn. Rapporten endrer ingenting — vurder hvert tilfelle selv.${RESET}`);
}
