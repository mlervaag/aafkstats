import { z } from "zod";
import { isoDate, slug } from "./primitives.js";
import { historicalDate, personRoleCategory } from "./person.js";

export const factCandidateKind = z.enum([
  "person_mention",
  "person_role",
  "match_result",
  "lineup_or_squad",
  "organization",
  "season_fact",
]);

export const factCandidate = z.object({
  id: slug,
  kind: factCandidateKind,
  page: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  keywords: z.array(z.string().min(1)).default([]),
  names: z.array(z.string().min(1)).default([]),
  years: z.array(z.number().int().min(1914).max(2100)).default([]),
  scores: z.array(z.string().regex(/^\d{1,2}-\d{1,2}$/)).default([]),
  personIds: z.array(slug).default([]),
  matchIds: z.array(z.string().min(1)).default([]),
}).strict();
export type FactCandidate = z.infer<typeof factCandidate>;

/** Regelen en resolusjon kom av. Gjør det mulig å måle hver regel for seg. */
export const resolutionRule = z.enum([
  /** «Formann, Øivind Haagensen» — tittelen står foran navnet. */
  "role_then_name",
  /** «… med Georg Haller som dens første formann» — navnet står foran tittelen. */
  "name_then_role",
  /** «1917 Nils Jangaard» — en rad i en formannsrekke. */
  "year_row",
]);

/**
 * En rolle lest ut av en side med spaltene og setningen i behold.
 *
 * ## Hvorfor dette er et eget lag
 *
 * `FactCandidate` er utledet av én OCR-linje om gangen. På en tospaltet side
 * løper linja tvers over spaltene, og et rolleord i venstre spalte får navnet
 * som tilfeldigvis står ved siden av i høyre. Kandidatlaget kan derfor si
 * «sekretær: Einar Helseth» der siden faktisk sier at han var nestformann.
 *
 * En resolusjon er samme side lest på nytt, spaltevis, med orddelingen
 * reparert. Den bærer det en rolle trenger for å kunne bli en påstand:
 * hvem, hvilken tittel, og fra når. Den er fortsatt ikke et kanonisk faktum —
 * den skal avstemmes mot personregisteret før den flyttes dit — men i
 * motsetning til en kandidat er den fullstendig nok til å kunne bli det.
 *
 * Løpende tekst lagres ikke. Bare navn, tittel, årstall og sidetall, slik
 * rettighetsgrensen for disse publikasjonene krever.
 */
export const resolvedRole = z.object({
  id: slug,
  page: z.string().min(1),
  /** Hvilken spalte på siden rollen ble lest i. Gjør et treff til å finne igjen. */
  column: z.number().int().nonnegative().optional(),
  personName: z.string().min(1),
  /** Satt når navnet alt finnes i personregisteret. Da er dette en avstemming, ikke en ny person. */
  personId: slug.optional(),
  category: personRoleCategory,
  title: z.string().min(1),
  /** Organisasjonsdelen overskriften over oppgir, for eksempel Hovedstyret. */
  body: z.string().min(1).optional(),
  /** Utelatt når siden ikke oppgir noe år. Da kan rollen ikke løftes som den er. */
  from: historicalDate.optional(),
  to: historicalDate.nullable().default(null),
  confidence: z.enum(["high", "medium", "low"]),
  rule: resolutionRule,
}).strict();

export type ResolvedRole = z.infer<typeof resolvedRole>;

/**
 * Resultatet av én maskinell gjennomgang av én publikasjon.
 *
 * Rå OCR og sammenhengende prosa er uttrykkelig utelatt. Fila inneholder bare
 * proveniens, dekningsmål og korte faktatokens som må vurderes før de løftes inn
 * i kanoniske person-, sesong- eller kampfiler.
 */
export const publicationExtraction = z.object({
  sourceId: slug,
  providerId: slug,
  adapter: z.string().min(1),
  retrievedAt: isoDate,
  ocrAccess: z.enum(["alto", "search_only", "unavailable"]),
  pagesExpected: z.number().int().nonnegative(),
  pagesProcessed: z.number().int().nonnegative(),
  pagesFailed: z.array(z.string().min(1)).default([]),
  contentHash: z.string().regex(/^sha256:[0-9a-f]{64}$/).optional(),
  candidates: z.array(factCandidate).default([]),
  /**
   * Andre gjennomgang. Tom til `nb-resolve` har kjørt for publikasjonen, og
   * skrives uavhengig av `candidates`, slik at en ny lesning ikke kaster
   * dekningstallene fra den første.
   */
  resolvedRoles: z.array(resolvedRole).default([]),
}).strict().superRefine((value, ctx) => {
  if (value.pagesProcessed + value.pagesFailed.length > value.pagesExpected) {
    ctx.addIssue({ code: "custom", path: ["pagesProcessed"], message: "behandlede og feilede sider overstiger forventet sidetall" });
  }
  const ids = new Set<string>();
  for (const [index, candidate] of value.candidates.entries()) {
    if (ids.has(candidate.id)) ctx.addIssue({ code: "custom", path: ["candidates", index, "id"], message: "duplikat kandidat-ID" });
    ids.add(candidate.id);
  }
});

export type PublicationExtraction = z.infer<typeof publicationExtraction>;
