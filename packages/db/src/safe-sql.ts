import type { Sql } from "./index.js";

export interface SafeSqlOptions {
  /** Maks antall rader som returneres. */
  maxRows?: number;
  /** Maks kjøretid i millisekunder. */
  timeoutMs?: number;
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
 * Databaserollen stopper alle disse uansett — poenget her er ikke sikkerhet, men at
 * modellen får vite *hvorfor* og kan formulere om, i stedet for å møte en rå
 * rettighetsfeil fra Postgres den ikke klarer å tolke.
 */
const FORBIDDEN: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(insert|update|delete|truncate|merge)\b/i, reason: "datasettet er skrivebeskyttet" },
  { pattern: /\b(drop|create|alter|grant|revoke)\b/i, reason: "skjemaendringer er ikke tillatt" },
  { pattern: /\bcomment\s+on\b/i, reason: "skjemaendringer er ikke tillatt" },
  { pattern: /\b(copy|\\copy)\b/i, reason: "filoperasjoner er ikke tillatt" },
  { pattern: /\bpg_sleep\b/i, reason: "pg_sleep er ikke tillatt" },
  { pattern: /\b(pg_read_file|pg_read_binary_file|lo_import|lo_export)\b/i, reason: "filtilgang er ikke tillatt" },
  { pattern: /\bdblink\b/i, reason: "eksterne tilkoblinger er ikke tillatt" },
  { pattern: /\bset\s+(session|local)?\s*\w/i, reason: "SET er ikke tillatt i en spørring" },
  {
    pattern: /\b(core|pg_catalog|information_schema)\s*\./i,
    reason: "kun public_api-skjemaet er tilgjengelig — se datasettdokumentasjonen",
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

  // Et WITH ... AS (...) kan skjule en datamodifiserende setning (WITH x AS (DELETE ...)).
  // Rollen stopper det, men vi vil ha en forståelig melding i stedet for en rettighetsfeil.
  if (firstWord === "WITH" && /\bas\s*\(\s*(insert|update|delete)\b/i.test(withoutTrailing)) {
    throw new UnsafeSqlError("Avvist: WITH kan ikke inneholde skriveoperasjoner.");
  }

  return { query: raw.replace(/;\s*$/, "") };
}

/**
 * Kjører en modellgenerert spørring med alle guardrails på.
 *
 * Lagene, utenfra og inn:
 *   1. Databaserollen (aafk_chat) har SELECT kun på public_api — håndhevet av Postgres
 *   2. Skrivebeskyttet transaksjon med statement_timeout
 *   3. Én setning, kun SELECT/WITH — validateReadOnlySql over
 *   4. Radtak påtvunget ved innpakking
 *   5. Logging av spørring og kjøretid — gjøres av kalleren
 *
 * Bare lag 1 og 2 håndheves av databasen. De andre er hjelpsomme, ikke sikkerhet:
 * hele opplegget skal være trygt selv om 3 og 4 skulle svikte.
 */
export async function runSafeSql(
  sql: Sql,
  query: string,
  options: SafeSqlOptions = {},
): Promise<SafeSqlResult> {
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const { query: clean } = validateReadOnlySql(query);

  // Hent én rad ekstra for å kunne skille «nøyaktig maxRows treff» fra «kuttet».
  const executedSql = `SELECT * FROM (\n${clean}\n) AS _capped LIMIT ${maxRows + 1}`;

  const started = Date.now();
  const rows = await sql.begin(async (tx) => {
    await tx.unsafe("SET TRANSACTION READ ONLY");
    await tx.unsafe(`SET LOCAL statement_timeout = ${timeoutMs}`);
    return tx.unsafe(executedSql);
  });
  const durationMs = Date.now() - started;

  const all = rows as unknown as Record<string, unknown>[];
  const truncated = all.length > maxRows;
  const capped = truncated ? all.slice(0, maxRows) : all;

  return {
    columns: capped[0] ? Object.keys(capped[0]) : [],
    rows: capped,
    rowCount: capped.length,
    truncated,
    durationMs,
    executedSql,
  };
}
