import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { personKey, slugify, type Person, type Transfer } from "@aafkstats/schema";
import { crossValidate, dataDir, loadArchive } from "@aafkstats/schema/load";
import { parseTransferRows, windowFromTitle } from "../adapters/wikipedia-transfers.js";
import { sameTransferEvent } from "../wikipedia-transfer-store.js";
import { articleWikitext, listTransferArticles } from "../wikipedia-transfer-articles.js";
import { blankPerson, buildTransfer, clubIndex, planPersonWrite } from "../transfer-lookup.js";

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

const root = dataDir();
const archive = await loadArchive(root);
const today = new Date().toISOString().slice(0, 10);

// Klubbnavn slik arkivet kjenner dem. Bare et treff på normalisert navn gir
// clubId; alt annet står som kildens tekst, uten kobling.
const clubIdByKey = clubIndex(archive);

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

const articles = (await listTransferArticles()).filter((title) => {
  const window = windowFromTitle(title);
  return window !== null && window.season >= fromSeason && window.season <= toSeason;
});

for (const title of articles) {
  let article: Awaited<ReturnType<typeof articleWikitext>>;
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
    const key = personKey(row.name);
    const existingId = personIdByNameKey.get(key);
    const id = existingId ?? slugify(row.name);
    if (!existingId && byId.has(id)) {
      issues.push(`${row.name} (${title}): «${id}» er allerede en annen person`);
      continue;
    }

    const person: Person = byId.get(id) ?? blankPerson(id, row.name);
    const built = buildTransfer({
      row,
      article,
      windowSeason: window.season,
      clubIdByKey,
      taken: new Set(person.transfers.map((entry) => entry.id)),
      retrievedAt: today,
    });
    // En rad uten fotnote har ingen kilde å vise til, og skal ikke inn.
    if ("skipped" in built) {
      withoutRef += 1;
      continue;
    }
    const transfer = built.transfer;

    if (person.transfers.some((entry) => sameTransferEvent(entry, transfer))) {
      alreadyPresent += 1;
      continue;
    }

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

if (!args.values.write) {
  for (const issue of issues) console.error(`KONTROLL: ${issue}`);
  console.log(`Ingen filer skrevet. Planen ville rørt ${touched.size} personfiler.`);
  process.exit(0);
}

const pendingWrites: { absolute: string; content: string; transfers: number }[] = [];
for (const id of touched) {
  const value = byId.get(id)!;
  const fresh = added.filter((entry) => entry.personId === id).map((entry) => entry.transfer);
  if (fresh.length === 0) continue;

  const planned = await planPersonWrite(root, id, value, fresh);
  if ("issue" in planned) {
    issues.push(planned.issue);
    continue;
  }
  pendingWrites.push({ absolute: planned.absolute, content: planned.content, transfers: fresh.length });
}

for (const issue of issues) console.error(`KONTROLL: ${issue}`);
const plannedTransfers = pendingWrites.reduce((sum, entry) => sum + entry.transfers, 0);
if (plannedTransfers !== added.length) {
  console.error(`Avbrøt før skriving: bare ${plannedTransfers} av ${added.length} overganger bestod kontrollen.`);
  process.exit(1);
}

for (const pending of pendingWrites) {
  await mkdir(dirname(pending.absolute), { recursive: true });
  await writeFile(pending.absolute, pending.content, "utf8");
}
const writtenFiles = pendingWrites.length;
const writtenTransfers = plannedTransfers;

// Skriv aldri uten å lese tilbake. En innhøsting som etterlater et arkiv som
// ikke validerer, er verre enn en som ikke kjørte.
const after = await loadArchive(root);
const afterIssues = [...after.issues, ...crossValidate(after)];
if (afterIssues.length > 0) {
  console.error(`Skrev ${writtenFiles} filer, men arkivet har ${afterIssues.length} feil. Kjør pnpm validate.`);
  for (const issue of afterIssues.slice(0, 20)) console.error(`  ${issue.file} ${issue.path}: ${issue.message}`);
  process.exit(1);
}
console.log(`Skrev ${writtenFiles} personfiler med ${writtenTransfers} nye overganger.`);
