import { execFile } from "node:child_process";
import { archivePath } from "./index.js";

export interface SafeSqlOptions {
  /** Maks antall rader som returneres. */
  maxRows?: number;
  /** Maks kjøretid i millisekunder før prosessen drepes. */
  timeoutMs?: number;
  /** Maks størrelse på resultatet i JSON-byte. Rader utover kuttes. */
  maxBytes?: number;
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
 * Tak på hvor stort et resultat får bli, målt i JSON-byte.
 *
 * 200 rader kan være 200 byte eller 200 megabyte. Resultatet sendes videre til
 * modellen, så et manglende tak er både en minnegrense og en kostnadsgrense som
 * mangler. En kvart megabyte er langt mer enn et statistikksvar trenger.
 */
const DEFAULT_MAX_BYTES = 256 * 1024;
/** Tak på haugen i child-prosessen. */
const MAX_HEAP_MB = 256;
/** Siste skanse hvis byte-budsjettet i child-prosessen skulle svikte. */
const MAX_BUFFER_BYTES = 4 * 1024 * 1024;

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
 * Som stripLiterals, men siterte identifikatorer beholdes med innholdet synlig.
 *
 * Finnes fordi de to kontrollene trenger hver sin utgave av spørringen.
 * Setningsdeling og nøkkelord skal lese `"rar;kolonne"` som ett navn — der er
 * blanking riktig. Navnekontrollen skal derimot se *inn* i navnet, for SQLite lar
 * enhver identifikator siteres: `FROM "core_matches"` og `FROM [core_matches]` og
 * `FROM \`core_matches\`` treffer alle samme tabell som den usiterte varianten.
 * Blankes de, ser filteret ingenting og slipper spørringen gjennom.
 *
 * Selve sitattegnene erstattes med mellomrom slik at lengden — og dermed
 * posisjonene i feilmeldinger — er den samme som i inndata.
 */
export function revealIdentifiers(sql: string): string {
  let out = "";
  let i = 0;

  const blank = (n: number) => " ".repeat(n);

  /** Leser en sitert identifikator og gjengir innholdet uten sitattegn. */
  const readQuoted = (open: string, close: string, escapedByDoubling: boolean): boolean => {
    if (sql[i] !== open) return false;
    let j = i + 1;
    let inner = "";
    while (j < sql.length) {
      if (escapedByDoubling && sql[j] === close && sql[j + 1] === close) {
        inner += close;
        j += 2;
      } else if (sql[j] === close) {
        j++;
        break;
      } else {
        inner += sql[j];
        j++;
      }
    }
    // Ett mellomrom for hvert sitattegn som falt bort, så lengden holder seg.
    out += " " + inner + blank(j - i - 1 - inner.length);
    i = j;
    return true;
  };

  while (i < sql.length) {
    const ch = sql[i]!;
    const next = sql[i + 1];

    if (ch === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end;
      out += blank(stop - i);
      i = stop;
      continue;
    }

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

    // Tekststrenger er data og skal fortsatt nøytraliseres — en motstander som
    // skriver 'core_matches' som streng har ikke rørt en tabell.
    if (ch === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") {
          j++;
          break;
        } else j++;
      }
      out += blank(j - i);
      i = j;
      continue;
    }

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

    // De tre sitatformene SQLite godtar for identifikatorer.
    if (readQuoted('"', '"', true)) continue;
    if (readQuoted("`", "`", true)) continue;
    if (readQuoted("[", "]", false)) continue;

    out += ch;
    i++;
  }

  return out;
}

/**
 * Nøkkelord som bare virker usiterte, og derfor kan sjekkes mot stripLiterals.
 *
 * `SELECT "drop"` er en kolonne, ikke en DROP. Å lete etter dem i den utgaven der
 * identifikatorene er pakket ut ville gitt falske avvisninger uten å stoppe noe.
 *
 * SQLite stopper skriving uansett fordi filen åpnes med readOnly — poenget her er
 * ikke sikkerhet, men at modellen får vite *hvorfor* og kan formulere om, i stedet
 * for å møte en rå motorfeil den ikke klarer å tolke.
 */
const FORBIDDEN_SYNTAX: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(insert|update|delete|replace|upsert)\b/i, reason: "datasettet er skrivebeskyttet" },
  { pattern: /\b(drop|create|alter|reindex|vacuum)\b/i, reason: "skjemaendringer er ikke tillatt" },
  { pattern: /\battach\b/i, reason: "ATTACH er ikke tillatt" },
  { pattern: /\bdetach\b/i, reason: "DETACH er ikke tillatt" },
];

/**
 * Navn som ikke skal nås, uansett hvordan de skrives.
 *
 * Sjekkes mot revealIdentifiers, ikke stripLiterals: alt her er identifikatorer
 * eller funksjonsnavn, og de kan siteres. Dette er laget der avvisningen faktisk
 * *er* grensen, ikke bare en vennlig feilmelding — SQLite har ingen roller, så vi
 * kan ikke gi leserett på viewene alene. Datasettet er offentlig i sin helhet, så
 * det som står på spill er en stabil kontrakt og ikke en hemmelighet, men grensen
 * skal holde det den lover.
 */
const FORBIDDEN_NAMES: { pattern: RegExp; reason: string }[] = [
  // PRAGMA finnes også som tabellverdifunksjon: pragma_database_list røper hvor
  // arkivfilen ligger på disk, pragma_table_info hele skjemaet. `\bpragma\b` bommer
  // på begge, for understrek er et ordtegn.
  { pattern: /\bpragma\w*/i, reason: "PRAGMA er ikke tillatt" },
  { pattern: /\bload_extension\b/i, reason: "utvidelser er ikke tillatt" },
  { pattern: /\b(readfile|writefile|edit|fsdir)\s*\(/i, reason: "filtilgang er ikke tillatt" },
  {
    pattern: /\bcore_\w+/i,
    reason: "de interne core_-tabellene er ikke en del av datasettet — bruk viewene, se datasettdokumentasjonen",
  },
  {
    // Hele sqlite_-navnerommet, ikke en liste over de kjente. sqlite_dbpage leser
    // rå sider ut av filen og sto ikke i lista; det skal ikke være mulig å finne
    // det neste navnet som mangler. sqlite_version() er ufarlig og får stå.
    pattern: /\bsqlite_(?!version\b)\w+/i,
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

  for (const { pattern, reason } of FORBIDDEN_SYNTAX) {
    if (pattern.test(withoutTrailing)) {
      throw new UnsafeSqlError(`Avvist: ${reason}.`);
    }
  }

  // Navnekontrollen leser spørringen med identifikatorene pakket ut, slik at
  // sitering ikke gjemmer et navn for filteret.
  const revealed = revealIdentifiers(raw);
  for (const { pattern, reason } of FORBIDDEN_NAMES) {
    if (pattern.test(revealed)) {
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
const [dbPath, sql, maxRowsRaw, maxBytesRaw] = process.argv.slice(1);
const maxRows = Number(maxRowsRaw);
const maxBytes = Number(maxBytesRaw);
try {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const rows = db.prepare(sql).all();
  db.close();
  let truncated = rows.length > maxRows;
  const capped = [];
  let bytes = 0;
  for (const row of rows.slice(0, maxRows)) {
    // Radtaket sier ingenting om størrelsen på en rad. Én celle kan være
    // vilkårlig stor — SELECT hex(zeroblob(...)) er nok — og resultatet går
    // rett videre inn i modellens kontekst. Budsjettet er derfor i byte.
    bytes += JSON.stringify(row).length;
    if (bytes > maxBytes) {
      truncated = true;
      break;
    }
    capped.push(row);
  }
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
 * Fjerner absolutte stier fra en feilmelding.
 *
 * Meldingene herfra går to steder brukeren ser: inn i modellens kontekst, og ut
 * til grensesnittet under svaret. SQLite skriver full sti til arkivfilen i flere
 * av dem, og en spawn-feil tar med hele node-kommandolinja. Ingen av delene sier
 * noe nyttig om spørringen.
 */
function scrubPaths(message: string): string {
  return message.replace(/(?:[A-Za-z]:)?[\\/][^\s'"]*[\\/]([^\s'"\\/]+)/g, "$1");
}

/**
 * Miljøet child-prosessen får.
 *
 * Bevisst nesten tomt. Prosessen skal åpne én fil og kjøre én SELECT, og trenger
 * ingenting av det foreldreprosessen bærer — minst av alt ANTHROPIC_API_KEY.
 * NODE_OPTIONS er utelatt med vilje: den kan inneholde --require, og da ville
 * fremmed kode kjørt inne i det som skal være det innerste, minst privilegerte
 * laget.
 */
export function runnerEnv(): Record<string, string> {
  return process.platform === "win32"
    ? { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "" }
    : { PATH: process.env.PATH ?? "" };
}

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
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const dbPath = options.dbPath ?? archivePath();

  const { query: clean } = validateReadOnlySql(query);
  const started = Date.now();

  const payload = await new Promise<RunnerResponse>((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [
        "--no-warnings",
        // Et tak på haugen i tillegg til tidsgrensen. Tidsgrensen fanger en treg
        // spørring, ikke en rask som ber om et enormt resultat.
        `--max-old-space-size=${MAX_HEAP_MB}`,
        "-e",
        RUNNER_SCRIPT,
        dbPath,
        clean,
        String(maxRows),
        String(maxBytes),
      ],
      {
        timeout: timeoutMs,
        killSignal: "SIGKILL",
        maxBuffer: MAX_BUFFER_BYTES,
        // Cast fordi Nodes ProcessEnv-type krever NODE_ENV. Den skal nettopp
        // ikke være der: miljøet er bevisst så tomt som prosessen tåler.
        env: runnerEnv() as NodeJS.ProcessEnv,
      },
      (err, stdout) => {
        if (err) {
          // execFile setter `killed` når timeouten slo til.
          reject(
            (err as NodeJS.ErrnoException & { killed?: boolean }).killed
              ? new Error(`Spørringen brukte for lang tid og ble avbrutt etter ${timeoutMs} ms.`)
              : new Error(scrubPaths(err.message.split("\n")[0] ?? String(err))),
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

  if (!payload.ok) throw new Error(scrubPaths(payload.error));

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
