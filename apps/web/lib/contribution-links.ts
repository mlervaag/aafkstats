const NEW_ISSUE_URL = "https://github.com/mlervaag/aafkstats/issues/new";

/**
 * Malene nettstedet lenker til.
 *
 * Lista skal dekke alle malene i .github/ISSUE_TEMPLATE, ikke bare dem noen kom
 * på å lenke til. `klubbidentitet` lå der i månedsvis uten en eneste lenke fra
 * nettstedet: den var bare å finne for den som allerede sto i GitHubs
 * malvelger, eller som leste seg gjennom introen i `datafeil`. Testen under
 * krysser lista mot filene i begge retninger, så en ny mal ikke kan bli
 * liggende utilgjengelig.
 */
export const CONTRIBUTION_TEMPLATES = [
  "datafeil",
  "manglende-kamp",
  "manglende-person",
  "klubbidentitet",
  "ny-kilde",
  "ny-arkivkilde",
  "feil-i-koden",
  "forslag",
] as const;

export type ContributionTemplate = typeof CONTRIBUTION_TEMPLATES[number];

/** Samme ordlyd som `title:` i malen, slik at sakstittelen ser lik ut uansett vei inn. */
const TITLE_PREFIX: Record<ContributionTemplate, string> = {
  datafeil: "Datafeil",
  "manglende-kamp": "Manglende kamp",
  "manglende-person": "Manglende person",
  klubbidentitet: "Klubb",
  "ny-kilde": "Kilde",
  "ny-arkivkilde": "Arkivkilde",
  "feil-i-koden": "Feil",
  forslag: "Forslag",
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
