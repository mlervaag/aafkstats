import { DATASET_VERSION, executePublicTool, type PublicToolName } from "@aafkstats/query";
import { SITE_ORIGIN, siteUrl } from "./site";

export const API_VERSION = "1";
export const PUBLIC_CACHE = "public, s-maxage=300, stale-while-revalidate=86400";

const BASE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
  "Cache-Control": PUBLIC_CACHE,
  "Content-Type": "application/json; charset=utf-8",
};

function camel(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

const JSON_COLUMNS = new Set(["sources", "missing_fields", "tags", "role_categories", "unlinked_source_references"]);

function publicValue(value: unknown, key = ""): unknown {
  if (typeof value === "string" && JSON_COLUMNS.has(key)) {
    try { return publicValue(JSON.parse(value)); } catch { return value; }
  }
  if (Array.isArray(value)) return value.map((entry) => publicValue(entry));
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      result[camel(childKey)] = publicValue(childValue, childKey);
    }
    if (typeof result.url === "string" && result.url.startsWith("/")) {
      result.canonicalUrl = siteUrl(result.url);
    }
    if (result.href && typeof result.href === "string" && result.href.startsWith("/")) {
      result.canonicalUrl ??= siteUrl(result.href);
    }
    return result;
  }
  return value;
}

export function apiMeta(extra: Record<string, unknown> = {}) {
  return { apiVersion: API_VERSION, datasetVersion: DATASET_VERSION, ...extra };
}

export function apiResponse(data: unknown, extraMeta: Record<string, unknown> = {}, init: ResponseInit = {}): Response {
  const body = JSON.stringify({ meta: apiMeta(extraMeta), data: publicValue(data) });
  return new Response(body, { ...init, headers: { ...BASE_HEADERS, ...Object.fromEntries(new Headers(init.headers).entries()) } });
}

export function apiError(code: string, message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: { code, message } }), { status, headers: BASE_HEADERS });
}

export function apiOptions(): Response {
  return new Response(null, { status: 204, headers: BASE_HEADERS });
}

export function integerParam(search: URLSearchParams, name: string): number | undefined {
  const raw = search.get(name);
  if (raw === null || raw === "") return undefined;
  if (!/^-?\d+$/.test(raw)) throw new Error(`${name} må være et heltall.`);
  return Number(raw);
}

export function booleanParam(search: URLSearchParams, name: string): boolean | undefined {
  const raw = search.get(name);
  if (raw === null || raw === "") return undefined;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} må være true eller false.`);
}

export async function runPublicTool(name: PublicToolName, input: unknown): Promise<Response> {
  const result = await executePublicTool(name, input);
  if (result.isError) {
    const detail = result.content as { error?: string };
    return apiError("invalid_request", detail.error ?? "Spørringen kunne ikke kjøres.");
  }
  const content = result.content as { rows?: unknown[]; rowCount?: number };
  return apiResponse(content.rows ?? content, { count: content.rowCount ?? (content.rows?.length ?? 1) });
}

export const publicApiInfo = {
  apiVersion: API_VERSION,
  datasetVersion: DATASET_VERSION,
  canonicalBaseUrl: `${SITE_ORIGIN}/api/v1`,
  build: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null,
  datasetLicense: "CC BY 4.0 for original database structure and original editorial content; source rights remain with their owners",
  rightsNoticeUrl: siteUrl("/data#lisens-og-rettigheter"),
};
