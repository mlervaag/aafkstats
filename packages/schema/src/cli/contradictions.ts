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

/**
 * Er vervet klubbens eget, eller et underorgans?
 *
 * `body` skiller dem — men «Hovedstyret» er ikke et underorgan, det *er*
 * klubben. aafk.no-høstingen setter det uttrykkelig på formannsrekka, og en
 * prøve som bare spør om `body` finnes, leste den som «gjelder ikke klubben».
 * Da kunne en formann fra et medlemsblad legge seg oppå den uten at noe sa fra.
 */
function clubWide(body: string | undefined): boolean {
  return body === undefined || body.toLowerCase() === "hovedstyret";
}

function office(title: string): string {
  return SAME_OFFICE[title.toLowerCase()] ?? title.toLowerCase();
}

/**
 * Årene en rolle dekker.
 *
 * Et verv oppgitt som «1946 - 1949» opptar fire år, ikke ett. Uten det ville
 * «Sigurd Nørve 1946-1949» og «Per Anker Eriksen 1948» sett ut som to verv i
 * hvert sitt år, selv om de sier at klubben hadde to formenn i 1948.
 */
function span(from: string, to: string | null): string[] {
  const first = Number(from.slice(0, 4));
  const last = to ? Number(to.slice(0, 4)) : first;
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first || last - first > 40) return [String(first)];
  return Array.from({ length: last - first + 1 }, (_, step) => String(first + step));
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
    if (!SINGULAR.has(role.category) || !clubWide(role.body)) continue;
    for (const year of span(role.from, role.to)) {
      const key = `${office(role.title)}|${year}`;
      holders.set(key, [...(holders.get(key) ?? []), person]);
    }
  }
}
/**
 * Et delt grenseår er et lederskifte, ikke to ledere.
 *
 * Klubbens egen lederliste oppgir perioder med inklusive endepunkter, og to
 * påfølgende ledere deler året skiftet skjedde: «Torill Hole Standal 2007-2011»
 * og «Kjell Tennfjord 2011-2015». Uten dette roper rapporten på hvert eneste
 * skifte, og da slutter noen å lese den.
 */
function handover(people: Person[], title: string, year: number): boolean {
  const spans = people.map((person) => person.roles
    .filter((role) => office(role.title) === title && SINGULAR.has(role.category) && clubWide(role.body))
    .map((role) => [Number(role.from.slice(0, 4)), role.to ? Number(role.to.slice(0, 4)) : Number(role.from.slice(0, 4))] as const)
    .find(([from, to]) => from <= year && year <= to));
  if (spans.some((found) => found === undefined)) return false;
  const ends = spans.filter((found) => found![1] === year).length;
  const starts = spans.filter((found) => found![0] === year).length;
  return ends >= 1 && starts >= 1 && ends + starts === spans.length;
}

for (const [key, people] of [...holders].sort()) {
  const unique = [...new Map(people.map((person) => [person.id, person])).values()];
  if (unique.length < 2) continue;
  const [title, year] = key.split("|");
  if (handover(unique, title!, Number(year))) continue;
  findings.push(`${YELLOW}to i samme verv${RESET}  ${title} ${year}: ${unique.map((person) => person.name).join(", ")}`);
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
 * En trener arkivet vet at noen andre var.
 *
 * Kampene oppgir hvem som ledet laget, og fra 2010 er de nær komplette. En
 * trenerrolle lest ut av en bok, i et år der kampene sier noe annet, er nesten
 * alltid en annen klubbs trener omtalt i vår bok: «ga RBK-trener Per Joar
 * Hansen denne karakteristikken» ga ham trenerjobben i 2013, mens Jan Jönsson
 * ledet laget i tretti kamper samme år.
 */
const coachBySeason = new Map<number, Map<string, number>>();
for (const match of archive.matches) {
  const ours = match.home.clubId === "aalesunds-fk" ? match.lineups?.home : match.lineups?.away;
  const coach = ours?.coach;
  if (!coach) continue;
  const season = coachBySeason.get(match.competition.season) ?? new Map<string, number>();
  season.set(coach, (season.get(coach) ?? 0) + 1);
  coachBySeason.set(match.competition.season, season);
}

for (const person of archive.people) {
  for (const role of person.roles) {
    if (role.category !== "coach") continue;
    const season = coachBySeason.get(Number(role.from.slice(0, 4)));
    if (!season || season.size === 0) continue;
    const [known] = [...season].sort((a, b) => b[1] - a[1]);
    if (!known || known[0] === person.name) continue;
    if ([...season.keys()].includes(person.name)) continue;
    findings.push(`${YELLOW}annen trener${RESET}     ${person.name} oppført som trener ${role.from.slice(0, 4)}, men kampene sier ${known[0]} (${known[1]} kamper)`);
  }
}

/**
 * En trenerrolle som strekker seg utenfor den oppgitte perioden.
 *
 * Arkivet holder oppgitte trenerperioder i `coachSpells` og verv i `roles`, og
 * kildene bruker ulike ord om samme jobb: aafk.no og Wikipedia sier
 * «Hovedtrener», bøkene lister «Trener» år for år. At begge finnes er ikke i
 * seg selv et problem — visningen slår dem sammen, og bokas sidetall er verdt
 * å beholde. Det som er verdt et menneskeblikk, er året som stikker ut: en
 * bok som gir en trener et år den oppgitte perioden ikke dekker, sier enten at
 * perioden er for kort eller at boka omtaler en annen klubbs trener.
 */
for (const person of archive.people) {
  for (const spell of person.coachSpells) {
    const spellYears = span(String(spell.fromSeason), spell.toSeason === null ? null : String(spell.toSeason));
    // Én linje per periode, ikke per rad: bøkene lister trenerne år for år, og
    // Kjetil Rekdal ga fire like funn av samme grunn.
    const overlapping = person.roles.filter((role) => role.category === "coach"
      && span(role.from, role.to).some((year) => spellYears.includes(year)));
    // Bare årene som stikker utenfor. Ligger rolla helt inni perioden, sier de
    // to det samme med hvert sitt ord, og det er ingenting å avgjøre.
    const outside = [...new Set(overlapping
      .flatMap((role) => span(role.from, role.to))
      .filter((year) => !spellYears.includes(year)))].sort();
    if (outside.length === 0) continue;
    const titles = [...new Set(overlapping.map((role) => role.title))].join("/");
    findings.push(`${YELLOW}trener utenfor${RESET}   ${person.name}: oppgitt periode ${spell.fromSeason}-${spell.toSeason ?? ""}, men «${titles}» også ${outside.join(", ")}`);
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
