import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { stringify } from "yaml";
import { crossValidate, dataDir, loadArchive } from "../load.js";
import { parseNewspaperVerificationIssue, prepareNewspaperVerificationReview } from "../newspaper-verification-editorial.js";

const args = process.argv.slice(2);
const invocationDir = process.env.INIT_CWD ?? process.cwd();
function value(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const issueFile = value("--issue");
const issueUrl = value("--issue-url");
if (!issueFile || !issueUrl) throw new Error("Bruk --issue <issue.md> --issue-url <https://github.com/.../issues/...>.");
if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(issueUrl)) throw new Error("--issue-url må være en full GitHub-issue-lenke.");

const resolvedAt = value("--resolved-at") ?? new Date().toISOString().slice(0, 10);
const archive = await loadArchive(dataDir());
const issues = [...archive.issues, ...crossValidate(archive)];
if (issues.length > 0) throw new Error(`Arkivet har ${issues.length} valideringsfeil. Stopp redaksjonell behandling.`);

const body = await readFile(resolve(invocationDir, issueFile), "utf8");
const payload = parseNewspaperVerificationIssue(body);
const preparation = prepareNewspaperVerificationReview(payload, archive, { issueUrl, resolvedAt });
const outputFile = resolve(dataDir(), "verification-cases", `${payload.verificationCaseId}.yaml`);

console.log(JSON.stringify({
  verificationCaseId: payload.verificationCaseId,
  answer: payload.answer,
  disposition: preparation.disposition,
  canonicalAction: preparation.canonicalAction,
  canonicalBlockers: preparation.canonicalBlockers,
  sourceResult: preparation.sourceResult,
  matchingCanonicalMatchIds: preparation.matchingCanonicalMatchIds,
  existingObservationIds: preparation.existingObservationIds,
  outputFile,
}, null, 2));
console.log(`--- # ${outputFile}\n${stringify(preparation.verificationCase, { lineWidth: 0 })}`);

if (args.includes("--write")) {
  if (existsSync(outputFile)) throw new Error(`Nekter å overskrive eksisterende sak: ${outputFile}`);
  await writeFile(outputFile, stringify(preparation.verificationCase, { lineWidth: 0 }), "utf8");
  console.error(`Skrev ${outputFile}. Kontroller diffen og følg den redaksjonelle runbooken før draft PR.`);
}
