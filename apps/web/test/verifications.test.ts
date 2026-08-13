import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import VerificationCasePage, { generateStaticParams } from "../app/mangler/[id]/page.js";
import { GET as getCheckout, POST as postCheckout } from "../app/api/verifications/checkout/route.js";
import { POST } from "../app/api/verifications/route.js";
import { VerificationHistory } from "../components/verifications/VerificationHistory.js";
import { restoreVerificationDraft } from "../lib/verification-draft.js";
import { checkedOutCaseIds, claimVerificationCase, releaseVerificationCase } from "../lib/verification-checkout.js";
import { resetVerificationSubmissionCache } from "../lib/verification-submissions.js";
import { loadVerificationCase, loadVerificationCases } from "../lib/verifications.js";

const previousDbPath = process.env.AAFK_DB_PATH;
let fixtureDbDir: string;

beforeAll(async () => {
  fixtureDbDir = mkdtempSync(join(tmpdir(), "aafk-verifications-"));
  const dbPath = join(fixtureDbDir, "archive.sqlite");
  await loadValidateAndBuild(resolve(import.meta.dirname, "../../../fixtures/data"), dbPath);
  process.env.AAFK_DB_PATH = dbPath;
});

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.AAFK_DB_PATH;
  else process.env.AAFK_DB_PATH = previousDbPath;
  rmSync(fixtureDbDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetVerificationSubmissionCache();
  delete process.env.GITHUB_INBOX_TOKEN;
  delete process.env.GITHUB_INBOX_REPO;
});

describe("verifiseringskøen", () => {
  it("publiserer pilotkøen i prioritert rekkefølge", () => {
    const cases = loadVerificationCases("open");
    expect(cases).toHaveLength(2);
    expect(cases[0]?.id).toBe("fixture-open-high");
    expect(cases.every((item, index) => index === 0 || cases[index - 1]!.priority >= item.priority)).toBe(true);
  });

  it("hydraterer kilder og stabile revisjoner", () => {
    const item = loadVerificationCase("fixture-open-high");
    expect(item?.revision).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(item?.sources[0]).toMatchObject({ title: expect.any(String), page: "10" });
    expect(item?.target.href).toBe("/personer/tor-hogne-aaroy");
  });

  it("beholder en permanent side når en publisert sak er løst", async () => {
    expect(generateStaticParams()).toContainEqual({ id: "fixture-resolved" });
    const page = await VerificationCasePage({ params: Promise.resolve({ id: "fixture-resolved" }) });
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Saken er løst");
    expect(html).toContain("Fixture-kilden identifiserer personen uttrykkelig.");
    expect(html).toContain("https://github.com/mlervaag/aafkstats/issues/1");
    expect(html).toContain("https://github.com/mlervaag/aafkstats/pull/1");
  });

  it("viser avgjorte saker og forklarer arbeidsflyten i historikken", () => {
    const html = renderToStaticMarkup(React.createElement(VerificationHistory, {
      cases: loadVerificationCases("all"),
    }));
    expect(html).toContain("Se hva andre har kontrollert");
    expect(html).toContain("Fixture-kilden identifiserer personen uttrykkelig.");
    expect(html).toContain("Se konklusjon og kilder");
  });
});

describe("stabile innsendinger", () => {
  it("gjenbruker samme klient-ID når et lagret utkast åpnes igjen", () => {
    const submissionId = "54ae52d8-4c91-4b53-bb56-f83688b9db2a";
    const saved = JSON.stringify({ finding: "Kontrollert i kilden.", clientSubmissionId: submissionId });
    const draft = restoreVerificationDraft(saved, "source:fixture:10:0", true, () => "skal-ikke-brukes");
    expect(draft.clientSubmissionId).toBe(submissionId);
    expect(draft.finding).toBe("Kontrollert i kilden.");
  });
});

const submissionId = "54ae52d8-4c91-4b53-bb56-f83688b9db2a";

function submission(overrides: Record<string, unknown> = {}) {
  const item = loadVerificationCase("fixture-open-high")!;
  return {
    caseId: item.id,
    revision: item.revision,
    answer: "yes",
    evidence: { kind: "listed_source", sourceKey: item.sources[0]!.key },
    finding: "Navnet står uttrykkelig i fixture-kilden.",
    clientSubmissionId: submissionId,
    company: "",
    ...overrides,
  };
}

function request(body: unknown, ip: string): Request {
  return new Request("http://arkivet.test/api/verifications", {
    method: "POST",
    headers: { "content-type": "application/json", host: "arkivet.test", "x-real-ip": ip },
    body: JSON.stringify(body),
  });
}

describe("verifiseringsinnsending", () => {
  it("avviser en foreldet revisjon med 409 før GitHub kalles", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const response = await POST(request(submission({ revision: `sha256:${"0".repeat(64)}` }), "10.20.0.1"));
    expect(response.status).toBe(409);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("avviser en kilde som ikke hører til saken", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const response = await POST(request(submission({
      evidence: { kind: "listed_source", sourceKey: "source:falsk:1:0" },
    }), "10.20.0.2"));
    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("avviser innsending til en avsluttet sak", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const item = loadVerificationCase("fixture-resolved")!;
    const response = await POST(request(submission({
      caseId: item.id,
      revision: item.revision,
      evidence: { kind: "listed_source", sourceKey: item.sources[0]!.key },
    }), "10.20.0.3"));
    expect(response.status).toBe(410);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returnerer den samme GitHub-saken ved retry med samme klient-ID", async () => {
    process.env.GITHUB_INBOX_TOKEN = "test-token";
    process.env.GITHUB_INBOX_REPO = "mlervaag/aafkstats";
    let created = false;
    let createCalls = 0;
    const issueUrl = "https://github.com/mlervaag/aafkstats/issues/999";
    const fetchSpy = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/search/issues")) {
        return new Response(JSON.stringify({ items: created ? [{ html_url: issueUrl }] : [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/issues?state=open")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/issues") && init?.method === "POST") {
        created = true;
        createCalls += 1;
        return new Response(JSON.stringify({ html_url: issueUrl }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Uventet GitHub-kall: ${url}`);
    });
    vi.stubGlobal("fetch", fetchSpy);

    const first = await POST(request(submission(), "10.20.0.4"));
    const second = await POST(request(submission(), "10.20.0.4"));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ success: true, issueUrl, duplicate: true });
    expect(createCalls).toBe(1);
  });

  it("avviser et nytt svar når en annen innsending allerede venter", async () => {
    process.env.GITHUB_INBOX_TOKEN = "test-token";
    process.env.GITHUB_INBOX_REPO = "mlervaag/aafkstats-inbox";
    const item = loadVerificationCase("fixture-open-high")!;
    const fetchSpy = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/search/issues")) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      if (url.includes("/issues?state=open")) {
        return new Response(JSON.stringify([{
          body: `**Sak:** [${item.id}](https://aafkarkivet.no/mangler/${item.id})`,
        }]), { status: 200 });
      }
      throw new Error(`Uventet GitHub-kall: ${url}`);
    });
    vi.stubGlobal("fetch", fetchSpy);

    const response = await POST(request(submission({
      clientSubmissionId: "13d7f244-12ae-4d91-b78d-941d5efbca3e",
    }), "10.20.0.5"));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("venter på vurdering") });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("myk reservasjon", () => {
  it("fornyes av samme besøkende og avviser en annen", () => {
    const caseId = "test-reservasjon";
    const first = "c7347db5-ff53-4eb7-bf86-fd267aa49c84";
    const second = "a92dcddf-5098-4663-84ca-19fa77a412e1";
    expect(claimVerificationCase(caseId, first).acquired).toBe(true);
    expect(claimVerificationCase(caseId, first).acquired).toBe(true);
    expect(claimVerificationCase(caseId, second).acquired).toBe(false);
    expect(checkedOutCaseIds(second)).toContain(caseId);
    expect(releaseVerificationCase(caseId, second)).toBe(false);
    expect(releaseVerificationCase(caseId, first)).toBe(true);
    expect(checkedOutCaseIds(second)).not.toContain(caseId);
  });

  it("skjuler saker som allerede venter i GitHub-innboksen", async () => {
    process.env.GITHUB_INBOX_TOKEN = "test-token";
    process.env.GITHUB_INBOX_REPO = "mlervaag/aafkstats-inbox";
    const issueBody = "**Sak:** [fixture-open-high](https://aafkarkivet.no/mangler/fixture-open-high)";
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ body: issueBody }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const owner = "c7347db5-ff53-4eb7-bf86-fd267aa49c84";
    const listResponse = await getCheckout(new Request(`http://arkivet.test/api/verifications/checkout?owner=${owner}`));
    expect(await listResponse.json()).toMatchObject({
      submitted: ["fixture-open-high"],
      unavailable: expect.arrayContaining(["fixture-open-high"]),
    });

    const claimResponse = await postCheckout(new Request("http://arkivet.test/api/verifications/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", host: "arkivet.test" },
      body: JSON.stringify({ caseId: "fixture-open-high", owner }),
    }));
    expect(claimResponse.status).toBe(409);
    expect(await claimResponse.json()).toMatchObject({ acquired: false, submitted: true });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
