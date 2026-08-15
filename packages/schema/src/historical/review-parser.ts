export interface ReviewValidationIssue {
  type: "placeholder" | "unknown_source" | "incomplete_coverage" | "unchecked_dod" | "invalid_disposition";
  message: string;
  line?: number;
}

export interface ReviewValidationResult {
  parserName: string;
  sourceIdsFound: string[];
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
  // Persondisposisjoner
  "person_created",
  "person_enriched",
  "role_created",
  "role_enriched",
  "honorary_role_created",
  "organization_snapshot_created",
  "historical_observation_created",
  "conflict_registered",
  "conflict_resolved",
  "verified_correct",
  // Prosess-statuser i tabeller
  "reviewed",
  "in_scope",
  "out_of_scope",
  "unavailable",
  "duplicate_or_reprint",
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
    const dispositionsFound = new Set<string>();
    const placeholdersFound: string[] = [];
    let uncheckedDodCount = 0;
    let pagesReviewedClaim: { reviewed: number; total: number; isFull: boolean } | undefined;

    let inDispositionTable = false;
    let dispositionColIndex = -1;

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

      // 2. Check sourceId mentions
      const sourceMatches = line.matchAll(/\b([a-z0-9]+-(?:19\d\d|20\d\d)(?:-[a-z0-9]+)*)\b/g);
      for (const m of sourceMatches) {
        const potentialId = m[1];
        if (potentialId) {
          if (options?.knownSourceIds) {
            if (options.knownSourceIds.has(potentialId)) {
              sourceIdsFound.add(potentialId);
            } else if (
              potentialId.startsWith("aafk-") ||
              potentialId.startsWith("sfk-") ||
              potentialId.startsWith("medlemsblad-") ||
              potentialId.startsWith("sunnmorsposten-") ||
              potentialId.startsWith("sunnmore-arbeideravis-")
            ) {
              issues.push({
                type: "unknown_source",
                message: `Ukjent sourceId «${potentialId}» nevnt i reviewet`,
                line: lineNum,
              });
            }
          } else {
            sourceIdsFound.add(potentialId);
          }
        }
      }

      // 3. Check page coverage pattern KUN når linjen eksplisitt gjelder visuell sidekontroll
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

      // 4. Check unchecked DoD checkboxes
      if (line.match(/^\s*-\s*\[ \]\s+\*\*/)) {
        uncheckedDodCount += 1;
        issues.push({
          type: "unchecked_dod",
          message: `Uavmerket Definition of Done-punkt: ${line.trim()}`,
          line: lineNum,
        });
      }

      // 5. Check table headers and dispositions
      if (line.includes("|")) {
        const cells = line.split("|").map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        const headerMatch = cells.findIndex((c) => /^(?:disposisjon|disposition|handling)$/i.test(c));
        if (headerMatch !== -1) {
          inDispositionTable = true;
          dispositionColIndex = headerMatch;
        } else if (inDispositionTable && cells.length > dispositionColIndex && dispositionColIndex >= 0) {
          const dispCell = cells[dispositionColIndex];
          if (dispCell && !dispCell.startsWith("---") && !dispCell.startsWith("===")) {
            // Trekk ut backtick-tokens eller snake_case ord
            const tokenMatch = dispCell.match(/`?([a-z0-9_]+)`?/i);
            const token = tokenMatch ? tokenMatch[1]?.toLowerCase() : undefined;
            if (token && token.includes("_")) {
              if (APPROVED_DISPOSITIONS.has(token)) {
                dispositionsFound.add(token);
              } else {
                issues.push({
                  type: "invalid_disposition",
                  message: `Ugyldig disposisjon «${token}» i tabell`,
                  line: lineNum,
                });
              }
            }
          }
        }
      } else {
        inDispositionTable = false;
        dispositionColIndex = -1;
      }
    }

    const passed = issues.length === 0;

    return {
      parserName: "markdown-v1",
      sourceIdsFound: [...sourceIdsFound],
      pagesReviewedClaim,
      dispositionsFound: [...dispositionsFound],
      uncheckedDodCount,
      placeholdersFound,
      issues,
      passed,
    };
  },
};
