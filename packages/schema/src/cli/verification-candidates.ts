/**
 * Rangerte forslag til nye JA/NEI-saker, uten å endre data.
 *
 * Redaksjonell publisering er bevisst: en konflikt er ikke automatisk et godt
 * spørsmål. Rapporten finner uavklarte felt som ikke allerede dekkes av køen,
 * prioriterer felt med stor avledet effekt og gir en startformulering som må
 * vurderes før den eventuelt blir en YAML-fil.
 */
import { dataDir, loadArchive } from "../load.js";

interface Candidate {
  score: number;
  target: string;
  field: string;
  reason: string;
  suggestedQuestion: string;
  values: string[];
}

const archive = await loadArchive(dataDir());
const covered = new Set(
  archive.verificationCases
    .filter((item) => ["draft", "open", "paused"].includes(item.status))
    .map((item) => `${item.target.type}:${item.target.id}:${item.target.field}`),
);
const candidates: Candidate[] = [];

function valueList(values: { value: string | number | null }[]): string[] {
  return [...new Set(values.map((entry) => entry.value === null ? "ukjent" : String(entry.value)))];
}

for (const person of archive.people) {
  for (const conflict of person.conflicts) {
    if (conflict.decision !== "unresolved") continue;
    const key = `person:${person.id}:${conflict.field}`;
    if (covered.has(key)) continue;
    const highImpact = /^(name|wikidata|formann|styreleder|coach)/i.test(conflict.field);
    candidates.push({
      score: highImpact ? 88 : 72,
      target: `person:${person.id}`,
      field: conflict.field,
      reason: `${person.name} har ${conflict.values.length} motstridende kildeverdier`,
      suggestedQuestion: `Er ${person.name}s ${conflict.field} oppført riktig i arkivet?`,
      values: valueList(conflict.values),
    });
  }
}

for (const match of archive.matches) {
  for (const conflict of match.conflicts) {
    if (conflict.decision !== "unresolved") continue;
    const key = `match:${match.id}:${conflict.field}`;
    if (covered.has(key)) continue;
    const score = conflict.field === "score" ? 98 : conflict.field === "date" ? 92 : 78;
    candidates.push({
      score,
      target: `match:${match.id}`,
      field: conflict.field,
      reason: `Kampen ${match.id} har motstridende verdier for ${conflict.field}`,
      suggestedQuestion: `Er ${conflict.field} for kampen ${match.id} oppført riktig?`,
      values: valueList(conflict.values),
    });
  }
}

candidates.sort((a, b) => b.score - a.score || a.target.localeCompare(b.target));
console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  publishedCases: archive.verificationCases.filter((item) => item.status === "open").length,
  uncoveredCandidates: candidates.length,
  candidates,
}, null, 2));
