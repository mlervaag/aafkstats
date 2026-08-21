import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse, stringify } from "yaml";
import { dataDir, loadArchive } from "../load.js";
import { generateNewspaperVerificationCases } from "../newspaper-verification-candidates.js";

const args = process.argv.slice(2);
const invocationDir = process.env.INIT_CWD ?? process.cwd();
const inputIndex = args.indexOf("--input");
if (inputIndex < 0 || !args[inputIndex + 1]) throw new Error("Bruk --input <manifest.yaml>.");
const outputIndex = args.indexOf("--output");
const output = resolve(invocationDir, outputIndex >= 0 && args[outputIndex + 1] ? args[outputIndex + 1]! : `${dataDir()}/verification-cases`);
const write = args.includes("--write");
const inputFile = resolve(invocationDir, args[inputIndex + 1]!);
const input = await readFile(inputFile, "utf8");
const manifest = /\.json$/i.test(inputFile) ? JSON.parse(input) as unknown : parse(input, { schema: "core" }) as unknown;
const archive = await loadArchive(dataDir());
const manualCases = archive.verificationCases.filter((item) => item.file.startsWith("verification-cases/"));
const result = generateNewspaperVerificationCases(manifest, manualCases);

if (write) await mkdir(output, { recursive: true });
for (const item of result.cases) {
  const file = resolve(output, `${item.id}.yaml`);
  const yaml = stringify(item, { lineWidth: 0 });
  if (!write) {
    console.log(`--- # ${file}\n${yaml}`);
    continue;
  }
  if (existsSync(file)) throw new Error(`Nekter å overskrive eksisterende sak: ${file}`);
  await writeFile(file, yaml, "utf8");
}
console.error(JSON.stringify({ generated: result.cases.length, skipped: result.skipped, write }, null, 2));
