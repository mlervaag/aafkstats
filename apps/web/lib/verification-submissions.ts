const CACHE_MS = 30_000;
const MAX_PAGES = 10;

interface SubmissionCache {
  repo: string;
  expiresAt: number;
  caseIds: Set<string>;
}

declare global {
  var __aafkVerificationSubmissionCache: SubmissionCache | undefined;
}

function inboxConfig(): { repo: string; token: string } | null {
  const repo = process.env.GITHUB_INBOX_REPO;
  const token = process.env.GITHUB_INBOX_TOKEN;
  if (!repo || !token || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return null;
  return { repo, token };
}

function caseIdFromIssue(body: string | null | undefined): string | null {
  const match = body?.match(/\*\*Sak:\*\* \[([a-z0-9-]+)\]\(/);
  return match?.[1] ?? null;
}

/**
 * Åpne GitHub-saker er redaksjonelt arbeid som allerede er levert.
 * De skjules fra community-køen til innbokssaken er behandlet, uten at
 * innholdet i den private innboksen eksponeres til nettleseren.
 */
export async function pendingVerificationCaseIds(): Promise<string[]> {
  const config = inboxConfig();
  if (!config) return [];

  const now = Date.now();
  const cached = globalThis.__aafkVerificationSubmissionCache;
  if (cached?.repo === config.repo && cached.expiresAt > now) return [...cached.caseIds];

  const caseIds = new Set<string>();
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${config.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const response = await fetch(
        `https://api.github.com/repos/${config.repo}/issues?state=open&labels=verifisering&per_page=100&page=${page}`,
        { headers, cache: "no-store" },
      );
      if (!response.ok) throw new Error(`GitHub svarte ${response.status}`);
      const issues = await response.json() as { body?: string | null }[];
      for (const issue of issues) {
        const caseId = caseIdFromIssue(issue.body);
        if (caseId) caseIds.add(caseId);
      }
      if (issues.length < 100) break;
    }
    globalThis.__aafkVerificationSubmissionCache = {
      repo: config.repo,
      expiresAt: now + CACHE_MS,
      caseIds,
    };
    return [...caseIds];
  } catch (error) {
    console.error("Klarte ikke å lese ventende verifiseringer fra GitHub", error);
    return cached?.repo === config.repo ? [...cached.caseIds] : [];
  }
}

/** Gjør en vellykket innsending synlig for neste køkall uten å vente på cache-utløp. */
export function markVerificationCasePending(caseId: string): void {
  const config = inboxConfig();
  if (!config) return;
  const cached = globalThis.__aafkVerificationSubmissionCache;
  // Uten en komplett cache lar vi neste lesing hente hele innboksen. Å starte
  // en ny cache med bare siste sak ville midlertidig gjort eldre saker synlige.
  if (cached?.repo !== config.repo) return;
  const caseIds = new Set(cached.caseIds);
  caseIds.add(caseId);
  globalThis.__aafkVerificationSubmissionCache = {
    repo: config.repo,
    expiresAt: Date.now() + CACHE_MS,
    caseIds,
  };
}

export function resetVerificationSubmissionCache(): void {
  globalThis.__aafkVerificationSubmissionCache = undefined;
}
