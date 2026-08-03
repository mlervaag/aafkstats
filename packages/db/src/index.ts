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
  return new DatabaseSync(requireArchive(path), { readOnly: true });
}

/**
 * Åpner arkivet med skrivetilgang. Kun for byggesteget.
 *
 * Egen funksjon med et navn som gjør det tydelig i diffen hvis noen tar den i bruk
 * fra en forespørselssti. Alt som svarer på en HTTP-forespørsel skal bruke open().
 */
export function openForBuild(path: string): Db {
  return new DatabaseSync(path);
}

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
