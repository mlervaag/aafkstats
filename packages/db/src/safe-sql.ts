import { execFile } from "node:child_process";
import { archivePath } from "./index.js";

export interface SafeSqlOptions {
  /** Maks antall rader som returneres. */
  maxRows?: number;
  /** Maks kjøretid i millisekunder før prosessen drepes. */
  timeoutMs?: number;
  /** Sti til arkivfilen. Utledes fra archivePath() når den ikke oppgis. */
  dbPath?: string;
}

export interface SafeSqlResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  /** Sant når resultatet ble kuttet av radtaket — svaret bør si fra om det. */
  truncated: boolean;
  durationMs: number;
  /** Spørringen slik den faktisk ble kjørt, etter innpakking. */
  executedSql: string;
}

export class UnsafeSqlError extends Error {
  override readonly name = "UnsafeSqlError";
}

const DEFAULT_MAX_ROWS = 200;
const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Fjerner strenger, siterte identifikatorer og kommentarer, og erstatter dem med
 * blanktegn av samme lengde.
 *
 * Poenget er å kunne lete etter semikolon og nøkkelord uten å bomme på innhold som
 * bare ser ut som kode. Uten dette avvises `WHERE note = 'a;b'` som «flere setninger»,
 * og et forbudt nøkkelord inne i en kommentar utløser falsk alarm. Posisjonene bevares
 * slik at feilmeldinger fortsatt peker på riktig sted.
 */
export function stripLiterals(sql: string): string {
  let out = "";
  let i = 0;

  const blank = (n: number) => " ".repeat(n);

  while (i < sql.length) {
    const ch = sql[i]!;
    const next = sql[i + 1];

    // Linjekommentar: -- til linjeslutt
    if (ch === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end;
      out += blank(stop - i);
      i = stop;
      continue;
    }

    // Blokkommentar: /* ... */, og de kan nestes i Postgres
    if (ch === "/" && next === "*") {
      let depth = 1;
      let j = i + 2;
      while (j < sql.length && depth > 0) {
        if (sql[j] === "/" && sql[j + 1] === "*") {
          depth++;
          j += 2;
        } else if (sql[j] === "*" && sql[j + 1] === "/") {
          depth--;
          j += 2;
        } else {
          j++;
        }
      }
      out += blank(j - i);
      i = j;
      continue;
    }

    // Enkeltfnutt-streng. '' inni er et escapet apostrof, ikke slutt på strengen.
    if (ch === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2;
        } else if (sql[j] === "'") {
          j++;
          break;
        } else {
          j++;
        }
      }
      out += blank(j - i);
      i = j;
      continue;
    }

    // Sitert identifikator "..." — "" inni er et escapet anførselstegn.
    if (ch === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === '"' && sql[j + 1] === '"') {
          j += 2;
        } else if (sql[j] === '"') {
          j++;
          break;
        } else {
          j++;
        }
      }
      out += blank(j - i);
      i = j;
      continue;
    }

    // Dollar-sitert streng: $$...$$ eller $tag$...$tag$
    if (ch === "$") {
      const tagMatch = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i));
      if (tagMatch) {
        const tag = tagMatch[0];
        const close = sql.indexOf(tag, i + tag.length);
        const stop = close === -1 ? sql.length : close + tag.length;
        out += blank(stop - i);
        i = stop;
        continue;
      }
    }

    out += ch;
    i++;
  }

  return out;
}

/**
 * Konstruksjoner som avvises med en forklarende melding.
 *
 * SQLite stopper skriving uansett fordi filen åpnes med readOnly — poenget her er
 * ikke sikkerhet, men at modellen får vite *hvorfor* og kan formulere om, i stedet
 * for å møte en rå motorfeil den ikke klarer å tolke.
 *
 * Unntaket er core_-tabellene: der er avvisningen den eneste grensen vi har.
 * SQLite har ingen roller, så vi kan ikke gi leserett på viewene alene. Det er en
 * reell svekkelse mot Postgres-utkastet — men datasettet er offentlig i sin helhet,
 * så det som står på spill er en stabil kontrakt, ikke en hemmelighet.
 */
const FORBIDDEN: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(insert|update|delete|replace|upsert)\b/i, reason: "datasettet er skrivebeskyttet" },
  { pattern: /\b(drop|create|alter|reindex|vacuum)\b/i, reason: "skjemaendringer er ikke tillatt" },
  { pattern: /\battach\b/i, reason: "ATTACH er ikke tillatt" },
  { pattern: /\bdetach\b/i, reason: "DETACH er ikke tillatt" },
  { pattern: /\bpragma\b/i, reason: "PRAGMA er ikke tillatt" },
  { pattern: /\bload_extension\b/i, reason: "utvidelser er ikke tillatt" },
  { pattern: /\b(readfile|writefile|edit|fsdir)\s*\(/i, reason: "filtilgang er ikke tillatt" },
  {
    pattern: /\bcore_\w+/i,
    reason: "de interne core_-tabellene er ikke en del av datasettet — bruk viewene, se datasettdokumentasjonen",
  },
  {
    pattern: /\bsqlite_(master|schema|temp_master|sequence|stat\d)\b/i,
    reason: "SQLites systemtabeller er ikke tilgjengelige — se datasettdokumentasjonen for hvilke tabeller som finnes",
  },
];

export interface ValidatedSql {
  /** Spørringen med eventuelt avsluttende semikolon fjernet. */
  query: string;
}

/**
 * Kontrollerer at spørringen er én ren leseoperasjon før den sendes til databasen.
 *
 * Kaster UnsafeSqlError med en melding som er ment å leses av modellen, slik at den
 * kan rette opp og prøve på nytt i stedet for å gi opp.
 */
export function validateReadOnlySql(input: string): ValidatedSql {
  const raw = input.trim();
  if (raw === "") throw new UnsafeSqlError("Tom spørring.");
  if (raw.length > 4000) throw new UnsafeSqlError("Spørringen er for lang (maks 4000 tegn).");

  const stripped = stripLiterals(raw);

  // Flere setninger i ett kall. Et avsluttende semikolon er greit.
  const withoutTrailing = stripped.replace(/;\s*$/, "");
  if (withoutTrailing.includes(";")) {
    throw new UnsafeSqlError("Bare én setning per kall. Fjern ekstra semikolon.");
  }

  // Første nøkkelord må være SELECT eller WITH.
  const firstWord = /^\s*([A-Za-z_]+)/.exec(withoutTrailing)?.[1]?.toUpperCase();
  if (firstWord !== "SELECT" && firstWord !== "WITH") {
    throw new UnsafeSqlError(
      `Bare SELECT (eventuelt med WITH) er tillatt. Spørringen begynte med «${firstWord ?? "?"}».`,
    );
  }

  for (const { pattern, reason } of FORBIDDEN) {
    if (pattern.test(withoutTrailing)) {
      throw new UnsafeSqlError(`Avvist: ${reason}.`);
    }
  }

  // WITH RECURSIVE kan snurre i det uendelige. Timeouten fanger det, men en
  // forklarende melding er bedre enn en avbrutt spørring uten begrunnelse.
  if (/\bwith\s+recursive\b/i.test(withoutTrailing)) {
    throw new UnsafeSqlError("Avvist: rekursive spørringer er ikke tillatt.");
  }

  return { query: raw.replace(/;\s*$/, "") };
}

/**
 * Skriptet child-prosessen kjører, som en streng sendt med `node -e`.
 *
 * Inlinet med vilje framfor å ligge som en egen fil: en fil ville måttet spores
 * inn i Next sin funksjonsbunt og løses opp på en sti som er forskjellig i dev og
 * produksjon. En streng har ingen sti og oppfører seg likt begge steder.
 *
 * Argumentene kommer inn via argv og røres aldri sammen med skriptteksten, så det
 * finnes ingen vei fra spørringen til koden som kjører.
 */
const RUNNER_SCRIPT = `
const { DatabaseSync } = require("node:sqlite");
const [dbPath, sql, maxRowsRaw] = process.argv.slice(1);
const maxRows = Number(maxRowsRaw);
try {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const rows = db.prepare(sql).all();
  db.close();
  const truncated = rows.length > maxRows;
  const capped = truncated ? rows.slice(0, maxRows) : rows;
  process.stdout.write(JSON.stringify({
    ok: true,
    rows: capped,
    columns: capped[0] ? Object.keys(capped[0]) : [],
    truncated,
  }));
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, error: String(err && err.message || err) }));
}
`;

/**
 * Kjører en modellgenerert spørring med alle guardrails på.
 *
 * Lagene, utenfra og inn:
 *   1. Arkivfilen åpnes med readOnly — håndhevet av SQLite
 *   2. Spørringen kjøres i en egen prosess som drepes med SIGKILL ved timeout
 *   3. Én setning, kun SELECT/WITH — validateReadOnlySql over
 *   4. Radtak påtvunget i child-prosessen
 *   5. Logging av spørring og kjøretid — gjøres av kalleren
 *
 * Bare 1 og 2 er sikkerhet. Lag 3 og 4 finnes for å gi modellen forståelige
 * feilmeldinger — opplegget skal være trygt selv om de skulle svikte.
 */
export async function runSafeSql(
  query: string,
  options: SafeSqlOptions = {},
): Promise<SafeSqlResult> {
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const dbPath = options.dbPath ?? archivePath();

  const { query: clean } = validateReadOnlySql(query);
  const started = Date.now();

  const payload = await new Promise<RunnerResponse>((resolve, reject) => {
    const child = execFile(
      process.execPath,
      ["--no-warnings", "-e", RUNNER_SCRIPT, dbPath, clean, String(maxRows)],
      { timeout: timeoutMs, killSignal: "SIGKILL", maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          // execFile setter `killed` når timeouten slo til.
          reject(
            (err as NodeJS.ErrnoException & { killed?: boolean }).killed
              ? new Error(`Spørringen brukte for lang tid og ble avbrutt etter ${timeoutMs} ms.`)
              : new Error(err.message.split("\n")[0] ?? String(err)),
          );
          return;
        }
        try {
          resolve(JSON.parse(stdout) as RunnerResponse);
        } catch {
          reject(new Error("Kunne ikke tolke svaret fra spørringen."));
        }
      },
    );
    child.on("error", reject);
  });

  if (!payload.ok) throw new Error(payload.error);

  return {
    columns: payload.columns,
    rows: payload.rows,
    rowCount: payload.rows.length,
    truncated: payload.truncated,
    durationMs: Date.now() - started,
    executedSql: clean,
  };
}

type RunnerResponse =
  | { ok: true; rows: Record<string, unknown>[]; columns: string[]; truncated: boolean }
  | { ok: false; error: string };
