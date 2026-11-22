import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

/**
 * `node:sqlite` hentes via createRequire i stedet for en vanlig import.
 *
 * Modulen er eksperimentell i Node 22 og står derfor ikke i Nodes `builtinModules`.
 * Bundlere bruker den lista til å kjenne igjen innebygde moduler, så både Vite og
 * Next stripper «node:»-prefikset og leter etter en npm-pakke som heter «sqlite» —
 * som ikke finnes. Et require-kall er ugjennomsiktig for statisk analyse og går
 * rett til Node, så dette virker likt under vitest, webpack og turbopack uten at
 * hver bundler må konfigureres for seg.
 *
 * Typene importeres separat som `import type`, og forsvinner ved kompilering.
 */
const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire("node:sqlite") as {
  DatabaseSync: typeof DatabaseSyncType;
};

export type Db = DatabaseSyncType;

const ARCHIVE_FILE = ".data/aafkstats.sqlite";

/**
 * Hvor byggesteget skriver arkivfilen: alltid apps/web/.data, regnet fra repo-rota.
 *
 * Der ligger den fordi Next.js må kunne spore den inn i funksjonsbunten. Den er
 * ikke i git — binærfiler gir ubrukelige differ, og den bygges fra data/ på
 * millisekunder uansett.
 */
export function archiveBuildPath(): string {
  if (process.env.AAFK_DB_PATH) return resolve(process.env.AAFK_DB_PATH);
  const here = fileURLToPath(new URL(".", import.meta.url));
  return resolve(here, "../../../apps/web", ARCHIVE_FILE);
}

/**
 * Hvor lesende kode finner arkivfilen.
 *
 * Kan ikke utledes fra `import.meta.url` slik byggestien kan: etter Next sin
 * bunting peker den inn i `.next/server/`, og en relativ sti derfra treffer ikke
 * kildetreet. Vi prøver derfor kandidatene i tur og bruker den første som finnes —
 * det dekker Next i produksjon (cwd = apps/web), CLI og tester fra repo-rota, og
 * kildeoppsettet under utvikling.
 */
export function archivePath(): string {
  if (process.env.AAFK_DB_PATH) return resolve(process.env.AAFK_DB_PATH);

  // Kun cwd-baserte kandidater her — bevisst ingen fileURLToPath.
  //
  // Webpack polyfiller `URL` med sin egen klasse, og Nodes `fileURLToPath` avviser
  // den med «Received an instance of URL». Byggestien kan trygt bruke den, for
  // CLI-en kjører som ekte ESM under tsx; lesestien kjører inne i Next-bunten.
  const candidates = [
    resolve(process.cwd(), ARCHIVE_FILE),
    resolve(process.cwd(), "apps/web", ARCHIVE_FILE),
  ];

  return candidates.find((p) => existsSync(p)) ?? candidates[0]!;
}

function requireArchive(path: string): string {
  if (!existsSync(path)) {
    throw new Error(
      `Fant ingen arkivfil på ${path} (cwd: ${process.cwd()}).\n` +
        `Kjør «pnpm db:build», eller «AAFK_DATA_DIR=fixtures/data pnpm db:build» for testdata.`,
    );
  }
  return path;
}

/**
 * Åpner arkivet skrivebeskyttet.
 *
 * `readOnly` håndheves av SQLite selv, ikke av koden vår — et forsøk på å skrive
 * feiler i motoren uansett hvor det kommer fra. Dette er det tyngste laget i
 * guardrailen rundt chattens SQL-tilgang.
 */
export function open(path = archivePath()): Db {
  return withUnicodeCase(new DatabaseSync(requireArchive(path), { readOnly: true }));
}

/**
 * Lar `lower()` og `upper()` kjenne hele alfabetet, ikke bare A–Z.
 *
 * SQLite folder bare ASCII: `lower('Åsane')` er fortsatt «Åsane». Alle søkene
 * våre sammenligner `lower(kolonne)` med en nål som er gjort om til små
 * bokstaver i JavaScript, der Å blir å. De to møttes aldri, og et søk på
 * Åsane, Ørsta eller Øie ga null treff — i direktesøket, i API-et og i svarene
 * fra språkmodellen, som da kunne påstå at AaFK aldri hadde møtt laget.
 *
 * Funksjonene erstattes på tilkoblingen framfor å skrives om i hver spørring:
 * da gjelder rettelsen også SQL-en modellen skriver selv. `deterministic` må
 * stå, ellers nekter SQLite å bruke dem i indekser og genererte kolonner.
 *
 * `LIKE` uten `lower()` rundt kolonnen er fortsatt bare ASCII-blind for
 * store og små bokstaver. Søk derfor alltid som `lower(kolonne) LIKE nål`.
 */
export function withUnicodeCase(db: Db): Db {
  db.function("lower", { deterministic: true }, (value) =>
    typeof value === "string" ? value.toLocaleLowerCase("nb") : value,
  );
  db.function("upper", { deterministic: true }, (value) =>
    typeof value === "string" ? value.toLocaleUpperCase("nb") : value,
  );
  return db;
}

/**
 * Åpner arkivet med skrivetilgang. Kun for byggesteget.
 *
 * Egen funksjon med et navn som gjør det tydelig i diffen hvis noen tar den i bruk
 * fra en forespørselssti. Alt som svarer på en HTTP-forespørsel skal bruke open().
 */
export function openForBuild(path: string): Db {
  return withUnicodeCase(new DatabaseSync(path));
}

/**
 * Statusene som betyr at kampen har funnet sted.
 *
 * `awarded` er med: en kamp avgjort på grønt bord har et resultat, og den ligger
 * bak oss. `abandoned` er ikke med, for en avbrutt kamp har ingen sluttstilling
 * å telle. Resten er kamper som ikke er spilt.
 *
 * Regelen sto tre steder med tre litt ulike svar: `seasons`-viewet tok bare
 * 'played', `opponents` talte spilte kamper på én måte og seire på en annen, og
 * nettstedet hadde sin egen streng. Samme kamp kunne dermed telles i forsidens
 * totalsum og mangle i sesongsammendraget. Nå står regelen her, og SQL-en leser
 * den fra `core_played`.
 */
export const PLAYED_STATUSES = ["played", "awarded"] as const;

/** Samme regel som `PLAYED_STATUSES`, til bruk i en WHERE-setning. */
export const PLAYED_SQL = `status IN (${PLAYED_STATUSES.map((s) => `'${s}'`).join(", ")})`;

/** Kjører en spørring vi selv har skrevet og returnerer radene. */
export function all<T = Record<string, unknown>>(
  db: Db,
  sql: string,
  ...params: (string | number | null)[]
): T[] {
  return db.prepare(sql).all(...params) as T[];
}

/** Første rad, eller undefined. */
export function one<T = Record<string, unknown>>(
  db: Db,
  sql: string,
  ...params: (string | number | null)[]
): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}
