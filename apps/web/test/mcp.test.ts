import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { loadPublicVerificationCase } from "@aafkstats/query";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { DELETE, GET, POST } from "../app/mcp/route.js";
import { clientIp } from "../lib/rate-limit.js";
import { forwardedClientHeaders } from "../lib/mcp-server.js";
import { resetVerificationSubmissionCache } from "../lib/verification-submissions.js";

const previousDbPath = process.env.AAFK_DB_PATH;
let fixtureDir: string;

beforeAll(async () => {
  fixtureDir = mkdtempSync(join(tmpdir(), "aafk-mcp-"));
  const dbPath = join(fixtureDir, "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
});

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
  rmSync(fixtureDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetVerificationSubmissionCache();
  delete process.env.GITHUB_INBOX_TOKEN;
  delete process.env.GITHUB_INBOX_REPO;
});

async function rpc(method: string, params: Record<string, unknown> = {}, id = 1) {
  return POST(new Request("https://aafkarkivet.no/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  }));
}

async function rpcBody(response: Response) {
  const text = await response.text();
  const payload = text.trim().startsWith("{")
    ? text
    : text.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
  if (!payload) throw new Error(`MCP-svar mangler JSON: ${text.slice(0, 100)}`);
  return JSON.parse(payload) as { result: Record<string, unknown> };
}

describe("offentlig stateless MCP", () => {
  it("forhandler dagens 2026-07-28-revisjon med den offisielle klienten", async () => {
    const localFetch = async (input: string | URL | Request, init?: RequestInit) => {
      const request = input instanceof Request ? new Request(input, init) : new Request(input, init);
      if (request.method === "GET") return GET(request);
      if (request.method === "DELETE") return DELETE(request);
      return POST(request);
    };
    const client = new Client({ name: "aafk-test", version: "1" }, { versionNegotiation: { mode: { pin: "2026-07-28" } } });
    await client.connect(new StreamableHTTPClientTransport(new URL("https://aafkarkivet.no/mcp"), { fetch: localFetch }));
    expect(client.getProtocolEra()).toBe("modern");
    expect((await client.listTools()).tools.some((tool) => tool.name === "search_all_results")).toBe(true);
    await client.close();
  });

  it("forhandler legacy stateless og annonserer ingen skrive- eller SQL-verktøy", async () => {
    const initialized = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
    expect(initialized.status).toBe(200);
    const listed = await rpc("tools/list", {}, 2);
    expect(listed.status).toBe(200);
    const body = await rpcBody(listed);
    const names = (body.result.tools as { name: string }[]).map((tool) => tool.name);
    expect(names).toContain("search_all_results");
    expect(names).toContain("get_person");
    expect(names).toContain("search_sources");
    expect(names).toContain("get_source");
    expect(names).toContain("list_verification_cases");
    expect(names).not.toContain("run_sql");
    expect(names).toContain("submit_research_finding");
  });

  it("kjører uavhengige stateless tool-kall", async () => {
    const response = await rpc("tools/call", { name: "search_all_results", arguments: { season: 1955, limit: 5 } });
    expect(response.status).toBe(200);
    const body = await rpcBody(response);
    expect(body.result.isError).not.toBe(true);
    const content = body.result.structuredContent as {
      rows: { evidence_level: string; missing_fields: unknown[]; sources: unknown[]; url: string; path: string }[];
      evidencePolicy: { contract: string };
    };
    expect(content.evidencePolicy.contract).toBe("archive-result-evidence@1");
    expect(content.rows.some((row) => row.evidence_level === "source_claim")).toBe(true);
    expect(content.rows.every((row) => Array.isArray(row.missing_fields) && Array.isArray(row.sources))).toBe(true);
    expect(content.rows.every((row) => row.url.startsWith("https://aafkarkivet.no/") && row.path.startsWith("/"))).toBe(true);
  });

  it("returnerer en kompakt liste over bare åpne publiserte researchsaker", async () => {
    const response = await rpc("tools/call", { name: "list_verification_cases", arguments: { limit: 100 } });
    const body = await rpcBody(response);
    const cases = (body.result.structuredContent as { items: { id: string; canSubmitViaMcp: boolean; href: string; context?: string; sources?: unknown[] }[] }).items;
    expect(cases.length).toBeGreaterThan(0);
    expect(cases.every((item) => typeof item.canSubmitViaMcp === "boolean" && item.href.startsWith("https://aafkarkivet.no/"))).toBe(true);
    expect(cases.every((item) => item.context === undefined && item.sources === undefined)).toBe(true);

    const detailResponse = await rpc("tools/call", { name: "get_verification_case", arguments: { id: cases[0]!.id } });
    const detailBody = await rpcBody(detailResponse);
    expect(JSON.stringify(body.result.structuredContent).length)
      .toBeLessThan(JSON.stringify(detailBody.result.structuredContent).length * cases.length);
  });

  it("holder research-overview kompakt og legger detaljene i egne list-verktøy", async () => {
    const response = await rpc("tools/call", { name: "get_research_overview", arguments: {} });
    const body = await rpcBody(response);
    const overview = body.result.structuredContent as {
      matchFields: { total: number; present: number; missing: number; matches?: number }[];
      incompleteSeasons: { count: number; items?: unknown[] };
      lineupReview: { candidates: number; sources: number; items?: unknown[] };
      identity: { playersWithoutFile: number; filesWithoutMatches: number };
    };
    expect(overview.matchFields.every((field) => field.total === field.present + field.missing && field.matches === undefined)).toBe(true);
    expect(overview.incompleteSeasons.items).toBeUndefined();
    expect(overview.lineupReview.items).toBeUndefined();
    expect(typeof overview.identity.playersWithoutFile).toBe("number");
    expect(JSON.stringify(overview).length).toBeLessThan(5_000);
  });

  it("returnerer provider-proveniens og native JSON fra get_match", async () => {
    const response = await rpc("tools/call", { name: "get_match", arguments: { matchId: "2024-04-01-aalesunds-fk-raufoss-il" } });
    const body = await rpcBody(response);
    const match = (body.result.structuredContent as { match: { rows: { providers: unknown[]; sources: unknown[]; tags: unknown[]; url: string }[] } }).match.rows[0]!;
    expect(match.providers).toBeInstanceOf(Array);
    expect(match.providers.length).toBeGreaterThan(0);
    expect(match.sources).toBeInstanceOf(Array);
    expect(match.tags).toBeInstanceOf(Array);
    expect(match.url).toBe("https://aafkarkivet.no/kamp/2024-04-01-aalesunds-fk-raufoss-il");
  });

  it("sender et researchfunn til samme GitHub-innboks og svarer bare pending_review", async () => {
    process.env.GITHUB_INBOX_TOKEN = "test-token";
    process.env.GITHUB_INBOX_REPO = "mlervaag/aafkstats";
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/search/issues")) return Response.json({ items: [] });
      if (url.includes("/issues?state=open")) return Response.json([]);
      if (url.endsWith("/issues") && init?.method === "POST") return Response.json({ html_url: "https://github.com/mlervaag/aafkstats/issues/1002" }, { status: 201 });
      throw new Error(`Uventet GitHub-kall: ${url}`);
    }));
    const item = loadPublicVerificationCase("fixture-nb-research-sibling")!;
    const response = await rpc("tools/call", { name: "submit_research_finding", arguments: {
      caseId: item.id, revision: item.revision, answer: "yes",
      evidence: { kind: "listed_source", sourceKey: item.sources[0]!.key },
      finding: "Dato og resultat skiller oppføringen fra de andre.",
      researchSubmission: { verificationSubmissionVersion: 2, category: "sibling_resolution", answer: "matched_source_result", selectedSourceResult: { sourceId: "aafk-90-ar-1914-2004", no: 4 }, structuredFindings: { date: "1955-05-08", homeAway: "home" } },
      clientSubmissionId: "da5e52d8-4c91-4b53-bb56-f83688b9db2a",
    } });
    const body = await rpcBody(response);
    expect(body.result.isError).not.toBe(true);
    expect(body.result.structuredContent).toMatchObject({ status: "pending_review", duplicate: false });
  });

  it("avviser store og cross-origin forespørsler før SDK-en", async () => {
    const large = await POST(new Request("https://aafkarkivet.no/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(70_000) }));
    expect(large.status).toBe(413);
    const crossOrigin = await POST(new Request("https://aafkarkivet.no/mcp", { method: "POST", headers: { "content-type": "application/json", origin: "https://example.com" }, body: "{}" }));
    expect(crossOrigin.status).toBe(403);
    const opaqueOrigin = await POST(new Request("https://aafkarkivet.no/mcp", { method: "POST", headers: { "content-type": "application/json", origin: "null" }, body: "{}" }));
    expect(opaqueOrigin.status).toBe(403);
  });

  it("bevarer klient-IP når MCP sender research til verifiseringsruten", () => {
    const incoming = new Request("https://aafkarkivet.no/mcp", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.42",
        "x-forwarded-for": "kan-forfalskes, 203.0.113.42",
      },
    });
    const forwarded = new Request("https://aafkarkivet.no/api/verifications", {
      headers: forwardedClientHeaders(incoming),
    });
    expect(clientIp(forwarded)).toBe("203.0.113.42");
  });
});
