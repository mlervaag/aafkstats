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

import { canonicalClubKey, clubKey, isLongerNameForm, personKey } from "../identity.js";
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

/**
 * Klubber der den ene nøkkelen er den andre pluss et ledd til.
 *
 * Levenshtein fanger stavefeil, ikke påhengte ord. NFF Fotballdata skriver
 * «Volda TI - Fotball» der RSSSF skriver «Volda», og de to nøklene ligger fire
 * tegn fra hverandre — langt utenfor taket. Fire klubber lå dobbelt i arkivet i
 * nettopp den formen uten at rapporten sa et ord.
 *
 * Leddgrensa er med vilje: uten den ville «Brann» og «Brandbu» vært et par.
 * «Vard Haugesund» og «Haugesund» blir fortsatt ikke det, siden det er den
 * *første* nøkkelen som må være hel — der er «vard» påhenget, ikke «haugesund».
 *
 * Et påheng som bare er et tall er aldri samme post: «Molde 2» er andrelaget og
 * «Sarpsborg 08» er stiftelsesåret i navnet. Uten unntaket sto rapporten med tre
 * funn som aldri kan lukkes, og en rapport som alltid er gul blir ikke lest.
 */
const NUMERIC_TAIL = /^\d+$/;
const extended: [Club, Club][] = [];
for (let i = 0; i < archive.clubs.length; i++) {
  for (let j = 0; j < archive.clubs.length; j++) {
    if (i === j) continue;
    const a = archive.clubs[i]!;
    const b = archive.clubs[j]!;
    const ka = canonicalClubKey(a);
    const kb = canonicalClubKey(b);
    if (ka === kb || !kb.startsWith(`${ka}-`)) continue;
    if (NUMERIC_TAIL.test(kb.slice(ka.length + 1))) continue;
    if (near.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) continue;
    extended.push([a, b]);
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

if (extended.length > 0) {
  found += extended.length;
  console.log(`${YELLOW}Samme navn med et ledd til${RESET} ${DIM}(kildens lange form? — vurder manuelt)${RESET}`);
  for (const [a, b] of extended) console.log(`  ${label(a)}  ⊂  ${label(b)}`);
  console.log("");
}

/**
 * Personnavn som ligner på hverandre.
 *
 * `personKey` slår sammen ren translitterasjon — «Jönsson» og «Joensson» er
 * samme mann. Alt annet lar den stå, og det er her de havner: «Mathias
 * Kristensen» og «Mathias Christensen» kan være én mann feilstavet eller to
 * menn, og bare et menneske kan avgjøre det.
 *
 * Navnene finnes bare inne i lagoppstillingene, så de plukkes ut derfra.
 */
const nameCounts = new Map<string, number>();
for (const match of archive.matches) {
  const side = match.home.clubId === AAFK ? match.lineups?.home : match.lineups?.away;
  if (!side) continue;
  for (const person of [...(side.starters ?? []), ...(side.subs ?? []), side.coach ?? ""]) {
    if (person === "") continue;
    nameCounts.set(person, (nameCounts.get(person) ?? 0) + 1);
  }
}
// Personer som allerede er ført som hver sin fil er avgjort. «Mathias
// Kristensen» og «Mathias Christensen» sto her til Wikipedia viste at de har
// hvert sitt draktnummer og hver sin nasjonalitet; nå er de to poster, og da er
// det ingenting igjen å vurdere.
const declaredPerson = new Map<string, string>();
for (const entry of archive.people) {
  for (const written of [entry.name, ...entry.names]) declaredPerson.set(personKey(written), entry.id);
}
const settled = (a: string, b: string) => {
  const first = declaredPerson.get(a);
  const second = declaredPerson.get(b);
  return first !== undefined && second !== undefined && first !== second;
};

const personKeys = [...new Set([...nameCounts.keys()].map(personKey))].sort();
const nearPeople: [string, string][] = [];
for (let i = 0; i < personKeys.length; i++) {
  for (let j = i + 1; j < personKeys.length; j++) {
    const a = personKeys[i]!;
    const b = personKeys[j]!;
    if (closeEnough(a, b, 2) && !settled(a, b)) nearPeople.push([a, b]);
  }
}

/**
 * Navneformer fra kildene som ingen personfil fanger opp.
 *
 * ## Feilen dette retter
 *
 * `personKey` bytter tegn, og rapporten over finner stavefeil på inntil to
 * tegn. Ingen av delene ser et mellomnavn. FotMob skriver «Sten Michael
 * Grytebust» i lagoppstillingene, personfila heter «Sten Grytebust», og de to
 * ligger åtte tegn fra hverandre — langt utenfor taket. Resultatet var at
 * personsida til klubbens keeper viste null kamper mens arkivet hadde 284 av
 * dem, og ingenting sa fra.
 *
 * Formen er den samme som klubbrapporten over: kildens lange form mot arkivets
 * korte. Der het den «Volda TI - Fotball» mot «Volda»; her heter den
 * mellomnavn.
 *
 * Selve regelen er `isLongerNameForm` i identity.ts, ved siden av `personKey`
 * og `clubKey`. Den hører hjemme der de andre identitetsreglene bor, og der kan
 * den testes.
 *
 * ## Hva rapporten *ikke* gjør
 *
 * Den kobler ingenting. Et treff her betyr at et menneske bør se på paret og,
 * hvis det stemmer, føre kildens form inn i `names[]` på personfila. Da fanger
 * `core_person_names` den ved neste bygging, og rånavnet fra kilden blir
 * stående i lagoppstillingen der det hører hjemme.
 *
 * Treffer én form flere personer, står alle kandidatene. Det er nettopp da
 * maskinen ikke skal velge.
 */
const unlinked = new Map<string, { count: number; candidates: string[] }>();
for (const [written, count] of nameCounts) {
  if (declaredPerson.has(personKey(written))) continue;
  const candidates: string[] = [];
  for (const entry of archive.people) {
    for (const declared of [entry.name, ...entry.names]) {
      if (isLongerNameForm(declared, written)) candidates.push(`${entry.id} ${DIM}«${declared}»${RESET}`);
    }
  }
  if (candidates.length > 0) unlinked.set(written, { count, candidates: [...new Set(candidates)] });
}

if (unlinked.size > 0) {
  found += unlinked.size;
  console.log(
    `${YELLOW}Kildens navneform mangler i personfila${RESET} `
    + `${DIM}(samme person? — før den inn i names[] hvis den er det)${RESET}`,
  );
  for (const [written, { count, candidates }] of [...unlinked].sort()) {
    const matches = count === 1 ? "1 kamp" : `${count} kamper`;
    console.log(`  ${DIM}«${RESET}${written}${DIM}»${RESET} ${DIM}(${matches})${RESET}`);
    for (const candidate of candidates) console.log(`    ⊂ ${candidate}`);
  }
  console.log("");
}

if (nearPeople.length > 0) {
  found += nearPeople.length;
  console.log(`${YELLOW}Nesten like personnavn${RESET} ${DIM}(kan være samme person — vurder manuelt)${RESET}`);
  for (const [a, b] of nearPeople) console.log(`  ${a}  vs  ${b}`);
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
