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

/**
 * Feltene hver mal har, slik `id:` står i YAML-en.
 *
 * GitHub fyller ut et felt i et issue-skjema når adressen har en parameter med
 * samme navn som feltets `id`. Det er den mekanismen som gjør at «Meld en feil»
 * fra Georg Hallers side kan komme fram med navnet og adressen hans allerede
 * utfylt, i stedet for et tomt skjema der bidragsyteren må skrive inn på nytt
 * hvor han akkurat var.
 *
 * Lista står her og ikke bare i YAML-en fordi GitHub ignorerer en parameter som
 * ikke treffer et felt — i stillhet. Skrives `stedet` i stedet for `sted`, eller
 * får feltet en ny `id` i malen, blir lenken bare stående og fylle ut
 * ingenting, og ingenting sier fra. Typen under gjør det til en byggefeil, og
 * testen krysser lista mot YAML-filene så en endring der fanges samme vei.
 *
 * Avkryssingsbokser står ikke i lista. De kan ikke forhåndsutfylles.
 */
const TEMPLATE_FIELDS = {
  datafeil: ["sted", "feil", "kilde", "uenighet"],
  "manglende-kamp": ["dato", "motstander", "hjemmebane", "konkurranse", "resultat", "annet", "kilde"],
  "manglende-person": ["navn", "tilknytning", "periode", "rolle", "kilde", "wikidata"],
  klubbidentitet: ["type", "klubber", "hva", "navneperioder", "kamper", "kilde"],
  "ny-kilde": ["kamp", "opplysninger", "kilde", "kildestatus"],
  "ny-arkivkilde": ["kilde", "hvor", "hva", "rettigheter"],
  "feil-i-koden": ["omrade", "hva", "reproduksjon", "hvor", "miljo", "logg"],
  forslag: ["type", "hva", "bakgrunn"],
} as const satisfies Record<ContributionTemplate, readonly string[]>;

export const CONTRIBUTION_TEMPLATE_FIELDS: Record<ContributionTemplate, readonly string[]> =
  TEMPLATE_FIELDS;

/** Feltene én bestemt mal har. */
type FieldOf<T extends ContributionTemplate> = typeof TEMPLATE_FIELDS[T][number];

/** Verdier å fylle inn, med feltnavn malen faktisk har. */
export type ContributionFields<T extends ContributionTemplate> = Partial<Record<FieldOf<T>, string>>;

/**
 * Åpner riktig GitHub-mal, med konteksten i tittelen og i feltene den hører
 * hjemme i.
 *
 * Tomme verdier utelates. Et felt som fylles med tom streng ser for
 * bidragsyteren ut som et felt noen har vært innom og latt stå, og for et
 * påkrevd felt skjuler det at det faktisk må fylles ut.
 */
export function contributionIssueUrl<T extends ContributionTemplate>(
  template: T,
  context?: string,
  fields?: ContributionFields<T>,
): string {
  const params = new URLSearchParams({ template: `${template}.yml` });
  if (context) params.set("title", `${TITLE_PREFIX[template]}: ${context}`);

  for (const [field, value] of Object.entries(fields ?? {})) {
    if (typeof value === "string" && value.trim() !== "") params.set(field, value);
  }

  return `${NEW_ISSUE_URL}?${params.toString()}`;
}

/**
 * «Georg Haller — /personer/georg-haller», formen malene ber om.
 *
 * `datafeil` og `ny-kilde` spør begge etter hva i arkivet det gjelder, og begge
 * har en placeholder på nøyaktig denne formen: navnet slik leseren så det, og
 * adressen som gjør det mulig å slå opp siden uten å lete. Når lenken kommer fra
 * en side vi vet adressen til, er det ingen grunn til å be noen skrive den av.
 */
export function pageReference(label: string, path: string): string {
  return `${label} — ${path}`;
}
