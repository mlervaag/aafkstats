const NEW_ISSUE_URL = "https://github.com/mlervaag/aafkstats/issues/new";

export const CONTRIBUTION_TEMPLATES = [
  "datafeil",
  "manglende-kamp",
  "ny-kilde",
  "ny-arkivkilde",
] as const;

export type ContributionTemplate = typeof CONTRIBUTION_TEMPLATES[number];

const TITLE_PREFIX: Record<ContributionTemplate, string> = {
  datafeil: "Datafeil",
  "manglende-kamp": "Manglende kamp",
  "ny-kilde": "Kilde",
  "ny-arkivkilde": "Arkivkilde",
};

/** Åpner riktig GitHub-mal og tar med konteksten i sakstittelen. */
export function contributionIssueUrl(
  template: ContributionTemplate,
  context?: string,
): string {
  const params = new URLSearchParams({ template: `${template}.yml` });
  if (context) params.set("title", `${TITLE_PREFIX[template]}: ${context}`);
  return `${NEW_ISSUE_URL}?${params.toString()}`;
}
