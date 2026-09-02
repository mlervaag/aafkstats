import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { stringify } from "yaml";
import {
  clubKey,
  personKey,
  personPath,
  slugify,
  transferSeason,
  type Person,
  type Transfer,
} from "@aafkstats/schema";
import { crossValidate, dataDir, loadArchive } from "@aafkstats/schema/load";
import { fetchJson } from "../http.js";
import {
  parseTransferRows,
  windowFromTitle,
  type WikipediaTransferRow,
} from "../adapters/wikipedia-transfers.js";

/**
 * Overganger fra engelsk Wikipedias norske overgangslister.
 *
 * ## Hvorfor akkurat denne kilden
 *
 * `docs/OVERGANGER_KILDER.md` målte sju kandidater. Denne er den eneste som er
 * strukturert nok til å leses maskinelt: 31 artikler dekker hvert overgangs-
 * vindu fra 2010, hver klubb har sin egen seksjon med «In:» og «Out:», og hver
 * rad bærer en fotnote til klubbens egen melding.
 *
 * ## Hva som faktisk kildeføres
 *
 * Ikke Wikipedia. Artikkelen er et register over hvor primærkildene ligger, og
 * fotnoten peker på klubbmeldingen som er den egentlige kilden. Den lagres som
 * en leverandørhenvisning med adresse og hentetid, og meldingens tittel og dato
 * står i notatet. En rad uten fotnote skrives ikke: da mangler den nettopp det
 * arkivet krever av en overgang.
 *
 * ## Hva verktøyet ikke gjør
 *
 * Det gjetter ikke. En klubb som ikke finnes i `data/clubs/` får ingen `clubId`,
 * bare kildens egen skrivemåte. To spillere som normaliserer til samme navn blir
 * rapportert og hoppet over, ikke slått sammen. Og uten `--write` skrives ingen
 * fil — standarden er tørrkjøring, som resten av innhøstingen i dette repoet.
 */

const API = "https://en.wikipedia.org/w/api.php";

const args = parseArgs({
  args: process.argv.slice(2).filter((argument, index) => argument !== "--" || index > 0),
  options: {
    /** Bare vinduer fra og med denne sesongen. */
    from: { type: "string" },
    to: { type: "string" },
    write: { type: "boolean" },
    json: { type: "boolean" },
  },
});

const fromSeason = args.values.from === undefined ? 0 : Number(args.values.from);
const toSeason = args.values.to === undefined ? 9999 : Number(args.values.to);

interface SearchResponse {
  query: { search: { title: string }[] };
}

interface ParseResponse {
  parse: { title: string; pageid: number; revid?: number; wikitext: { "*": string } };
}

/** Artiklene som finnes, spurt opp i stedet for skrevet ned. Nye vinduer kommer til. */
async function listArticles(): Promise<string[]> {
  const url = `${API}?${new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: 'intitle:"List of Norwegian football transfers"',
    srlimit: "50",
    format: "json",
  })}`;
  const response = await fetchJson<SearchResponse>(url);
  return response.query.search.map((entry) => entry.title).sort();
}

async function articleWikitext(title: string): Promise<ParseResponse["parse"]> {
  // `prop=wikitext` alene svarer uten revisjonsnummer, og en permalenke uten det
  // peker ingen steder. `prop=wikitext|revid` gir nummeret vi faktisk leste.
  const url = `${API}?${new URLSearchParams({
    action: "parse", page: title, prop: "wikitext|revid", format: "json",
  })}`;
  return (await fetchJson<ParseResponse>(url)).parse;
}

/**
 * Permalenke til nøyaktig den revisjonen vi leste.
 *
 * Uten revisjonsnummeret er lenken bare «artikkelen slik den er i dag», og da
 * kan ingen kontrollere hva arkivet faktisk leste. Mangler nummeret, lenker vi
 * til artikkelen ved navn i stedet for å skrive `oldid=undefined`.
 */
function permalink(article: ParseResponse["parse"]): string {
  if (article.revid === undefined) {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(article.title.replace(/ /g, "_"))}`;
  }
  return `https://en.wikipedia.org/w/index.php?oldid=${article.revid}`;
}

const root = dataDir();
const archive = await loadArchive(root);
const today = new Date().toISOString().slice(0, 10);

// Klubbnavn slik arkivet kjenner dem. Bare et treff på normalisert navn gir
// clubId; alt annet står som kildens tekst, uten kobling.
const clubIdByKey = new Map<string, string>();
for (const club of archive.clubs) {
  for (const form of [club.name, club.shortName, ...club.nameVariants, ...club.names.map((n) => n.name)]) {
    if (form) clubIdByKey.set(clubKey(form), club.id);
  }
}

// Hver skrivemåte som allerede er ført på en person. Treffer en spiller her, skal
// overgangen inn i den fila og ikke i en ny.
const personIdByNameKey = new Map<string, string>();
for (const person of archive.people) {
  for (const form of [person.name, ...person.names]) {
    personIdByNameKey.set(personKey(form), person.id);
  }
}
const byId = new Map(archive.people.map((person) => [person.id, structuredClone(person) as Person]));

const issues: string[] = [];
const touched = new Set<string>();
let rowsSeen = 0;
let withoutRef = 0;
let alreadyPresent = 0;
const added: { personId: string; transfer: Transfer }[] = [];

/**
 * Om adressen faktisk peker på klubbens eget nettsted.
 *
 * Verten må sammenlignes som vert, ikke som delstreng. «Inneholder aafk.no» er
 * sant også for `https://aafk.no.example.com/`, og da ville arkivet tilskrevet
 * klubben en melding den ikke har skrevet. Et ugyldig eller manglende URL gir
 * nei, ikke et unntak.
 */
function isClubSite(url: string | undefined): boolean {
  if (url === undefined) return false;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === "aafk.no" || host.endsWith(".aafk.no");
}

/** ID-en overgangen får i personfila. Stabil, og lesbar i en diff. */
function transferId(row: WikipediaTransferRow, season: number, taken: Set<string>): string {
  const side = row.direction === "in" ? "inn" : "ut";
  const what = row.club ? slugify(row.club) : row.kind;
  let candidate = `${side}-${what || row.kind}-${season}`;
  // To overganger samme vei til samme klubb samme år finnes: en spiller kan
  // lånes ut og hentes hjem igjen. Suffikset skiller dem uten å skjule noe.
  let counter = 2;
  while (taken.has(candidate)) {
    candidate = `${side}-${what || row.kind}-${season}-${counter}`;
    counter += 1;
  }
  taken.add(candidate);
  return candidate;
}

const articles = (await listArticles()).filter((title) => {
  const window = windowFromTitle(title);
  return window !== null && window.season >= fromSeason && window.season <= toSeason;
});

for (const title of articles) {
  let article: ParseResponse["parse"];
  try {
    article = await articleWikitext(title);
  } catch (error) {
    issues.push(`${title}: kunne ikke hentes (${String(error)})`);
    continue;
  }
  const window = windowFromTitle(article.title);
  if (!window) continue;

  const rows = parseTransferRows(article.wikitext["*"]);
  rowsSeen += rows.length;

  for (const row of rows) {
    // En rad uten fotnote har ingen kilde å vise til, og skal ikke inn.
    const reference = row.refs.find((ref) => ref.url) ?? row.refs[0];
    if (!reference) {
      withoutRef += 1;
      continue;
    }

    const key = personKey(row.name);
    const existingId = personIdByNameKey.get(key);
    const id = existingId ?? slugify(row.name);
    if (!existingId && byId.has(id)) {
      issues.push(`${row.name} (${title}): «${id}» er allerede en annen person`);
      continue;
    }

    const person: Person = byId.get(id) ?? {
      id,
      name: row.name,
      names: [],
      squadNumbers: [],
      coachSpells: [],
      roles: [],
      transfers: [],
      providers: [],
      sources: [],
      conflicts: [],
    };

    // Datoen kilden oppgir er meldingens dato. Mangler den, er året vinduet
    // tilhører det eneste arkivet vet, og da står året alene.
    const date = reference.date ?? String(window.season);
    const year = Number(date.slice(0, 4));
    const season = window.season === year || window.season === year + 1 ? window.season : year;

    const alreadyThere = person.transfers.some((entry) =>
      entry.direction === row.direction
      && transferSeason(entry) === season
      && (entry.club ?? "") === (row.club ?? ""));
    if (alreadyThere) {
      alreadyPresent += 1;
      continue;
    }

    const taken = new Set(person.transfers.map((entry) => entry.id));
    const announcement = [
      reference.title,
      reference.publisher ? `(${reference.publisher}${reference.date ? `, ${reference.date}` : ""})` : null,
      reference.url,
    ].filter(Boolean).join(" ");

    // Meldingen er ikke alltid klubbens egen — fotnotene peker like gjerne på
    // Sunnmørsposten. Der den *er* klubbens, finnes leverandøren i arkivet, og
    // da skal den stå som en egen henvisning og ikke bare i et notat.
    const fromClubSite = isClubSite(reference.url);

    const transfer: Transfer = {
      id: transferId(row, season, taken),
      direction: row.direction,
      kind: row.kind,
      club: row.club,
      ...(row.club && clubIdByKey.has(clubKey(row.club)) ? { clubId: clubIdByKey.get(clubKey(row.club))! } : {}),
      date,
      ...(season === year ? {} : { season }),
      sources: [],
      providers: [
        {
          providerId: "wikipedia",
          url: permalink(article),
          retrievedAt: today,
          fields: ["direction", "club", "date", "kind"],
          note: `Lest fra «${article.title}». Wikipedia er registeret, ikke kilden — meldingen står i notatet.`,
        },
        ...(fromClubSite ? [{
          providerId: "aafk-no",
          url: reference.url!,
          ...(reference.date ? { retrievedAt: reference.date } : {}),
          fields: ["direction", "club", "date", "kind"],
          note: reference.title,
        }] : []),
      ],
      note: announcement ? `Kilden fotnoten peker på: ${announcement}` : undefined,
    };

    person.transfers = [...person.transfers, transfer]
      .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
    byId.set(id, person);
    personIdByNameKey.set(key, id);
    touched.add(id);
    added.push({ personId: id, transfer });
  }
}

const summary = {
  artikler: articles.length,
  raderLest: rowsSeen,
  utenFotnote: withoutRef,
  alleredeRegistrert: alreadyPresent,
  nyeOverganger: added.length,
  inn: added.filter((entry) => entry.transfer.direction === "in").length,
  ut: added.filter((entry) => entry.transfer.direction === "out").length,
  medKlubbkobling: added.filter((entry) => entry.transfer.clubId !== undefined).length,
  personfiler: touched.size,
  nyePersonfiler: [...touched].filter((id) => !archive.people.some((person) => person.id === id)).length,
};

if (args.values.json) console.log(JSON.stringify({ ...summary, overganger: added }, null, 2));
else console.log(JSON.stringify(summary, null, 2));
for (const issue of issues) console.error(`KONTROLL: ${issue}`);

if (!args.values.write) {
  console.log(`Ingen filer skrevet. Planen ville rørt ${touched.size} personfiler.`);
  process.exit(0);
}

for (const id of touched) {
  const value = byId.get(id)!;
  const absolute = resolve(root, personPath(id));
  await mkdir(dirname(absolute), { recursive: true });

  const existing = existsSync(absolute) ? await readFile(absolute, "utf8") : null;
  if (existing === null) {
    await writeFile(absolute, stringify(value, { lineWidth: 100 }), "utf8");
    continue;
  }

  // Filene som allerede finnes skrives ikke om. En full re-serialisering ville
  // reflytt hver eneste rolle og kildehenvisning i 147 filer, og gjort en diff
  // på 225 nye overganger umulig å lese — og dermed umulig å kontrollere.
  // Overgangene legges til på slutten, og resten av fila står urørt.
  const fresh = added.filter((entry) => entry.personId === id).map((entry) => entry.transfer);
  if (fresh.length === 0) continue;
  if (/^transfers:/m.test(existing)) {
    issues.push(`${id}: har allerede et transfers-felt; skrives ikke om maskinelt`);
    continue;
  }
  const block = stringify({ transfers: fresh }, { lineWidth: 100 });
  await writeFile(absolute, existing.endsWith("\n") ? existing + block : `${existing}\n${block}`, "utf8");
}

// Skriv aldri uten å lese tilbake. En innhøsting som etterlater et arkiv som
// ikke validerer, er verre enn en som ikke kjørte.
const after = await loadArchive(root);
const afterIssues = [...after.issues, ...crossValidate(after)];
if (afterIssues.length > 0) {
  console.error(`Skrev ${touched.size} filer, men arkivet har ${afterIssues.length} feil. Kjør pnpm validate.`);
  for (const issue of afterIssues.slice(0, 20)) console.error(`  ${issue.file} ${issue.path}: ${issue.message}`);
  process.exit(1);
}
console.log(`Skrev ${touched.size} personfiler med ${added.length} nye overganger.`);
