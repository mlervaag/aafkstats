import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { loadValidateAndBuild } from "@aafkstats/db/build";
import { parseNewspaperVerificationIssue } from "@aafkstats/schema";
import VerificationCasePage, { generateStaticParams } from "../app/mangler/[id]/page.js";
import { GET as getCheckout, POST as postCheckout } from "../app/api/verifications/checkout/route.js";
import { POST } from "../app/api/verifications/route.js";
import { availableVerificationCases, VerificationExperience } from "../components/verifications/VerificationExperience.js";
import { VerificationHistory } from "../components/verifications/VerificationHistory.js";
import { ContributeVerificationCard } from "../components/verifications/ContributeVerificationCard.js";
import { restoreVerificationDraft } from "../lib/verification-draft.js";
import { checkedOutCaseIds, claimVerificationCase, releaseVerificationCase } from "../lib/verification-checkout.js";
import { resetVerificationSubmissionCache } from "../lib/verification-submissions.js";
import { loadVerificationCase, loadVerificationCases } from "../lib/verifications.js";
import { validateResearchSubmission } from "../lib/research-submission.js";

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
    expect(loadVerificationCases("all")).toHaveLength(12);
    expect(cases).toHaveLength(4);
    expect(cases[0]?.id).toBe("fixture-open-high");
    expect(cases.every((item, index) => index === 0 || cases[index - 1]!.priority >= item.priority)).toBe(true);
  });

  it("hydraterer kilder og stabile revisjoner", () => {
    const item = loadVerificationCase("fixture-open-high");
    expect(item?.revision).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(item?.sources[0]).toMatchObject({ title: expect.any(String), page: "10" });
    expect(item?.target.href).toBe("/personer/tor-hogne-aaroy");
  });

  it("viser en avisoppgave med direkte NB-lenke og tre svar", () => {
    const item = loadVerificationCase("nb-avis-1946-15-4ee1a1e2f3")!;
    expect(item.newspaper).toMatchObject({
      sourceResult: { year: 1946, no: 1, opponent: "Ranheim" },
      newspaper: { title: "Sunnmørsposten", page: "4" },
    });
    const html = renderToStaticMarkup(React.createElement(VerificationExperience, { cases: [item] }));
    expect(html).toContain("Åpne avissiden hos NB");
    expect(html).toContain("KAN IKKE BESTEMMES");
    expect(html).not.toContain("avis-OCR");
  });

  it("viser en strukturert research-sak med seks møter og riktig sidehenvisning", () => {
    const item = loadVerificationCase("fixture-nb-research-sibling")!;
    expect(item.researchTask).toMatchObject({
      category: "sibling_resolution",
      actualVisualSource: { printedPage: "7", viewerPage: "6" },
    });
    expect(item.researchTask?.candidateOptions).toHaveLength(6);
    const html = renderToStaticMarkup(React.createElement(VerificationExperience, { cases: [item] }));
    expect(html).toContain("Dette trenger vi hjelp til");
    expect(html).toContain("Det kildekontrollen fant på siden");
    expect(html).toContain("trykt side 7");
    expect(html).toContain("page=6");
    expect(html).toContain("Ingen av disse");
    expect(html).toContain("Kan ikke bestemmes");
    expect(html).toContain("Hopp over");
    expect(html).not.toContain("visual review");
  });

  it("validerer alle strukturerte research-svar uten å redusere dem til JA/NEI", () => {
    const base = loadVerificationCase("fixture-nb-research-sibling")!.researchTask!;
    expect(validateResearchSubmission(base, {
      verificationSubmissionVersion: 2,
      category: "sibling_resolution",
      answer: "none_of_these",
    })).toBeUndefined();
    expect(validateResearchSubmission(base, {
      verificationSubmissionVersion: 2,
      category: "sibling_resolution",
      answer: "inconclusive",
    })).toBeUndefined();

    const dateTask = { ...base, category: "date_research" as const, expectedAnswerShape: ["exact_date", "period_only", "inconclusive"] };
    expect(validateResearchSubmission(dateTask, {
      verificationSubmissionVersion: 2,
      category: "date_research",
      answer: "exact_date",
      structuredFindings: { date: "1955-05-08" },
    })).toBeUndefined();

    const scoreTask = { ...base, category: "score_conflict" as const, expectedAnswerShape: ["newspaper_score", "source_result_score", "different_events", "inconclusive"] };
    expect(validateResearchSubmission(scoreTask, {
      verificationSubmissionVersion: 2,
      category: "score_conflict",
      answer: "different_events",
      evidenceNote: "Kildene beskriver to forskjellige kampdatoer.",
    })).toBeUndefined();

    const competitionTask = { ...base, category: "competition_conflict" as const, expectedAnswerShape: ["league", "nm", "friendly", "other", "different_events", "inconclusive"] };
    expect(validateResearchSubmission(competitionTask, {
      verificationSubmissionVersion: 2,
      category: "competition_conflict",
      answer: "friendly",
      evidenceNote: "Avisen omtaler kampen uttrykkelig som privatkamp.",
    })).toBeUndefined();

    const reconciliationTask = { ...base, category: "source_reconciliation" as const, expectedAnswerShape: ["matched_other_source_result", "missing_source_result", "irrelevant", "inconclusive"] };
    expect(validateResearchSubmission(reconciliationTask, {
      verificationSubmissionVersion: 2,
      category: "source_reconciliation",
      answer: "missing_source_result",
      evidenceNote: "Lagparet finnes ikke blant de kildedokumenterte oppføringene.",
    })).toBeUndefined();
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

  it("presenterer kildekontroll som et lavterskel bidrag", () => {
    const html = renderToStaticMarkup(React.createElement(ContributeVerificationCard, {
      openCaseIds: ["fixture-open-high", "fixture-open-low"],
      researchCaseCount: 1,
      newspaperCaseCount: 1,
      directCaseCount: 1,
      minimumMinutes: 5,
      maximumMinutes: 15,
    }));
    expect(html).toContain("Enkleste måten å bidra");
    expect(html).toContain("2 saker trenger hjelp");
    expect(html).toContain("Ingen forkunnskaper eller konto kreves");
    expect(html).toContain("Kamp fra avis");
    expect(html).toContain("Avisresearch");
    expect(html).toContain("Direkte kildekontroll");
    expect(html).toContain("Se absolutt alle mangler og lister");
    expect(html).toContain('href="/mangler"');
    expect(html).toContain('href="/mangler/saker"');
    expect(html).toContain('href="/mangler/saker?type=avisresearch"');
    expect(html).toContain('href="/mangler/saker?type=avis"');
    expect(html).toContain('href="/mangler/saker?type=direkte"');
  });

  it("lover ikke et totaltall før ventende innsendelser er kontrollert", () => {
    const html = renderToStaticMarkup(React.createElement(VerificationExperience, {
      cases: loadVerificationCases("open"),
    }));
    expect(html).toContain("Velg en annen kontrollsak");
    expect(html).toContain("Sak i arbeidskøen");
    expect(html).not.toContain("Se alle 2 saker");
  });

  it("trekker ventende innsendelser fra køtellingen", () => {
    const cases = loadVerificationCases("open");
    expect(availableVerificationCases(cases, ["fixture-open-high"])).toHaveLength(3);
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
  it("sender valgt research-møte som en maskinlesbar GitHub-payload", async () => {
    process.env.GITHUB_INBOX_TOKEN = "test-token";
    process.env.GITHUB_INBOX_REPO = "mlervaag/aafkstats";
    const item = loadVerificationCase("fixture-nb-research-sibling")!;
    let createdBody = "";
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/search/issues")) return new Response(JSON.stringify({ items: [] }), { status: 200 });
      if (url.includes("/issues?state=open")) return new Response(JSON.stringify([]), { status: 200 });
      if (url.endsWith("/issues") && init?.method === "POST") {
        createdBody = String(init.body);
        return new Response(JSON.stringify({ html_url: "https://github.com/mlervaag/aafkstats/issues/1001" }), { status: 201 });
      }
      throw new Error(`Uventet GitHub-kall: ${url}`);
    }));

    const response = await POST(request({
      caseId: item.id,
      revision: item.revision,
      answer: "yes",
      evidence: { kind: "listed_source", sourceKey: item.sources[0]!.key },
      finding: "Datoen og resultatet skiller oppføring nummer 4 fra de andre.",
      researchSubmission: {
        verificationSubmissionVersion: 2,
        category: "sibling_resolution",
        answer: "matched_source_result",
        selectedSourceResult: { sourceId: "aafk-90-ar-1914-2004", no: 4 },
        structuredFindings: { date: "1955-05-08", homeAway: "home" },
        evidenceNote: "Datoen og resultatet skiller oppføring nummer 4 fra de andre.",
      },
      clientSubmissionId: "ba5e52d8-4c91-4b53-bb56-f83688b9db2a",
      company: "",
    }, "10.20.0.10"));

    expect(response.status).toBe(200);
    const issue = JSON.parse(createdBody) as { body: string; labels: string[] };
    expect(issue.body).toContain("nb-community-research-payload:v1");
    expect(issue.body).toContain('"answer": "matched_source_result"');
    expect(issue.body).toContain('"no": 4');
    expect(issue.body).toContain('"printedPage": "7"');
    expect(issue.body).toContain('"viewerPage": "6"');
    expect(issue.labels).toContain("sibling_resolution");
  });

  it("avviser et research-møte som ikke finnes blant kandidatene", async () => {
    const item = loadVerificationCase("fixture-nb-research-sibling")!;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const response = await POST(request({
      caseId: item.id,
      revision: item.revision,
      answer: "yes",
      evidence: { kind: "listed_source", sourceKey: item.sources[0]!.key },
      finding: "Forsøker en ugyldig kandidat.",
      researchSubmission: {
        verificationSubmissionVersion: 2,
        category: "sibling_resolution",
        answer: "matched_source_result",
        selectedSourceResult: { sourceId: "aafk-90-ar-1914-2004", no: 999 },
      },
      clientSubmissionId: "ca5e52d8-4c91-4b53-bb56-f83688b9db2a",
      company: "",
    }, "10.20.0.11"));
    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sender avisfunn strukturert og godtar kan ikke bestemmes uten fritekst", async () => {
    process.env.GITHUB_INBOX_TOKEN = "test-token";
    process.env.GITHUB_INBOX_REPO = "mlervaag/aafkstats";
    const item = loadVerificationCase("nb-avis-1946-15-4ee1a1e2f3")!;
    let createdBody = "";
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/search/issues")) return new Response(JSON.stringify({ items: [] }), { status: 200 });
      if (url.includes("/issues?state=open")) return new Response(JSON.stringify([]), { status: 200 });
      if (url.endsWith("/issues") && init?.method === "POST") {
        createdBody = String(init.body);
        return new Response(JSON.stringify({ html_url: "https://github.com/mlervaag/aafkstats/issues/1000" }), { status: 201 });
      }
      throw new Error(`Uventet GitHub-kall: ${url}`);
    }));
    const response = await POST(request({
      caseId: item.id,
      revision: item.revision,
      answer: "inconclusive",
      evidence: { kind: "listed_source", sourceKey: item.sources[0]!.key },
      finding: "",
      communityFinding: { reasons: ["Utydelig faksimile"], dateReadable: "uncertain" },
      clientSubmissionId: "aa5e52d8-4c91-4b53-bb56-f83688b9db2a",
      company: "",
    }, "10.20.0.9"));
    expect(response.status).toBe(200);
    const issue = JSON.parse(createdBody) as { body: string; labels: string[] };
    expect(issue.body).toContain('"verificationCaseId"');
    expect(issue.body).toContain('"sourceResult"');
    expect(issue.body).toContain('"candidate"');
    expect(issue.body).toContain("newspaper-verification-payload:v1");
    expect(issue.body).toContain('"communityFinding"');
    expect(issue.labels).toContain("inconclusive");
    expect(parseNewspaperVerificationIssue(issue.body)).toMatchObject({
      verificationCaseId: item.id,
      revision: item.revision,
      answer: "inconclusive",
      candidate: { candidateId: item.newspaper!.candidateId },
      communityFinding: { answer: "inconclusive", reason: "Utydelig faksimile" },
    });
  });

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
