import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse, stringify } from "yaml";
import { clubKey, isLongerNameForm, person as personSchema, personKey, slugify } from "@aafkstats/schema";
import type { Archive } from "@aafkstats/schema/load";
import type { Person, Transfer } from "@aafkstats/schema";
import type { WikipediaTransferRow } from "./adapters/wikipedia-transfers.js";
import { addNamesToYaml, mergeTransfersIntoYaml, sameTransferEvent } from "./wikipedia-transfer-store.js";

/**
 * Å slå opp overgangen bak et navn, og å skrive den inn.
 *
 * ## Hvorfor dette ligger for seg selv
 *
 * To ting spør om det samme. `wikipedia-transfers` går gjennom hele korpuset og
 * fører alt som har en fotnote; rutinen etter kamp spør om noen få navn som
 * nettopp dukket opp i kamptroppen. Hvis de to bygger hver sin `Transfer` av en
 * rad, glir de fra hverandre — den ene får et felt den andre ikke får, og to
 * overganger på samme spiller ser ulike ut avhengig av hvem som fant dem.
 *
 * Derfor bor byggingen av overgangen og skrivingen av personfila her, og begge
 * kaller inn. Nettverket ligger fortsatt hos den som spør: modulen tar wikitekst
 * inn og gir en plan ut, slik at den kan testes uten et kall per test.
 */

/** En artikkel slik den ble lest, med revisjonen svaret gjelder. */
export interface WikipediaArticle {
  title: string;
  revid?: number;
  wikitext: string;
}

/**
 * Permalenke til nøyaktig den revisjonen vi leste.
 *
 * Uten revisjonsnummeret er lenken bare «artikkelen slik den er i dag», og da
 * kan ingen kontrollere hva arkivet faktisk leste. Mangler nummeret, lenker vi
 * til artikkelen ved navn i stedet for å skrive `oldid=undefined`.
 */
export function permalink(article: Pick<WikipediaArticle, "title" | "revid">): string {
  if (article.revid === undefined) {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(article.title.replace(/ /g, "_"))}`;
  }
  return `https://en.wikipedia.org/w/index.php?oldid=${article.revid}`;
}

/**
 * Om adressen faktisk peker på klubbens eget nettsted.
 *
 * Verten må sammenlignes som vert, ikke som delstreng. «Inneholder aafk.no» er
 * sant også for `https://aafk.no.example.com/`, og da ville arkivet tilskrevet
 * klubben en melding den ikke har skrevet. Et ugyldig eller manglende URL gir
 * nei, ikke et unntak.
 */
export function isClubSite(url: string | undefined): boolean {
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
export function transferId(row: Pick<WikipediaTransferRow, "direction" | "club" | "kind">, season: number, taken: Set<string>): string {
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

export interface BuildTransferInput {
  row: WikipediaTransferRow;
  article: Pick<WikipediaArticle, "title" | "revid">;
  /** Sesongen overgangsvinduet tilhører. */
  windowSeason: number;
  /** Klubb-ID-er slått opp på normalisert navn. Uten treff står bare kildens tekst. */
  clubIdByKey: Map<string, string>;
  /** Overgangs-ID-er som allerede er i bruk i personfila. */
  taken: Set<string>;
  retrievedAt: string;
}

/**
 * Raden som en overgang arkivet kan stå inne for, eller grunnen til at den ikke
 * kan bli det.
 *
 * En rad uten fotnote har ingen kilde å vise til. Den skrives ikke — det er
 * nettopp det arkivet krever av en overgang, og en rad fra en liste er ikke en
 * kilde i seg selv.
 */
export function buildTransfer(input: BuildTransferInput): { transfer: Transfer } | { skipped: "manglerFotnote" } {
  const { row, article, windowSeason, clubIdByKey, taken, retrievedAt } = input;
  const reference = row.refs.find((ref) => ref.url) ?? row.refs[0];
  if (!reference) return { skipped: "manglerFotnote" };

  // Datoen kilden oppgir er meldingens dato. Mangler den, er året vinduet
  // tilhører det eneste arkivet vet, og da står året alene.
  const date = reference.date ?? String(windowSeason);
  const year = Number(date.slice(0, 4));
  const season = windowSeason === year || windowSeason === year + 1 ? windowSeason : year;

  const announcement = [
    reference.title,
    reference.publisher ? `(${reference.publisher}${reference.date ? `, ${reference.date}` : ""})` : null,
    reference.url,
  ].filter(Boolean).join(" ");

  // Meldingen er ikke alltid klubbens egen — fotnotene peker like gjerne på
  // Sunnmørsposten. Der den *er* klubbens, finnes leverandøren i arkivet, og
  // da skal den stå som en egen henvisning og ikke bare i et notat.
  const fromClubSite = isClubSite(reference.url);

  return {
    transfer: {
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
          retrievedAt,
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
    },
  };
}

/** Klubb-ID-er slått opp på normalisert navn, slik innhøstingen trenger dem. */
export function clubIndex(archive: Archive): Map<string, string> {
  const index = new Map<string, string>();
  for (const club of archive.clubs) {
    for (const form of [club.name, club.shortName, ...club.nameVariants, ...club.names.map((entry) => entry.name)]) {
      if (form) index.set(clubKey(form), club.id);
    }
  }
  return index;
}

/** Personfil-ID-er slått opp på hver skrivemåte som er ført på personen. */
export function personIndex(archive: Archive): Map<string, string> {
  const index = new Map<string, string>();
  for (const person of archive.people) {
    for (const form of [person.name, ...person.names]) index.set(personKey(form), person.id);
  }
  return index;
}

/** En personfil uten annet innhold enn navnet. Alt annet må en kilde si. */
export function blankPerson(id: string, name: string): Person {
  return {
    id,
    name,
    names: [],
    squadNumbers: [],
    coachSpells: [],
    roles: [],
    transfers: [],
    providers: [],
    sources: [],
    conflicts: [],
  };
}

export interface PersonWrite {
  absolute: string;
  content: string;
  /** Sann når fila ikke finnes fra før. */
  fresh: boolean;
}

/**
 * Personfila slik den vil se ut med de nye overgangene, uten å skrive den.
 *
 * Fila bygges bare fra bunnen når den ikke finnes. Finnes den, flettes
 * overgangene inn i YAML-dokumentet, slik at kommentarer, nøkkelrekkefølge og
 * skalartyper står som de sto. En innhøsting skal ikke skrive om filer den bare
 * legger noe til i.
 *
 * Person-ID-en kommer av et navn hentet fra nett. `slugify` gjør den til en
 * slug, men et navn utenfra skal aldri få bestemme hvor på disken vi skriver, og
 * en kontroll som står her er lettere å stole på enn en som ligger tre
 * funksjoner unna. Både formen og den ferdige stien kontrolleres.
 */
export async function planPersonWrite(
  root: string,
  id: string,
  person: Person,
  additions: Transfer[],
  names: string[] = [],
): Promise<PersonWrite | { issue: string }> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return { issue: `${id}: ikke en gyldig person-ID; skriver ikke` };

  const peopleDir = resolve(root, "people");
  const absolute = resolve(peopleDir, `${id}.yaml`);
  if (dirname(absolute) !== peopleDir) return { issue: `${id}: stien havner utenfor data/people; skriver ikke` };

  const existing = existsSync(absolute) ? await readFile(absolute, "utf8") : null;
  try {
    const content = existing === null
      ? stringify(person, { lineWidth: 100 })
      : addNamesToYaml(mergeTransfersIntoYaml(existing, additions), names);
    const validation = personSchema.safeParse(parse(content));
    if (!validation.success) {
      return { issue: `${id}: foreslått personfil validerer ikke (${validation.error.issues[0]?.message ?? "ukjent feil"})` };
    }
    return { absolute, content, fresh: existing === null };
  } catch (error) {
    return { issue: `${id}: kunne ikke flette inn overganger (${String(error)})` };
  }
}

/** En ny spiller å slå opp: navnet i kamptroppen, og personfila hvis den finnes. */
export interface Wanted {
  name: string;
  personId?: string;
  /** Sesongen han debuterte i. Overgangen skal ikke være fra et senere vindu. */
  season: number;
}

/** Overgangen som forklarer at en spiller kom, klar til å skrives. */
export interface FoundArrival {
  /** Navnet slik det sto i kamptroppen. */
  name: string;
  personId: string;
  transfer: Transfer;
  /**
   * Satt når kilden og kamptroppen skriver navnet ulikt, og de er ført som samme
   * person. Da er identiteten en antakelse, og den skal være synlig for den som
   * leser diffen — ikke bare stå i en fil som ser sikker ut.
   */
  identityNote?: string;
  /**
   * Personfila med overgangen i, sortert. Ny fil når arkivet ikke hadde en.
   *
   * Den bygges her og ikke hos den som skriver, slik at rekkefølgen og
   * sammensetningen er den samme uansett hvem som fant overgangen.
   */
  person: Person;
  /** Skrivemåter som må legges til i personfila for at kamptroppen skal finne den. */
  newNames: string[];
  article: string;
}

export interface LookupResult {
  found: FoundArrival[];
  /** Navn ingen artikkel hadde en inngående rad for. */
  missing: Wanted[];
  issues: string[];
}

/**
 * Leter etter en inngående overgang for hvert navn, i artiklene som er lest.
 *
 * Bare inngående rader teller: spørsmålet er hvordan han kom, ikke hva som
 * skjedde etterpå. Navnet slås sammen med `personKey()`, samme nøkkel som
 * kamptroppen bruker, slik at «Ólafur» og «Olafur» er samme spiller her også.
 *
 * Finner den ingenting, er det et svar og ikke en feil: Wikipedias lister dekker
 * ikke alt, og en spiller hentet opp fra egen ungdomsavdeling står sjelden der.
 */
export function lookupArrivals(
  wanted: Wanted[],
  articles: (WikipediaArticle & { windowSeason: number; rows: WikipediaTransferRow[] })[],
  context: { archive: Archive; retrievedAt: string },
): LookupResult {
  const clubIdByKey = clubIndex(context.archive);
  const personIdByNameKey = personIndex(context.archive);
  const peopleById = new Map(context.archive.people.map((person) => [person.id, person]));

  const found: FoundArrival[] = [];
  const missing: Wanted[] = [];
  const issues: string[] = [];

  for (const player of wanted) {
    const key = personKey(player.name);
    // Eldste vindu først: kom han i vinterpausen, er det den overgangen som
    // forklarer at han spilte, ikke en senere rad om det samme.
    const inbound = articles
      .filter((article) => article.windowSeason <= player.season)
      .sort((a, b) => a.windowSeason - b.windowSeason)
      .flatMap((article) => article.rows
        .filter((row) => row.direction === "in")
        .map((row) => ({ article, row })));

    // Samme skrivemåte først. Ellers den formen som bare er det samme navnet med
    // eller uten mellomnavn: kamptroppen har «Isak Gabriel Skotheim» fra FotMob,
    // mens klubbmeldingen Wikipedia siterer sier «Isak Skotheim». Det er ett ord
    // til, ikke en annen mann — men det er en antakelse, og den merkes.
    const exact = inbound.filter(({ row }) => personKey(row.name) === key);
    const byNameForm = exact.length > 0 ? [] : inbound.filter(({ row }) =>
      isLongerNameForm(row.name, player.name) || isLongerNameForm(player.name, row.name));
    const candidates = exact.length > 0 ? exact : byNameForm;

    if (candidates.length === 0) {
      missing.push(player);
      continue;
    }

    const sourceName = candidates[0]!.row.name;
    const identityNote = exact.length > 0
      ? undefined
      : `Kamptroppen skriver «${player.name}», kilden «${sourceName}». Ført som samme person: `
        + "navnet er den samme formen med eller uten mellomnavn, og overgangen gjelder samme sesong.";

    const id = player.personId
      ?? personIdByNameKey.get(key)
      ?? personIdByNameKey.get(personKey(sourceName))
      ?? slugify(sourceName);
    if (player.personId === undefined && personIdByNameKey.get(personKey(sourceName)) === undefined && peopleById.has(id)) {
      issues.push(`${player.name}: «${id}» er allerede en annen person; overgangen må føres for hånd`);
      continue;
    }

    const person = structuredClone(peopleById.get(id)) ?? blankPerson(id, sourceName);

    // Kamptroppen må kunne finne fila igjen. Står skrivemåten fra oppstillingen
    // ikke i den, er personen usynlig i stallen selv om overgangen er ført.
    const spellings = new Set([person.name, ...person.names].map((form) => personKey(form)));
    const newNames = spellings.has(key) ? [] : [player.name];
    person.names = [...person.names, ...newNames];
    const taken = new Set(person.transfers.map((entry) => entry.id));
    let added = false;

    for (const { article, row } of candidates) {
      const built = buildTransfer({
        row,
        article,
        windowSeason: article.windowSeason,
        clubIdByKey,
        taken,
        retrievedAt: context.retrievedAt,
      });
      if ("skipped" in built) {
        issues.push(`${player.name} (${article.title}): raden har ingen fotnote, og skrives ikke`);
        continue;
      }
      if (person.transfers.some((entry) => sameTransferEvent(entry, built.transfer))) continue;
      person.transfers = [...person.transfers, built.transfer]
        .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
      found.push({
        name: player.name,
        personId: id,
        transfer: built.transfer,
        person,
        newNames,
        article: article.title,
        ...(identityNote === undefined ? {} : { identityNote }),
      });
      added = true;
      // Én overgang er svaret på «hvordan kom han». Står han i flere vinduer,
      // hører resten hjemme i en full innhøsting, ikke i rutinen etter kamp.
      break;
    }

    if (!added) missing.push(player);
  }

  return { found, missing, issues };
}
