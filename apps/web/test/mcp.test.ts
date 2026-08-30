import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { loadPublicVerificationCase } from "@aafkstats/query";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { DELETE, GET, POST } from "../app/mcp/route.js";
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
    expect(names).toContain("list_verification_cases");
    expect(names).not.toContain("run_sql");
    expect(names).toContain("submit_research_finding");
  });

  it("kjører uavhengige stateless tool-kall", async () => {
    const response = await rpc("tools/call", { name: "search_all_results", arguments: { season: 1955, limit: 5 } });
    expect(response.status).toBe(200);
    const body = await rpcBody(response);
    expect(body.result.isError).not.toBe(true);
    expect((body.result.structuredContent as { evidencePolicy: { contract: string } }).evidencePolicy.contract).toBe("archive-result-evidence@1");
  });

  it("returnerer bare åpne publiserte researchsaker", async () => {
    const response = await rpc("tools/call", { name: "list_verification_cases", arguments: { limit: 100 } });
    const body = await rpcBody(response);
    const cases = (body.result.structuredContent as { items: { status: string; publishedAt: string | null }[] }).items;
    expect(cases.length).toBeGreaterThan(0);
    expect(cases.every((item) => item.status === "open" && item.publishedAt !== null)).toBe(true);
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
  });
});
