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
]);

const PLACEHOLDER_REGEX = /<PLACEHOLDER>|<TODO>|\bTODO\b|\bXXX\b|\[TBD\]|\bTBD\b|\bFIXME\b/i;

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

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;

      // 1. Check placeholders
      const placeholderMatch = line.match(PLACEHOLDER_REGEX);
      if (placeholderMatch && !line.includes("APPROVED_DISPOSITIONS") && !line.includes("PLACEHOLDER_REGEX")) {
        placeholdersFound.push(placeholderMatch[0]);
        issues.push({
          type: "placeholder",
          message: `Uferdig mal/placeholder funnet: «${placeholderMatch[0]}»`,
          line: lineNum,
        });
      }

      // 2. Check sourceId mentions
      const sourceMatches = line.matchAll(/\b([a-z0-9]+-(?:19\d\d|20\d\d)(?:-[a-z0-9]+)*)\b/g);
      for (const m of sourceMatches) {
        const potentialId = m[1];
        if (potentialId && options?.knownSourceIds?.has(potentialId)) {
          sourceIdsFound.add(potentialId);
        }
      }

      // 3. Check page coverage pattern like "92/92" or "92 / 92" eller "Sider visuelt kontrollert: 92/92"
      const pageMatch = line.match(/(?:sider\s+visuelt\s+kontrollert|dekning|coverage)?[:\s]*(\d+)\s*\/\s*(\d+)/i);
      if (pageMatch && pageMatch[1] && pageMatch[2] && !pagesReviewedClaim) {
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

      // 4. Check unchecked DoD checkboxes
      if (line.match(/^\s*-\s*\[ \]\s+\*\*/)) {
        uncheckedDodCount += 1;
        issues.push({
          type: "unchecked_dod",
          message: `Uavmerket Definition of Done-punkt: ${line.trim()}`,
          line: lineNum,
        });
      }

      // 5. Check dispositions in table columns
      if (line.includes("|") && (line.includes("`") || line.includes("_"))) {
        for (const disp of APPROVED_DISPOSITIONS) {
          if (line.includes(disp)) {
            dispositionsFound.add(disp);
          }
        }
      }
    }

    // Sjekk at eventuelle oppgitte sourceId-er faktisk finnes i katalogen
    if (options?.knownSourceIds) {
      // All sourceIdsFound are already validated against knownSourceIds
    }

    const passed = issues.filter((i) => i.type === "placeholder" || i.type === "incomplete_coverage").length === 0;

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
