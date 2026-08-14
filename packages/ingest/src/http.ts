import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { repoRoot } from "@aafkstats/schema/load";

const USER_AGENT = "aafkstats-arkiv/0.1 (+https://github.com/mlervaag/aafkstats)";
const MIN_INTERVAL_MS = 1100;
const REQUEST_TIMEOUT_MS = 20_000;
const lastRequestAt = new Map<string, number>();
const sleep = (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

export interface FetchJsonOptions {
  refresh?: boolean;
  onNetworkRequest?: () => void;
}

export type FetchOptions = FetchJsonOptions;

function cacheDir(): string {
  return resolve(repoRoot(), ".cache/ingest");
}

/** JSON-henting med per-vert-fartsgrense, retry, tidsgrense og atomisk cache. */
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  return JSON.parse(await fetchText(url, options)) as T;
}

/**
 * Rå tekst med samme fartsgrense, retry og cache som JSON-henteren.
 *
 * Finnes fordi ikke alle kilder er API-er. RSSSF er statiske tekstsider, og de
 * skal gjennom nøyaktig samme hensyn — én forespørsel i sekundet per vert, cache
 * på disk, og ingen ny runde mot kilden når vi bare skal rette en parsefeil.
 */
export async function fetchText(url: string, options: FetchJsonOptions = {}): Promise<string> {
  const key = createHash("sha256").update(url).digest("hex").slice(0, 32);
  const file = join(cacheDir(), `${key}.json`);
  if (!options.refresh && existsSync(file)) {
    return await readFile(file, "utf8");
  }

  const host = new URL(url).host;
  const since = Date.now() - (lastRequestAt.get(host) ?? 0);
  if (since < MIN_INTERVAL_MS) await sleep(MIN_INTERVAL_MS - since);
  lastRequestAt.set(host, Date.now());
  options.onNetworkRequest?.();

  const body = await withRetry(url, REQUEST_TIMEOUT_MS, "text/html, application/json;q=0.9, */*;q=0.5", (response) => response.text());
  await mkdir(cacheDir(), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, body, "utf8");
  await rename(temporary, file);
  return body;
}

/** Binær henting med samme fartsgrense, retry og atomiske cache som tekst. */
export async function fetchBytes(url: string, options: FetchOptions = {}): Promise<Uint8Array> {
  const key = createHash("sha256").update(url).digest("hex").slice(0, 32);
  const file = join(cacheDir(), `${key}.bin`);
  if (!options.refresh && existsSync(file)) {
    return new Uint8Array(await readFile(file));
  }

  const host = new URL(url).host;
  const since = Date.now() - (lastRequestAt.get(host) ?? 0);
  if (since < MIN_INTERVAL_MS) await sleep(MIN_INTERVAL_MS - since);
  lastRequestAt.set(host, Date.now());
  options.onNetworkRequest?.();

  // Historiske skann kan være større enn 10 MB. Teksttimeouten er for kort for dem.
  const bytes = await withRetry(
    url,
    60_000,
    "application/pdf, application/octet-stream;q=0.9, */*;q=0.5",
    async (response) => new Uint8Array(await response.arrayBuffer()),
  );
  await mkdir(cacheDir(), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, bytes);
  await rename(temporary, file);
  return bytes;
}

async function withRetry<T>(
  url: string,
  timeoutMs: number,
  accept: string,
  read: (response: Response) => Promise<T>,
  attempts = 4,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, accept },
        signal: controller.signal,
      });
      if (response.ok) return await read(response);
      const error = new Error(`${response.status} ${response.statusText} for ${url}`);
      if (response.status >= 400 && response.status < 500) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (error instanceof Error && /^4\d\d /.test(error.message)) throw error;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < attempts - 1) await sleep(2 ** attempt * 1000);
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
