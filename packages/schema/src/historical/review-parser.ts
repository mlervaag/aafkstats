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

import { historicalDispositionEnum } from "./harvest-finding.js";

export const APPROVED_DISPOSITIONS = new Set<string>(historicalDispositionEnum.options);


// Ignorer standard HTML-tagger i markdown
const HTML_TAG_NAMES = new Set(["br", "hr", "p", "div", "span", "details", "summary", "code", "pre", "b", "i", "strong", "em", "table", "tr", "td", "th", "tbody", "thead"]);

// Gjenkjenner eksplisitte tekst-placeholders
const LITERAL_PLACEHOLDER_REGEX = /\b(?:TODO|XXX|TBD|FIXME)\b|\[TBD\]|<PLACEHOLDER>|<TODO>/i;
// Bundet tag-regex med maksimal lengde 50 for å unngå polynomial regex runtime
const BOUNDED_TAG_REGEX = /<([A-ZÆØÅa-zæøå0-9_ -]{1,50})>/g;

/**
 * Kolonneoverskrifter som identifiserer kilde- og disposisjonskolonnen.
 *
 * Overskriftene tillates å ha en presisering etter seg — «Kilde (sourceId)»,
 * «Disposisjon / handling» — siden den eksakte matchen tidligere gjorde at hele
 * inventartabellen falt ut av parsingen uten et eneste varsel.
 */
const SOURCE_ID_HEADER_REGEX = /^(?:sourceid|kilde-?id|kilde)\b/i;
const DISPOSITION_HEADER_REGEX = /^(?:disposisjon|disposition|handling|status)\b/i;

/**
 * Normaliserer én disposisjonscelle til et sammenlignbart token.
 */
function normalizeDispositionToken(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, "")
    // NB: understrek strippes ikke — den er en del av disposisjonsnavnene.
    .replace(/[`<>[\]*]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Trekker disposisjonene ut av en tabellcelle.
 *
 * Cellen kan inneholde flere disposisjoner skilt med skråstrek eller komma, og
 * gjerne en parentes med prosa etterpå. Tidligere ble cellen delt på mellomrom
 * også, slik at «reviewed (se note)» ga to falske feil og presset
 * dokumentforfatteren til å skrive etter parseren i stedet for omvendt.
 */
function extractDispositionTokens(cell: string): string[] {
  return cell
    .split(/[/,]/)
    .map(normalizeDispositionToken)
    .map((token) => token.split(/\s+/)[0] ?? "")
    .filter((token) => token.length > 0 && !token.startsWith("---") && !token.startsWith("==="));
}

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

    let inCodeFence = false;
    let inTable = false;
    let sourceIdColIndex = -1;
    let dispositionColIndex = -1;
    let isSourceInventoryTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;

      // 1. Check placeholders
      // Kodeblokker og inline-kode er dokumentasjon av parseren selv, ikke
      // uferdig mal. Alt annet kontrolleres — tidligere holdt det å nevne
      // «APPROVED_DISPOSITIONS» i en linje for å slå av kontrollen helt.
      if (line.trim().startsWith("```")) {
        inCodeFence = !inCodeFence;
      }

      if (!inCodeFence) {
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
        lowerLine.includes("sider visuelt kontrollert") ||
        lowerLine.includes("visuell sidekontroll") ||
        lowerLine.includes("sidekontroll")
      ) {
        const delimIdx = Math.max(line.indexOf(":"), line.indexOf("|"));
        const textAfter = delimIdx >= 0 ? line.slice(delimIdx + 1) : line;
        const pageMatch = textAfter.match(/\b(\d{1,6})\s*\/\s*(\d{1,6})\b/);
        if (pageMatch && pageMatch[1] && pageMatch[2]) {
          const reviewed = Number.parseInt(pageMatch[1], 10);
          const total = Number.parseInt(pageMatch[2], 10);
          const isFull = reviewed === total && total > 0;

          // Aggregeres over alle krav i dokumentet. En batch over fire årganger
          // har ett krav per årgang, og tidligere avgjorde den første linjen
          // hele vurderingen.
          pagesReviewedClaim = pagesReviewedClaim
            ? {
                reviewed: pagesReviewedClaim.reviewed + reviewed,
                total: pagesReviewedClaim.total + total,
                isFull: pagesReviewedClaim.isFull && isFull,
              }
            : { reviewed, total, isFull };

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
        const isHeaderRow = cells.some((c) => SOURCE_ID_HEADER_REGEX.test(c) || DISPOSITION_HEADER_REGEX.test(c));
        const isSeparatorRow = cells.every((c) => /^:?-+:?$/.test(c));

        if (isHeaderRow) {
          inTable = true;
          sourceIdColIndex = cells.findIndex((c) => SOURCE_ID_HEADER_REGEX.test(c));
          dispositionColIndex = cells.findIndex((c) => DISPOSITION_HEADER_REGEX.test(c));
          isSourceInventoryTable = sourceIdColIndex !== -1 && (
            dispositionColIndex !== -1 ||
            cells.some((c) => /^(?:volum|hefte|extraction|sider)\b/i.test(c))
          );
        } else if (!isSeparatorRow && inTable) {
          // Data-rad
          if (sourceIdColIndex >= 0 && sourceIdColIndex < cells.length) {
            const rawSourceId = cells[sourceIdColIndex]!;
            const cleanSourceId = rawSourceId.replace(/[`<>[\]]/g, "").trim();

            if (cleanSourceId && !cleanSourceId.startsWith("---")) {
              if (cleanSourceId.includes(" ")) {
                // Tidligere ble slike celler forkastet i stillhet, slik at en
                // hel inventarrad kunne forsvinne ut av regnskapet.
                issues.push({
                  type: "unknown_source",
                  message: `Kilde-ID «${cleanSourceId}» inneholder mellomrom og er ikke en gyldig sourceId`,
                  line: lineNum,
                });
              } else {
                if (options?.knownSourceIds) {
                  if (options.knownSourceIds.has(cleanSourceId)) {
                    sourceIdsFound.add(cleanSourceId);
                  } else {
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
                  const dispRaw = normalizeDispositionToken(cells[dispositionColIndex]!);
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
          }

          // Valider samtlige disposisjoner i tabellen
          if (dispositionColIndex >= 0 && dispositionColIndex < cells.length) {
            const dispCell = cells[dispositionColIndex]!;
            if (dispCell && !dispCell.startsWith("---")) {
              for (const token of extractDispositionTokens(dispCell)) {
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
