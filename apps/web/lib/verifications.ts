import { all, one, open } from "@aafkstats/db";
import type { VerificationCategory, VerificationStatus } from "@aafkstats/schema";

export interface VerificationEvidenceSource {
  key: string;
  kind: "source" | "provider";
  id: string;
  title: string;
  page: string | null;
  role: "supports" | "contradicts" | "context" | "independent_wanted";
  note: string | null;
  href: string | null;
}

export interface VerificationCaseView {
  id: string;
  status: VerificationStatus;
  category: VerificationCategory;
  claim: string;
  question: string;
  context: string;
  whyItMatters: string;
  yesMeaning: string;
  noMeaning: string;
  instructions: string[];
  target: {
    type: "person" | "match" | "season" | "club" | "source";
    id: string;
    field: string;
    href: string;
  };
  sources: VerificationEvidenceSource[];
  searchHint: string | null;
  estimatedMinutes: number;
  priority: number;
  revision: string;
  publishedAt: string | null;
  resolution: {
    answer: "yes" | "no" | "inconclusive";
    reason: string;
    resolvedAt: string;
    issueUrl?: string;
    pullRequestUrl?: string;
  } | null;
  href: string;
}

interface CaseRow {
  id: string;
  status: VerificationStatus;
  category: VerificationCategory;
  claim: string;
  question: string;
  context: string;
  why_it_matters: string;
  yes_meaning: string;
  no_meaning: string;
  instructions: string;
  target_type: VerificationCaseView["target"]["type"];
  target_id: string;
  target_field: string;
  sources: string;
  search_hint: string | null;
  estimated_minutes: number;
  priority: number;
  revision: string;
  published_at: string | null;
  resolution: string | null;
  url: string;
}

interface SourceRef {
  sourceId?: string;
  providerId?: string;
  page?: string;
  role: VerificationEvidenceSource["role"];
  note?: string;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function targetHref(type: CaseRow["target_type"], id: string): string {
  if (type === "person") return `/personer/${id}`;
  if (type === "match") return `/kamp/${id}`;
  if (type === "season") return `/sesong/${id}`;
  if (type === "club") return `/motstander/${id}`;
  return `/kilder/${id}`;
}

function hydrate(row: CaseRow, sourceRows: Map<string, { title: string; href: string | null }>, providerRows: Map<string, { title: string; href: string | null }>): VerificationCaseView {
  const refs = parseJson<SourceRef[]>(row.sources, []);
  const sources = refs.map((ref, index): VerificationEvidenceSource => {
    const kind = ref.sourceId ? "source" : "provider";
    const id = ref.sourceId ?? ref.providerId ?? `ukjent-${index}`;
    const entry = kind === "source" ? sourceRows.get(id) : providerRows.get(id);
    return {
      key: `${kind}:${id}:${ref.page ?? ""}:${index}`,
      kind,
      id,
      title: entry?.title ?? id,
      page: ref.page ?? null,
      role: ref.role,
      note: ref.note ?? null,
      href: entry?.href ?? null,
    };
  });

  return {
    id: row.id,
    status: row.status,
    category: row.category,
    claim: row.claim,
    question: row.question,
    context: row.context,
    whyItMatters: row.why_it_matters,
    yesMeaning: row.yes_meaning,
    noMeaning: row.no_meaning,
    instructions: parseJson<string[]>(row.instructions, []),
    target: {
      type: row.target_type,
      id: row.target_id,
      field: row.target_field,
      href: targetHref(row.target_type, row.target_id),
    },
    sources,
    searchHint: row.search_hint,
    estimatedMinutes: row.estimated_minutes,
    priority: row.priority,
    revision: row.revision,
    publishedAt: row.published_at,
    resolution: parseJson<VerificationCaseView["resolution"]>(row.resolution, null),
    href: row.url,
  };
}

function loadRows(where = "", params: (string | number)[] = []): VerificationCaseView[] {
  const db = open();
  try {
    const rows = all<CaseRow>(db, `SELECT * FROM verification_cases ${where}`, ...params);
    const sourceRows = new Map(
      all<{ id: string; title: string; access_url: string | null; url: string }>(
        db,
        "SELECT id, title, access_url, url FROM sources",
      ).map((source) => [source.id, { title: source.title, href: source.access_url ?? source.url }]),
    );
    const providerRows = new Map(
      all<{ provider_id: string; name: string; url: string | null }>(
        db,
        "SELECT provider_id, name, url FROM providers",
      ).map((provider) => [provider.provider_id, { title: provider.name, href: provider.url }]),
    );
    return rows.map((row) => hydrate(row, sourceRows, providerRows));
  } finally {
    db.close();
  }
}

export function loadVerificationCases(status: VerificationStatus | "all" = "open"): VerificationCaseView[] {
  return status === "all" ? loadRows() : loadRows("WHERE status = ?", [status]);
}

export function loadVerificationCase(id: string): VerificationCaseView | undefined {
  return loadRows("WHERE id = ? LIMIT 1", [id])[0];
}

export function hasVerificationCase(id: string): boolean {
  const db = open();
  try {
    return Boolean(one(db, "SELECT id FROM verification_cases WHERE id = ?", id));
  } finally {
    db.close();
  }
}
