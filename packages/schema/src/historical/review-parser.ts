import type { SourceReviewStatus } from "./source-inventory.js";

export interface ReviewValidationIssue {
  type: "placeholder" | "unknown_source" | "incomplete_coverage" | "unchecked_dod" | "invalid_disposition";
  message: string;
  line?: number;
}

export interface ReviewValidationResult {
  parserName: string;
  sourceIdsFound: string[];
  sourceReviewStatuses: Map<string, SourceReviewStatus>;
  pagesReviewedClaim?: { reviewed: number; total: number; isFull: boolean };
  dispositionsFound: string[];
  uncheckedDodCount: number;
  placeholdersFound: string[];
  issues: ReviewValidationIssue[];
  passed: boolean;
}

export interface ReviewParser {
  name: string;
  parseReview(content: string, options?: { knownSourceIds?: Set<string> }): ReviewValidationResult;
}

export const APPROVED_DISPOSITIONS = new Set([
  // Kampdisposisjoner
  "source_result_created",
  "canonical_created",
  "canonical_enriched",
  "fixture_only",
  "outcome_only",
  "result_without_date",
  "date_without_result",
  "already_documented",
  "duplicate_publication",
  "reprint",
  "identity_uncertain",
  "not_a_team",
  "no_structured_action",
  // Persondisposisjoner & milepæler (fra autoritativ runbook #157)
  "person_created",
  "person_enriched",
  "role_created",
  "role_enriched",
  "honor_created",
  "honor_enriched",
  "honorary_role_created",
  "milestone_created",
  "mention_linked",
  "observation_created",
  "historical_observation_created",
  "organization_snapshot_created",
  "conflict_registered",
  "conflict_resolved",
  "verified_correct",
  "non_senior",
  // Prosess- og inventarstatuser
  "reviewed",
  "in_scope",
  "out_of_scope",
  "unavailable",
  "source_unavailable",
  "duplicate_or_reprint",
  "duplicate",
]);

// Ignorer standard HTML-tagger i markdown
const HTML_TAG_NAMES = new Set(["br", "hr", "p", "div", "span", "details", "summary", "code", "pre", "b", "i", "strong", "em", "table", "tr", "td", "th", "tbody", "thead"]);

// Gjenkjenner eksplisitte tekst-placeholders
const LITERAL_PLACEHOLDER_REGEX = /\b(?:TODO|XXX|TBD|FIXME)\b|\[TBD\]|<PLACEHOLDER>|<TODO>/i;
// Bundet tag-regex med maksimal lengde 50 for å unngå polynomial regex runtime
const BOUNDED_TAG_REGEX = /<([A-ZÆØÅa-zæøå0-9_ -]{1,50})>/g;

/**
 * Standard Markdown v1 review parser.
 */
export const markdownV1Parser: ReviewParser = {
  name: "markdown-v1",
  parseReview(content: string, options?: { knownSourceIds?: Set<string> }): ReviewValidationResult {
    const issues: ReviewValidationIssue[] = [];
    const lines = content.split("\n");

    const sourceIdsFound = new Set<string>();
    const sourceReviewStatuses = new Map<string, SourceReviewStatus>();
    const dispositionsFound = new Set<string>();
    const placeholdersFound: string[] = [];
    let uncheckedDodCount = 0;
    let pagesReviewedClaim: { reviewed: number; total: number; isFull: boolean } | undefined;

    let inTable = false;
    let sourceIdColIndex = -1;
    let dispositionColIndex = -1;
    let isSourceInventoryTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;

      // 1. Check placeholders
      if (!line.includes("APPROVED_DISPOSITIONS") && !line.includes("LITERAL_PLACEHOLDER_REGEX")) {
        const literalMatch = line.match(LITERAL_PLACEHOLDER_REGEX);
        if (literalMatch) {
          placeholdersFound.push(literalMatch[0]);
          issues.push({
            type: "placeholder",
            message: `Uferdig mal/placeholder funnet: «${literalMatch[0]}»`,
            line: lineNum,
          });
        } else {
          const tagMatches = line.matchAll(BOUNDED_TAG_REGEX);
          for (const tm of tagMatches) {
            const tagName = tm[1];
            if (tagName && !HTML_TAG_NAMES.has(tagName.toLowerCase().trim())) {
              placeholdersFound.push(tm[0]);
              issues.push({
                type: "placeholder",
                message: `Uferdig mal/placeholder funnet: «${tm[0]}»`,
                line: lineNum,
              });
            }
          }
        }
      }

      // 2. Check page coverage pattern KUN når linjen eksplisitt gjelder visuell sidekontroll
      const lowerLine = line.toLowerCase();
      if (
        (lowerLine.includes("sider visuelt kontrollert") ||
          lowerLine.includes("visuell sidekontroll") ||
          lowerLine.includes("sidekontroll")) &&
        !pagesReviewedClaim
      ) {
        const delimIdx = Math.max(line.indexOf(":"), line.indexOf("|"));
        const textAfter = delimIdx >= 0 ? line.slice(delimIdx + 1) : line;
        const pageMatch = textAfter.match(/\b(\d{1,6})\s*\/\s*(\d{1,6})\b/);
        if (pageMatch && pageMatch[1] && pageMatch[2]) {
          const reviewed = Number.parseInt(pageMatch[1], 10);
          const total = Number.parseInt(pageMatch[2], 10);
          const isFull = reviewed === total && total > 0;
          pagesReviewedClaim = { reviewed, total, isFull };

          if (!isFull) {
            issues.push({
              type: "incomplete_coverage",
              message: `Ufullstendig sidekontroll rapportert (${reviewed}/${total} sider)`,
              line: lineNum,
            });
          }
        }
      }

      // 3. Check unchecked DoD checkboxes
      if (line.match(/^\s*-\s*\[ \]\s+/)) {
        uncheckedDodCount += 1;
        issues.push({
          type: "unchecked_dod",
          message: `Uavmerket Definition of Done-punkt: ${line.trim()}`,
          line: lineNum,
        });
      }

      // 4. Tabell-parsing for Source Inventory og dispositions
      if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
        const rawCells = line.split("|").slice(1, -1);
        const cells = rawCells.map((c) => c.trim());

        // Header-deteksjon
        const isHeaderRow = cells.some((c) => /^(?:sourceid|kilde-id|kilde|disposisjon|disposition|handling|status)$/i.test(c));
        const isSeparatorRow = cells.every((c) => /^:?-+:?$/.test(c));

        if (isHeaderRow) {
          inTable = true;
          sourceIdColIndex = cells.findIndex((c) => /^(?:sourceid|kilde-id|^kilde)$/i.test(c));
          dispositionColIndex = cells.findIndex((c) => /^(?:disposisjon|disposition|handling|status)$/i.test(c));
          isSourceInventoryTable = sourceIdColIndex !== -1 && (
            dispositionColIndex !== -1 ||
            cells.some((c) => /^(?:volum|hefte|extraction|sider)$/i.test(c))
          );
        } else if (!isSeparatorRow && inTable) {
          // Data-rad
          if (sourceIdColIndex >= 0 && sourceIdColIndex < cells.length) {
            const rawSourceId = cells[sourceIdColIndex]!;
            const cleanSourceId = rawSourceId.replace(/[`<>[\]]/g, "").trim();

            if (cleanSourceId && !cleanSourceId.startsWith("---") && !cleanSourceId.includes(" ")) {
              if (options?.knownSourceIds) {
                if (options.knownSourceIds.has(cleanSourceId)) {
                  sourceIdsFound.add(cleanSourceId);
                } else if (!cleanSourceId.startsWith("sourceid-") && cleanSourceId !== "sourceid") {
                  issues.push({
                    type: "unknown_source",
                    message: `Ukjent sourceId «${cleanSourceId}» oppgitt i tabell`,
                    line: lineNum,
                  });
                }
              } else {
                sourceIdsFound.add(cleanSourceId);
              }

              // Hvis Source Inventory-tabell, hent eksplisitt review-status fra disposition-kolonnen
              if (isSourceInventoryTable && dispositionColIndex >= 0 && dispositionColIndex < cells.length) {
                const dispRaw = cells[dispositionColIndex]!.replace(/[`<>[\]]/g, "").trim().toLowerCase();
                if (dispRaw === "reviewed") {
                  sourceReviewStatuses.set(cleanSourceId, "reviewed");
                } else if (dispRaw === "duplicate" || dispRaw === "reprint" || dispRaw === "duplicate_publication" || dispRaw === "duplicate_or_reprint") {
                  sourceReviewStatuses.set(cleanSourceId, "duplicate_or_reprint");
                } else if (dispRaw === "out_of_scope") {
                  sourceReviewStatuses.set(cleanSourceId, "out_of_scope");
                } else if (dispRaw === "unavailable" || dispRaw === "source_unavailable") {
                  sourceReviewStatuses.set(cleanSourceId, "unavailable");
                }
              }
            }
          }

          // Valider samtlige disposisjoner i tabellen
          if (dispositionColIndex >= 0 && dispositionColIndex < cells.length) {
            const dispCell = cells[dispositionColIndex]!;
            if (dispCell && !dispCell.startsWith("---")) {
              // Trekk ut alle backtick-tokens eller ord separert med skråstrek/mellomrom
              const tokens = dispCell
                .split(/[/,\s]+/)
                .map((t) => t.replace(/[`<>[\]]/g, "").trim().toLowerCase())
                .filter((t) => t.length > 0 && !t.startsWith("---") && !t.startsWith("==="));

              for (const token of tokens) {
                if (APPROVED_DISPOSITIONS.has(token)) {
                  dispositionsFound.add(token);
                } else if (!token.startsWith("disposition") && !token.startsWith("reviewed/duplicate")) {
                  issues.push({
                    type: "invalid_disposition",
                    message: `Ugyldig disposisjon «${token}» i tabell`,
                    line: lineNum,
                  });
                }
              }
            }
          }
        }
      } else {
        inTable = false;
        sourceIdColIndex = -1;
        dispositionColIndex = -1;
        isSourceInventoryTable = false;
      }
    }

    const passed = issues.length === 0;

    return {
      parserName: "markdown-v1",
      sourceIdsFound: [...sourceIdsFound],
      sourceReviewStatuses,
      pagesReviewedClaim,
      dispositionsFound: [...dispositionsFound],
      uncheckedDodCount,
      placeholdersFound,
      issues,
      passed,
    };
  },
};
